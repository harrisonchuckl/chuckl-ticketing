import express, { Router } from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";
import { calcFeesForShow } from "../services/fees.js";
import { sendTicketsEmail, sendDigitalProductEmail } from "../services/email.js";
import { decrementStockTransaction } from "../lib/storefront.js";
import { syncMarketingContactFromOrder } from "../services/marketing/contacts.js";
import { MarketingAutomationTriggerType, MarketingConsentSource, Prisma, ProductOrderFulfilmentStatus, ProductOrderItemStatus } from "@prisma/client";
import { enqueueAutomationForContact, markCheckoutCompleted } from "../services/marketing/automations.js";
import { createPrintfulClient, PrintfulOrderCreatePayload } from "../services/integrations/printful.js";
import { estimateStripeFees, estimateVat, getPrintfulPricingConfig } from "../services/printful-pricing.js";
import { refreshCustomerInsightForOrder } from "../services/customer-insights.js";


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

function toAddressJson(address?: Stripe.Address | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!address) return Prisma.DbNull;
  return {
    line1: address.line1 ?? null,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    postal_code: address.postal_code ?? null,
    country: address.country ?? null,
  };
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
      shippingAddressJson: toAddressJson(shippingDetails?.address),
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

  await refreshProductOrderProfitSnapshot(order.id);

  return order;
}

function buildProductOrderFulfilmentStatus(items: Array<{ fulfilmentStatus: ProductOrderItemStatus }>) {
  if (items.some((item) => item.fulfilmentStatus === ProductOrderItemStatus.ERROR)) {
    return ProductOrderFulfilmentStatus.ERROR;
  }
  const fulfilledCount = items.filter((item) => item.fulfilmentStatus === ProductOrderItemStatus.FULFILLED).length;
  if (fulfilledCount === 0) return ProductOrderFulfilmentStatus.UNFULFILLED;
  if (fulfilledCount === items.length) return ProductOrderFulfilmentStatus.FULFILLED;
  return ProductOrderFulfilmentStatus.PARTIAL;
}

function buildPrintfulRecipient(order: {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddressJson: Prisma.JsonValue | null;
}): PrintfulOrderCreatePayload["recipient"] | null {
  if (!order.shippingAddressJson || typeof order.shippingAddressJson !== "object") return null;
  const address = order.shippingAddressJson as Record<string, any>;
  const line1 = String(address.line1 || "").trim();
  const city = String(address.city || "").trim();
  const postalCode = String(address.postal_code || "").trim();
  const country = String(address.country || "").trim();

  if (!line1 || !city || !postalCode || !country) return null;

  return {
    name: order.customerName || "Customer",
    address1: line1,
    address2: address.line2 ? String(address.line2) : undefined,
    city,
    state_code: address.state ? String(address.state) : undefined,
    country_code: country,
    zip: postalCode,
    phone: order.customerPhone || undefined,
    email: order.customerEmail || undefined,
  };
}


