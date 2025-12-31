import express, { Router } from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";
import { calcFeesForShow } from "../services/fees.js";
import { sendTicketsEmail, sendDigitalProductEmail } from "../services/email.js";
import { decrementStockTransaction } from "../lib/storefront.js";
import { syncMarketingContactFromOrder } from "../services/marketing/contacts.js";
import { MarketingAutomationTriggerType, MarketingConsentSource } from "@prisma/client";
import { enqueueAutomationForContact, markCheckoutCompleted } from "../services/marketing/automations.js";


const stripeSecret = process.env.STRIPE_SECRET_KEY;
const StripeClient = (Stripe as any)?.default || Stripe;

const stripe: Stripe | null = stripeSecret
  ? new StripeClient(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

const router = Router();

function makeTicketSerial() {
  // Short, scan-friendly serial (20 chars)
  return crypto.randomBytes(10).toString("hex").toUpperCase();
}

function buildSeatDisplayName(seatAttrs: any, parentAttrs: any): string {
  const row = String(seatAttrs?.sbSeatRowLabel || "");
  const num = String(seatAttrs?.sbSeatLabel || "");
  const type = String(parentAttrs?.shapeType || parentAttrs?.name || "");

  if (type === "circular-table" || type === "rect-table") {
    return row && num ? `T${row}-${num}` : "";
  }
  return row ? `${row}${num}` : num;
}

function buildSeatRefMapFromKonva(konvaJson: any): Map<string, string> {
  const map = new Map<string, string>();

  const walk = (node: any, parentAttrs: any) => {
    if (!node || typeof node !== "object") return;

    const attrs = node.attrs || {};
    const isSeat = attrs.isSeat === true || attrs.isSeat === "true";

    if (isSeat) {
      const sid = String(attrs.sbSeatId || attrs.id || "").trim();
      if (sid) {
        const display = buildSeatDisplayName(attrs, parentAttrs);
        const ref = String(attrs.sbSeatRef || "").trim();
        map.set(sid, display || ref || sid);
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child, attrs);
    }
  };

  walk(konvaJson, null);
  return map;
}

function parseProductSelections(raw: string | undefined | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: String(item.productId || ""),
        variantId: item.variantId ? String(item.variantId) : null,
        qty: Number(item.qty || 0),
        unitAmount: Number(item.unitAmount || 0),
        customAmount: item.customAmount ? Number(item.customAmount) : null,
      }))
      .filter((item) => item.productId && item.qty > 0);
  } catch {
    return [];
  }
}

