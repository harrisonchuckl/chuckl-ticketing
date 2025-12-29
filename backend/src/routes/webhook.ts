import express, { Router } from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";
import { calcFeesForShow } from "../services/fees.js";
import { sendTicketsEmail } from "../services/email.js";


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

    const seatIdsRaw = session.metadata?.seatIds || "";
    const seatIds = seatIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!orderId || !showId) {
      console.warn("webhook: missing orderId/showId metadata", { orderId, showId });
      return res.json({ received: true });
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
  },
});

// -----------------------------
// CREATE TICKETS (idempotent)
// -----------------------------
try {
  const existing = await prisma.ticket.count({ where: { orderId } });

  if (existing > 0) {
    console.info("[webhook] tickets already exist, skipping", { orderId, existing });
  } else {
    const seatGroupsRaw = session.metadata?.seatGroups || "";

    // Prefer Stripe metadata; fall back to order.ticketTypeId if present
    const gaTicketTypeId =
      (session.metadata?.ticketTypeId || "").trim() || (order.ticketTypeId || "").trim();

    const qty = Number(order.quantity ?? 1) || 1;
    const total = Number(order.amountPence ?? 0) || 0;
    const unitFromOrder = Math.max(0, Math.round(total / Math.max(1, qty)));

    const seatRefMap = await loadSeatRefMapForShow(showId);

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

    // Tiered seating mode: seatGroups contains [{ticketTypeId, unitPricePence, seatIds[]}]
    // ✅ BUT: ignore it if it contains no seatIds (GA orders must fall back to qty mode)
    let usedSeatGroups = false;

    if (seatGroupsRaw) {
      let seatGroups: Array<{ ticketTypeId: string; unitPricePence: number; seatIds: string[] }> = [];
      try {
        seatGroups = JSON.parse(seatGroupsRaw);
      } catch {
        console.warn("[webhook] invalid seatGroups JSON (cannot create tiered tickets)", { orderId });
        seatGroups = [];
      }

      const totalSeatIds = seatGroups.reduce((acc, g) => {
        const ids = Array.isArray(g?.seatIds) ? g.seatIds.length : 0;
        return acc + ids;
      }, 0);

      if (totalSeatIds > 0) {
        usedSeatGroups = true;

        for (const g of seatGroups) {
          const ttId = String(g.ticketTypeId || "").trim();
          const unit = Number(g.unitPricePence || 0);
          const ids = Array.isArray(g.seatIds) ? g.seatIds.map(s => String(s).trim()).filter(Boolean) : [];

          for (const seatId of ids) {
            if (!ttId || !unit) continue;

            ticketsToCreate.push({
              serial: makeTicketSerial(),
              holderName: null,
              status: "SOLD",
              orderId,
              showId,
              ticketTypeId: ttId,
              seatId,
              seatRef: seatRefMap.get(seatId) || null,
              amountPence: unit,
              quantity: 1,
            });
          }
        }
      } else {
        console.warn("[webhook] seatGroups metadata present but empty; falling back to GA qty mode", { orderId });
      }
    }

    // GA mode: create 1 ticket per seat (if seats exist) else 1 per quantity
    if (!usedSeatGroups && gaTicketTypeId) {
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
        for (let i = 0; i < qty; i++) {
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

    console.info("[webhook] tickets created", { orderId, count: ticketsToCreate.length });
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
      try {
        await sendTicketsEmail(orderId);
        console.info("webhook: tickets email sent", { orderId });
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