function parsePrintfulMoney(value: any) {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

async function refreshProductOrderProfitSnapshot(orderId: string) {
  const order = await prisma.productOrder.findUnique({
    where: { id: orderId },
    include: { items: true, storefront: true },
  });

  if (!order || !order.storefront) return;

  const organiserId = order.storefront.ownerUserId;
  const pricingConfig = await getPrintfulPricingConfig(organiserId);

  const productIds = Array.from(new Set(order.items.map((item) => item.productId)));
  const variantIds = Array.from(new Set(order.items.map((item) => item.variantId).filter(Boolean))) as string[];

  const [mappings, products] = await Promise.all([
    prisma.fulfilmentProductMapping.findMany({
      where: {
        organiserId,
        provider: "PRINTFUL",
        productId: { in: productIds },
        OR: [{ productVariantId: { in: variantIds } }, { productVariantId: null }],
      },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, promoter: { select: { ownerId: true } } },
    }),
  ]);

  const mappingByKey = new Map(
    mappings.map((mapping) => [`${mapping.productId}:${mapping.productVariantId || "base"}`, mapping])
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  let missingCost = false;
  let estimatedPrintfulSubtotal = 0;

  const itemSnapshots = order.items.map((item) => {
    const key = `${item.productId}:${item.variantId || "base"}`;
    const mapping = mappingByKey.get(key);
    const baseCost = mapping?.providerBasePricePence ?? null;
    if (baseCost === null || baseCost === undefined) {
      missingCost = true;
    }
    const printfulLineTotal = baseCost ? baseCost * item.qty : 0;
    estimatedPrintfulSubtotal += printfulLineTotal;

    const product = productById.get(item.productId);
    const promoterOwnerId = product?.promoter?.ownerId || null;
    const isShared = Boolean(promoterOwnerId && promoterOwnerId !== organiserId);
    const organiserShare = isShared ? Math.round(item.lineTotalPence * 0.1) : item.lineTotalPence;
    const platformShare = isShared ? Math.round(item.lineTotalPence * 0.05) : 0;
    const creatorShare = isShared ? Math.max(0, item.lineTotalPence - organiserShare - platformShare) : 0;

    return {
      productOrderItemId: item.id,
      organiserId,
      retailUnitPricePence: item.unitPricePence,
      retailLineTotalPence: item.lineTotalPence,
      printfulUnitCostPence: baseCost ?? 0,
      printfulLineTotalPence: printfulLineTotal,
      marginBpsUsed: pricingConfig.marginBps,
      currency: order.currency,
      organiserSharePence: organiserShare,
      platformSharePence: platformShare,
      creatorSharePence: creatorShare,
    };
  });

  const retailSubtotal = order.subtotalPence;
  const retailShipping = order.shippingPence;
  const retailTax = order.taxPence;
  const retailTotal = order.totalPence;

  const printfulSubtotal = order.printfulCostSubtotalPence ?? estimatedPrintfulSubtotal;
  const printfulShipping = order.printfulShippingPence ?? 0;
  const printfulTax = order.printfulTaxPence ?? 0;
  const printfulTotal = order.printfulTotalPence ?? (printfulSubtotal + printfulShipping + printfulTax);

  const stripeFeePence = estimateStripeFees(retailTotal, pricingConfig);
  const vatEstimatePence = estimateVat(retailSubtotal, pricingConfig);
  const netProfitPence = retailTotal - printfulTotal - stripeFeePence - vatEstimatePence;

  const organiserShareTotal = itemSnapshots.reduce((sum, row) => sum + row.organiserSharePence, 0);
  const platformShareTotal = itemSnapshots.reduce((sum, row) => sum + row.platformSharePence, 0);
  const creatorShareTotal = itemSnapshots.reduce((sum, row) => sum + row.creatorSharePence, 0);

  const snapshot = await prisma.productOrderProfitSnapshot.upsert({
    where: { productOrderId: order.id },
    create: {
      productOrderId: order.id,
      organiserId,
      retailSubtotalPence: retailSubtotal,
      retailShippingPence: retailShipping,
      retailTaxPence: retailTax,
      retailTotalPence: retailTotal,
      printfulSubtotalPence: printfulSubtotal,
      printfulShippingPence: printfulShipping,
      printfulTaxPence: printfulTax,
      printfulTotalPence: printfulTotal,
      stripeFeePence,
      vatEstimatePence,
      netProfitPence,
      currency: order.currency,
      marginBpsUsed: pricingConfig.marginBps,
      vatRateBpsUsed: pricingConfig.vatRateBps,
      shippingPolicyUsed: pricingConfig.shippingPolicy,
      negativeMargin: netProfitPence < 0,
      missingPrintfulCost: missingCost,
      organiserSharePence: organiserShareTotal,
      platformSharePence: platformShareTotal,
      creatorSharePence: creatorShareTotal,
    },
    update: {
      retailSubtotalPence: retailSubtotal,
      retailShippingPence: retailShipping,
      retailTaxPence: retailTax,
      retailTotalPence: retailTotal,
      printfulSubtotalPence: printfulSubtotal,
      printfulShippingPence: printfulShipping,
      printfulTaxPence: printfulTax,
      printfulTotalPence: printfulTotal,
      stripeFeePence,
      vatEstimatePence,
      netProfitPence,
      currency: order.currency,
      marginBpsUsed: pricingConfig.marginBps,
      vatRateBpsUsed: pricingConfig.vatRateBps,
      shippingPolicyUsed: pricingConfig.shippingPolicy,
      negativeMargin: netProfitPence < 0,
      missingPrintfulCost: missingCost,
      organiserSharePence: organiserShareTotal,
      platformSharePence: platformShareTotal,
      creatorSharePence: creatorShareTotal,
    },
  });

  const totalRetailForAllocation = retailSubtotal || 1;
  await prisma.productOrderItemProfitSnapshot.deleteMany({
    where: { productOrderItemId: { in: itemSnapshots.map((row) => row.productOrderItemId) } },
  });

  await prisma.productOrderItemProfitSnapshot.createMany({
    data: itemSnapshots.map((row) => {
      const allocationRatio = row.retailLineTotalPence / totalRetailForAllocation;
      const stripeFeeShare = Math.round(stripeFeePence * allocationRatio);
      const vatShare = Math.round(vatEstimatePence * allocationRatio);
      const netProfit = row.retailLineTotalPence - row.printfulLineTotalPence - stripeFeeShare - vatShare;
      return {
        ...row,
        stripeFeePence: stripeFeeShare,
        vatEstimatePence: vatShare,
        netProfitPence: netProfit,
        negativeMargin: netProfit < 0,
        profitSnapshotId: snapshot.id,
      };
    }),
  });
}

async function fulfilPrintfulItemsForOrder(orderId: string, sessionId: string) {
  const order = await prisma.productOrder.findUnique({
    where: { id: orderId },
    include: { items: true, storefront: true },
  });

  if (!order) return;
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== sessionId) return;

  const printfulItems = order.items.filter((item) => item.fulfilmentTypeSnapshot === "PRINTFUL");
  if (!printfulItems.length) return;

  if (printfulItems.some((item) => item.fulfilmentProviderOrderId || item.fulfilmentStatus === "ERROR")) {
    return;
  }

  const recipient = buildPrintfulRecipient(order);
  if (!recipient) {
    const message = "Missing shipping address for Printful fulfilment.";
    await prisma.productOrderItem.updateMany({
      where: { id: { in: printfulItems.map((item) => item.id) } },
      data: { fulfilmentStatus: "ERROR", fulfilmentErrorMessage: message },
    });
    await prisma.productOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus: "ERROR" },
    });
    return;
  }

  const organiserId = order.storefront.ownerUserId;
  const productIds = Array.from(new Set(printfulItems.map((item) => item.productId)));
  const variantIds = Array.from(new Set(printfulItems.map((item) => item.variantId).filter(Boolean))) as string[];

  const mappings = await prisma.fulfilmentProductMapping.findMany({
    where: {
      organiserId,
      provider: "PRINTFUL",
      productId: { in: productIds },
      OR: [{ productVariantId: { in: variantIds } }, { productVariantId: null }],
    },
  });

  const mappingByKey = new Map(
    mappings.map((mapping) => [`${mapping.productId}:${mapping.productVariantId || "base"}`, mapping])
  );

  const errors: Array<{ id: string; message: string }> = [];
  const orderItemsPayload: PrintfulOrderCreatePayload["items"] = [];

  for (const item of printfulItems) {
    const key = `${item.productId}:${item.variantId || "base"}`;
    const mapping = mappingByKey.get(key);
    if (!mapping) {
      errors.push({
        id: item.id,
        message: "Missing Printful mapping for this product variant.",
      });
      continue;
    }
    if (!mapping.providerVariantId) {
      errors.push({
        id: item.id,
        message: "Printful variant id missing in fulfilment mapping.",
      });
      continue;
    }
    const variantId = Number(mapping.providerVariantId);
    if (!Number.isFinite(variantId)) {
      errors.push({
        id: item.id,
        message: "Invalid Printful variant id configured for fulfilment mapping.",
      });
      continue;
    }
    orderItemsPayload.push({
      sync_variant_id: variantId,
      quantity: item.qty,
      external_id: item.id,
    });
  }

  if (errors.length) {
    await Promise.all(
      errors.map((error) =>
        prisma.productOrderItem.update({
          where: { id: error.id },
          data: { fulfilmentStatus: "ERROR", fulfilmentErrorMessage: error.message },
        })
      )
    );
    await prisma.productOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus: "ERROR" },
    });
    return;
  }

  try {
    const client = await createPrintfulClient(organiserId);
    const payload: PrintfulOrderCreatePayload = {
      external_id: `${order.id}:${order.stripeCheckoutSessionId || sessionId}`,
      recipient,
      items: orderItemsPayload,
    };
    const response = await client.createOrder(payload);
    const printfulOrderId = response.json.result?.id;

    if (!printfulOrderId) {
      throw new Error("Printful order response missing id.");
    }

    const costs = response.json.result?.costs || {};
    const printfulSubtotal = parsePrintfulMoney(costs.subtotal);
    const printfulShipping = parsePrintfulMoney(costs.shipping);
    const printfulTax = parsePrintfulMoney(costs.tax);
    const printfulTotal = parsePrintfulMoney(costs.total);
    const printfulCurrency = costs.currency ? String(costs.currency).toLowerCase() : null;

    await prisma.productOrder.update({
      where: { id: order.id },
      data: {
        printfulOrderId: String(printfulOrderId),
        printfulCostSubtotalPence: printfulSubtotal ?? undefined,
        printfulShippingPence: printfulShipping ?? undefined,
        printfulTaxPence: printfulTax ?? undefined,
        printfulTotalPence: printfulTotal ?? undefined,
        printfulCostCurrency: printfulCurrency ?? undefined,
        printfulCostRawJson: response.rawBody ? JSON.parse(response.rawBody) : undefined,
      },
    });

    await prisma.productOrderItem.updateMany({
      where: { id: { in: printfulItems.map((item) => item.id) } },
      data: {
        fulfilmentProviderOrderId: String(printfulOrderId),
        fulfilmentErrorMessage: null,
      },
    });

    const refreshedItems = await prisma.productOrderItem.findMany({
      where: { productOrderId: order.id },
      select: { fulfilmentStatus: true },
    });
    await prisma.productOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus: buildProductOrderFulfilmentStatus(refreshedItems) },
    });

    await refreshProductOrderProfitSnapshot(order.id);
  } catch (err: any) {
    const message = err?.message ? String(err.message) : "Printful fulfilment failed.";
    await prisma.productOrderItem.updateMany({
      where: { id: { in: printfulItems.map((item) => item.id) } },
      data: { fulfilmentStatus: "ERROR", fulfilmentErrorMessage: message },
    });
    await prisma.productOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus: "ERROR" },
    });
  }
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
      const productOrder = await handleProductOrderFromSession(session);
      if (productOrder) {
        await fulfilPrintfulItemsForOrder(productOrder.id, session.id);
      }
      return res.json({ received: true });
    }

    if (hasProductOrder) {
      const productOrder = await handleProductOrderFromSession(session);
      if (productOrder) {
        await fulfilPrintfulItemsForOrder(productOrder.id, session.id);
      }
    }

    if (!orderId || !showId) {
      console.warn("webhook: missing orderId/showId metadata", { orderId, showId });
      return res.json({ received: true });
    }

    const orderIdValue = String(orderId);
    const showIdValue = String(showId);

    // Load order to compute fees precisely
 const order = await prisma.order.findUnique({
  where: { id: orderIdValue },
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
      showIdValue,
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
  where: { id: orderIdValue },
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
    shippingAddressJson: toAddressJson(shippingDetails?.address),
  },
});
// -----------------------------
// CREATE TICKETS (idempotent)
// -----------------------------
let finalTicketCount = 0;