async function handleProductOrderFromSession(session: Stripe.Checkout.Session) {
  const productSelectionRaw = session.metadata?.productSelection;
  const selections = parseProductSelections(productSelectionRaw);
  const storefrontId = session.metadata?.storefrontId;

  if (!storefrontId || !selections.length) return null;

  const existing = await prisma.productOrder.findFirst({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existing) return existing;

  const storefront = await prisma.storefront.findUnique({ where: { id: storefrontId } });
  if (!storefront) return null;

  const productIds = Array.from(new Set(selections.map((s) => s.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const itemsToCreate: Array<{
    productId: string;
    variantId?: string | null;
    titleSnapshot: string;
    variantSnapshot?: string | null;
    unitPricePence: number;
    qty: number;
    lineTotalPence: number;
    fulfilmentTypeSnapshot: any;
    metadataJson?: any;
  }> = [];

  let subtotal = 0;

  for (const selection of selections) {
    const product = productMap.get(selection.productId);
    if (!product) continue;
    const variant = selection.variantId
      ? product.variants.find((v) => v.id === selection.variantId)
      : null;
    let unitPrice = variant?.pricePenceOverride ?? product.pricePence ?? 0;
    if (product.allowCustomAmount && selection.unitAmount) {
      unitPrice = Math.max(100, Number(selection.unitAmount || 0));
    }
    const qty = Math.max(1, Math.floor(selection.qty));
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    itemsToCreate.push({
      productId: product.id,
      variantId: variant?.id || null,
      titleSnapshot: product.title,
      variantSnapshot: variant?.title || null,
      unitPricePence: unitPrice,
      qty,
      lineTotalPence: lineTotal,
      fulfilmentTypeSnapshot: product.fulfilmentType,
    });
  }

  const taxPence = Number(session.metadata?.productTaxPence || 0) || 0;
  const shippingPence = Number(session.metadata?.productShippingPence || 0) || 0;
  const totalPence = subtotal + taxPence + shippingPence;

  const customerDetails = session.customer_details;
  const shippingDetails = session.shipping_details;

  const source =
    session.metadata?.source === "STOREFRONT_ONLY" ? "STOREFRONT_ONLY" : "TICKET_CHECKOUT";

  const order = await prisma.productOrder.create({
    data: {
      storefrontId,
      orderId: session.metadata?.orderId || null,
      source,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      customerName: customerDetails?.name || null,
      customerEmail: customerDetails?.email || null,
      customerPhone: customerDetails?.phone || null,
      shippingAddressJson: shippingDetails?.address || null,
      subtotalPence: subtotal,
      taxPence,
      shippingPence,
      totalPence,
      currency: session.currency || "gbp",
      status: "PAID",
    },
  });

  for (const item of itemsToCreate) {
    await prisma.productOrderItem.create({
      data: {
        productOrderId: order.id,
        productId: item.productId,
        variantId: item.variantId || null,
        titleSnapshot: item.titleSnapshot,
        variantSnapshot: item.variantSnapshot || null,
        unitPricePence: item.unitPricePence,
        qty: item.qty,
        lineTotalPence: item.lineTotalPence,
        fulfilmentTypeSnapshot: item.fulfilmentTypeSnapshot,
      },
    });

    await decrementStockTransaction(item.productId, item.qty, item.variantId || null);
  }

  const digitalItems = itemsToCreate.filter((item) => item.fulfilmentTypeSnapshot === "EMAIL");
  if (digitalItems.length && customerDetails?.email) {
    await sendDigitalProductEmail({
      email: customerDetails.email,
      name: customerDetails.name || "",
      items: digitalItems,
      storefront,
      orderId: order.id,
    });
  }

  return order;
}

async function loadSeatRefMapForShow(showId: string): Promise<Map<string, string>> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { activeSeatMapId: true },
  });

  const seatMap =
    show?.activeSeatMapId
      ? await prisma.seatMap.findUnique({ where: { id: show.activeSeatMapId } })
      : await prisma.seatMap.findFirst({ where: { showId }, orderBy: { updatedAt: "desc" } });

  if (!seatMap?.layout) return new Map();

  const layout: any = seatMap.layout as any;

  // Your code already treats layout as either { konvaJson: "..." } or raw JSON/string
  const konvaRaw =
    typeof layout === "string"
      ? layout
      : typeof layout?.konvaJson === "string"
        ? layout.konvaJson
        : null;

  if (!konvaRaw) return new Map();

  try {
    const parsed = typeof konvaRaw === "string" ? JSON.parse(konvaRaw) : konvaRaw;
    return buildSeatRefMapFromKonva(parsed);
  } catch {
    return new Map();
  }
}


function markSeatsSold(layout: any, seatIds: string[]): any {
  const seatSet = new Set(seatIds);

  const mutateNode = (node: any) => {
    if (!node || typeof node !== "object") return;

    const attrs = node.attrs || node;

    const isSeat =
      (attrs.isSeat || attrs.isSeat === "true") &&
      (node.className === "Circle" || attrs.className === "Circle" || typeof attrs.radius === "number");

    const sbSeatId = attrs.sbSeatId;
    const id = attrs.id;

    const matches =
      (typeof sbSeatId === "string" && seatSet.has(sbSeatId)) || (typeof id === "string" && seatSet.has(id));

    if (isSeat && matches) {
      attrs.status = "SOLD";
      attrs.sbHoldStatus = "sold";
    }

    if (node.attrs) node.attrs = attrs;

    if (Array.isArray(node.children)) {
      node.children.forEach(mutateNode);
    }
  };

  let root = layout;
  let wasString = false;

  if (typeof root === "string") {
    wasString = true;
    try {
      root = JSON.parse(root);
    } catch {
      return layout;
    }
  }

  mutateNode(root);
  return wasString ? JSON.stringify(root) : root;
}

async function getTableNameCaseInsensitive(target: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<
    Array<{ table_name: string }>
  >`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND lower(table_name)=lower(${target}) LIMIT 1`;
  return rows?.[0]?.table_name ?? null;
}

async function getTableCols(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${tableName}
  `;
  return new Set((rows || []).map(r => r.column_name));
}

async function countByOrderId(tableName: string, cols: Set<string>, orderId: string): Promise<number> {
  if (!cols.has("orderId")) return 0; // can't check idempotency safely
  const rows = await prisma.$queryRawUnsafe<Array<{ c: any }>>(
    `SELECT COUNT(*)::int as c FROM "${tableName}" WHERE "orderId"=$1`,
    orderId
  );
  return Number(rows?.[0]?.c ?? 0);
}

async function insertRow(tableName: string, cols: Set<string>, row: Record<string, any>) {
  // Only insert keys that actually exist on the table
  const keys = Object.keys(row).filter(k => cols.has(k) && row[k] !== undefined);

  if (!keys.length) return;

  const colSql = keys.map(k => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map(k => row[k]);

  const sql = `INSERT INTO "${tableName}" (${colSql}) VALUES (${placeholders})`;
  await prisma.$executeRawUnsafe(sql, ...values);
}


/**
 * Stripe webhook endpoint:
 * Mounted in app.ts as: app.use("/webhook", webhookRouter)
 * So the final URL is: POST /webhook/stripe
 */
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("Stripe not configured");

    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) return res.status(400).send("No signature");

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type !== "checkout.session.completed") {
      return res.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const showId = session.metadata?.showId;
    const hasTicketOrder = Boolean(orderId && showId);
    const hasProductOrder = Boolean(session.metadata?.productSelection && session.metadata?.storefrontId);

    const seatIdsRaw = session.metadata?.seatIds || "";
    const seatIds = seatIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!hasTicketOrder && !hasProductOrder) {
      console.warn("webhook: missing orderId/showId metadata", { orderId, showId });
      return res.json({ received: true });
    }

    if (hasProductOrder && !hasTicketOrder) {
      await handleProductOrderFromSession(session);
      return res.json({ received: true });
    }

    if (hasProductOrder) {
      await handleProductOrderFromSession(session);
    }

    // Load order to compute fees precisely
 const order = await prisma.order.findUnique({
  where: { id: orderId },
  select: {
    id: true,
    amountPence: true,
    quantity: true,
    userId: true,
    status: true,
    ticketTypeId: true, // ✅ fallback if Stripe metadata ticketTypeId is missing
  },
});

    if (!order) {
      console.warn("webhook: order not found", { orderId });
      return res.json({ received: true });
    }

    let organiserSplitBps: number | null = null;
    if (order.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { organiserSplitBps: true },
      });
      organiserSplitBps = user?.organiserSplitBps ?? null;
    }

    const fees = await calcFeesForShow(
      showId,
      Number(order.amountPence ?? 0),
      Number(order.quantity ?? 0),
      organiserSplitBps ?? undefined
    );

const payerEmail =
  session.customer_details?.email || session.customer_email || undefined;

// ✅ Stripe no longer provides custom_fields (after your change)
// Pull name + postcode from customer_details instead.
const fullName = String(session.customer_details?.name || "").trim();

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const { firstName: payerFirstName, lastName: payerLastName } = splitName(fullName);

const payerPostcode = String(session.customer_details?.address?.postal_code || "").trim() || null;


    // Update order -> PAID + store fee breakdown
 const shippingDetails = session.shipping_details;

 await prisma.order.update({
  where: { id: orderId },
  data: {
    status: "PAID",
    platformFeePence: fees.platformFeePence,
    organiserSharePence: fees.organiserSharePence,
    paymentFeePence: fees.paymentFeePence,
    netPayoutPence: fees.netPayoutPence,
    stripeId: session.payment_intent as string,
    email: payerEmail,

    // ✅ new captured customer fields
    buyerFirstName: payerFirstName,
    buyerLastName: payerLastName,
    buyerPostcode: payerPostcode,
    shippingName: shippingDetails?.name || payerFirstName || null,
    shippingEmail: payerEmail,
    shippingPhone: session.customer_details?.phone || null,
    shippingAddressJson: shippingDetails?.address || null,
  },
});
// -----------------------------
// CREATE TICKETS (idempotent)
// -----------------------------
let finalTicketCount = 0;

try {
  const existing = await prisma.ticket.count({ where: { orderId } });

  if (existing > 0) {
    console.info("[webhook] tickets already exist, skipping", { orderId, existing });
    finalTicketCount = existing;
  } else {
    const seatGroupsRaw = session.metadata?.seatGroups || "";

    // Fallback (single ticket type orders only)
    const gaTicketTypeId =
      (session.metadata?.ticketTypeId || "").trim() || (order.ticketTypeId || "").trim();

    const qtyOrder = Number(order.quantity ?? 1) || 1;
    const total = Number(order.amountPence ?? 0) || 0;

    // Best-effort unit price from order total (used if we can't look up ticket type prices)
    const unitFromOrder = Math.max(0, Math.round(total / Math.max(1, qtyOrder)));

    const seatRefMap = await loadSeatRefMapForShow(showId);

    // Look up ticket type prices for any ticketTypeIds present in seatGroups
    const priceByTtId = new Map<string, number>();

    if (seatGroupsRaw) {
      try {
        const parsed = JSON.parse(seatGroupsRaw);
        const ids = Array.isArray(parsed)
          ? Array.from(
              new Set(
                parsed
                  .map((g: any) => String(g?.ticketTypeId || "").trim())
                  .filter(Boolean)
              )
            )
          : [];

        if (ids.length) {
          const tts = await prisma.ticketType.findMany({
            where: { id: { in: ids } },
            select: { id: true, pricePence: true },
          });
          for (const tt of tts) {
            priceByTtId.set(tt.id, Number(tt.pricePence ?? 0) || 0);
          }
        }
      } catch {
        // ignore; we'll fall back to unitFromOrder
      }
    }

    const ticketsToCreate: Array<{
      serial: string;
      holderName?: string | null;
      status?: string | null;
      orderId: string;
      showId: string;
      ticketTypeId: string;
      seatId?: string | null;
      seatRef?: string | null;
      amountPence: number;
      quantity: number;
    }> = [];

    // -----------------------------
    // seatGroups mode (allocated + unallocated)
    // seatGroups format: [{ ticketTypeId, quantity?, seatIds? }]
    // -----------------------------
    let usedSeatGroups = false;

    if (seatGroupsRaw) {
      let seatGroups: Array<{ ticketTypeId: string; quantity?: number; seatIds?: string[] }> = [];
      try {
        seatGroups = JSON.parse(seatGroupsRaw);
      } catch {
        console.warn("[webhook] invalid seatGroups JSON (cannot create grouped tickets)", { orderId });
        seatGroups = [];
      }

      // ✅ Treat seatGroups as usable if it represents at least 1 ticket,
      // either via seatIds (allocated) OR quantity (unallocated)
      const totalQty = (seatGroups || []).reduce((acc, g) => {
        const ids = Array.isArray(g?.seatIds) ? g.seatIds.length : 0;
        const q = Number(g?.quantity ?? 0) || 0;
        return acc + (ids > 0 ? ids : q);
      }, 0);

      if (totalQty > 0) {
        usedSeatGroups = true;

        for (const g of seatGroups) {
          const ttId = String(g?.ticketTypeId || "").trim();
          if (!ttId) continue;

          const ids = Array.isArray(g?.seatIds)
            ? g.seatIds.map((s) => String(s).trim()).filter(Boolean)
            : [];

          const qRaw = ids.length > 0 ? ids.length : Number(g?.quantity ?? 0);
          const q = Number.isFinite(qRaw) ? Math.max(0, Math.floor(qRaw)) : 0;
          if (q < 1) continue;

          const amountPence = priceByTtId.get(ttId) ?? unitFromOrder;

          // Allocated: 1 ticket per seatId
          if (ids.length > 0) {
            for (const seatId of ids) {
              ticketsToCreate.push({
                serial: makeTicketSerial(),
                holderName: null,
                status: "SOLD",
                orderId,
                showId,
                ticketTypeId: ttId,
                seatId,
                seatRef: seatRefMap.get(seatId) || null,
                amountPence,
                quantity: 1,
              });
            }
          } else {
            // ✅ Unallocated/GA: 1 ticket row per quantity
            for (let i = 0; i < q; i++) {
              ticketsToCreate.push({
                serial: makeTicketSerial(),
                holderName: null,
                status: "SOLD",
                orderId,
                showId,
                ticketTypeId: ttId,
                seatId: null,
                seatRef: null,
                amountPence,
                quantity: 1,
              });
            }
          }
        }
      } else {
        console.warn("[webhook] seatGroups metadata present but empty; falling back to GA mode", { orderId });
      }
    }

    // -----------------------------
    // GA fallback (single ticket type orders)
    // -----------------------------
    if (!usedSeatGroups && gaTicketTypeId) {
      // If seatIds exist, create 1 per seat, else 1 per quantity
      if (seatIds.length > 0) {
        for (const seatId of seatIds) {
          ticketsToCreate.push({
            serial: makeTicketSerial(),
            holderName: null,
            status: "SOLD",
            orderId,
            showId,
            ticketTypeId: gaTicketTypeId,
            seatId,
            seatRef: seatRefMap.get(seatId) || null,
            amountPence: unitFromOrder,
            quantity: 1,
          });
        }
      } else {
        for (let i = 0; i < qtyOrder; i++) {
          ticketsToCreate.push({
            serial: makeTicketSerial(),
            holderName: null,
            status: "SOLD",
            orderId,
            showId,
            ticketTypeId: gaTicketTypeId,
            seatId: null,
            seatRef: null,
            amountPence: unitFromOrder,
            quantity: 1,
          });
        }
      }
    } else if (!usedSeatGroups && !gaTicketTypeId) {
      console.warn("[webhook] no usable seatGroups + no ticketTypeId metadata (cannot create tickets)", { orderId });
    }

    if (ticketsToCreate.length) {
      await prisma.ticket.createMany({ data: ticketsToCreate });
    }

    finalTicketCount = await prisma.ticket.count({ where: { orderId } });

    console.info("[webhook] tickets created", {
      orderId,
      intended: ticketsToCreate.length,
      finalTicketCount,
    });
  }
} catch (ticketErr: any) {
  console.error("[webhook] ticket creation failed", {
    orderId,
    message: ticketErr?.message,
    stack: ticketErr?.stack,
  });
}






    // Only send the email the first time we flip to PAID (webhooks retry)
   if (order.status !== "PAID") {
  const showForMarketing = await prisma.show.findUnique({
    where: { id: showId },
    select: { organiserId: true },
  });
  if (showForMarketing?.organiserId) {
    if (payerEmail) {
      const contact = await syncMarketingContactFromOrder({
        tenantId: showForMarketing.organiserId,
        email: payerEmail,
        firstName: payerFirstName,
        lastName: payerLastName,
        source: MarketingConsentSource.CHECKOUT,
        capturedIp: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""),
        capturedUserAgent: String(req.headers["user-agent"] || ""),
      });
      if (contact) {
        await enqueueAutomationForContact(
          showForMarketing.organiserId,
          contact.id,
          MarketingAutomationTriggerType.AFTER_PURCHASE
        );
      }
    }
    await markCheckoutCompleted(showForMarketing.organiserId, orderId, payerEmail);
  }
  try {
    if ((finalTicketCount || 0) > 0) {
      await sendTicketsEmail(orderId);
      console.info("webhook: tickets email sent", { orderId });
    } else {
      console.warn("[webhook] skipping email send because no tickets exist", { orderId });
    }
  } catch (emailErr: any) {
    console.error("webhook: confirmation email failed", {
      orderId,
      message: emailErr?.message,
      stack: emailErr?.stack,
    });
  }
} else {
  console.info("webhook: order already PAID, skipping email", { orderId });
}


    // Mark sold seats on active seatmap (best-effort)
    if (seatIds.length > 0) {
      const show = await prisma.show.findUnique({
        where: { id: showId },
        select: { activeSeatMapId: true },
      });

      let seatMap =
        show?.activeSeatMapId
          ? await prisma.seatMap.findUnique({ where: { id: show.activeSeatMapId } })
          : null;

      if (!seatMap) {
        seatMap = await prisma.seatMap.findFirst({
          where: { showId },
          orderBy: { updatedAt: "desc" },
        });
      }

      console.log("[webhook] seat sell update", {
        showId,
        activeSeatMapId: show?.activeSeatMapId ?? null,
        seatMapIdUsed: seatMap?.id ?? null,
        seatIdsCount: seatIds.length,
        seatIdsSample: seatIds.slice(0, 10),
      });

      if (seatMap && seatMap.layout) {
        let layout: any = seatMap.layout as any;

        if (layout.konvaJson) {
          layout = {
            ...layout,
            konvaJson: markSeatsSold(layout.konvaJson, seatIds),
          };
        } else {
          layout = markSeatsSold(layout, seatIds);
        }

        await prisma.seatMap.update({
          where: { id: seatMap.id },
          data: { layout },
        });
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("stripe webhook error", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