try {
  const existing = await prisma.ticket.count({ where: { orderId: orderIdValue } });

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

    const seatRefMap = await loadSeatRefMapForShow(showIdValue);

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
                orderId: orderIdValue,
                showId: showIdValue,
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
                orderId: orderIdValue,
                showId: showIdValue,
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
            orderId: orderIdValue,
            showId: showIdValue,
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
            orderId: orderIdValue,
            showId: showIdValue,
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

    finalTicketCount = await prisma.ticket.count({ where: { orderId: orderIdValue } });

    console.info("[webhook] tickets created", {
      orderId,
      intended: ticketsToCreate.length,
      finalTicketCount,
    });
  }
} catch (ticketErr: any) {
  console.error("[webhook] ticket creation failed", {
    orderId: orderIdValue,
    message: ticketErr?.message,
    stack: ticketErr?.stack,
  });
}






    // Only send the email the first time we flip to PAID (webhooks retry)
   if (order.status !== "PAID") {
  const showForMarketing = await prisma.show.findUnique({
    where: { id: showIdValue },
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
          MarketingAutomationTriggerType.AFTER_PURCHASE,
          {
            triggerKey: `order:${orderIdValue}`,
            metadata: { orderId: orderIdValue, showId: showIdValue },
          }
        );
      }
    }
    await markCheckoutCompleted(showForMarketing.organiserId, orderIdValue, payerEmail);
  }
  try {
    await refreshCustomerInsightForOrder(orderIdValue);
  } catch (insightErr: any) {
    console.error("[webhook] customer insight refresh failed", {
      orderId: orderIdValue,
      message: insightErr?.message,
      stack: insightErr?.stack,
    });
  }
  try {
    if ((finalTicketCount || 0) > 0) {
      await sendTicketsEmail(orderIdValue);
      console.info("webhook: tickets email sent", { orderId: orderIdValue });
    } else {
      console.warn("[webhook] skipping email send because no tickets exist", { orderId: orderIdValue });
    }
  } catch (emailErr: any) {
    console.error("webhook: confirmation email failed", {
      orderId: orderIdValue,
      message: emailErr?.message,
      stack: emailErr?.stack,
    });
  }
} else {
  console.info("webhook: order already PAID, skipping email", { orderId: orderIdValue });
}


    // Mark sold seats on active seatmap (best-effort)
    if (seatIds.length > 0) {
      const show = await prisma.show.findUnique({
        where: { id: showIdValue },
        select: { activeSeatMapId: true },
      });

      let seatMap =
        show?.activeSeatMapId
          ? await prisma.seatMap.findUnique({ where: { id: show.activeSeatMapId } })
          : null;

      if (!seatMap) {
        seatMap = await prisma.seatMap.findFirst({
          where: { showId: showIdValue },
          orderBy: { updatedAt: "desc" },
        });
      }

      console.log("[webhook] seat sell update", {
        showId: showIdValue,
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
