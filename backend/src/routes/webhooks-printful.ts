import express, { Router } from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { ProductOrderFulfilmentStatus, ProductOrderItem, ProductOrderItemStatus } from "@prisma/client";

const router = Router();

function buildProductOrderFulfilmentStatus(items: Array<{ fulfilmentStatus: ProductOrderItemStatus }>) {
  if (items.some((item) => item.fulfilmentStatus === ProductOrderItemStatus.ERROR)) {
    return ProductOrderFulfilmentStatus.ERROR;
  }
  const fulfilledCount = items.filter((item) => item.fulfilmentStatus === ProductOrderItemStatus.FULFILLED).length;
  if (fulfilledCount === 0) return ProductOrderFulfilmentStatus.UNFULFILLED;
  if (fulfilledCount === items.length) return ProductOrderFulfilmentStatus.FULFILLED;
  return ProductOrderFulfilmentStatus.PARTIAL;
}

function safeJsonParse(input: Buffer) {
  try {
    return JSON.parse(input.toString("utf8"));
  } catch {
    return null;
  }
}

function isSignatureValid(secret: string, payload: Buffer, signature: string) {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function extractTracking(orderData: any) {
  const shipment = Array.isArray(orderData?.shipments) ? orderData.shipments[0] : null;
  const trackingNumber =
    shipment?.tracking_number ||
    orderData?.tracking_number ||
    orderData?.shipping?.tracking_number ||
    orderData?.tracking?.number ||
    null;
  const trackingUrl =
    shipment?.tracking_url ||
    orderData?.tracking_url ||
    orderData?.shipping?.tracking_url ||
    orderData?.tracking?.url ||
    null;
  const trackingCarrier =
    shipment?.carrier ||
    orderData?.shipping?.carrier ||
    orderData?.tracking?.carrier ||
    null;

  return {
    trackingNumber: trackingNumber ? String(trackingNumber) : null,
    trackingUrl: trackingUrl ? String(trackingUrl) : null,
    trackingCarrier: trackingCarrier ? String(trackingCarrier) : null,
  };
}

router.post("/printful", express.raw({ type: "*/*" }), async (req, res) => {
  const secret = String(process.env.PRINTFUL_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Printful webhook secret not configured" });
  }

  const signature = String(req.headers["x-pf-signature"] || req.headers["x-printful-signature"] || "").trim();
  if (!signature || !isSignatureValid(secret, req.body, signature)) {
    return res.status(401).json({ ok: false, error: "Invalid signature" });
  }

  const payload = safeJsonParse(req.body);
  if (!payload) {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  const eventType = String(payload.type || payload.event || payload.name || "").toLowerCase();
  const orderData = payload.data?.order || payload.order || payload.data || payload.result || {};
  const status = String(orderData?.status || payload.status || "").toLowerCase();

  const printfulOrderId = orderData?.id || orderData?.order_id || payload.order_id || payload.orderId || null;
  const externalId = String(orderData?.external_id || payload.external_id || payload.data?.external_id || "").trim();
  const externalOrderId = externalId ? externalId.split(":")[0] : null;

  let items: ProductOrderItem[] = [];
  if (printfulOrderId) {
    items = await prisma.productOrderItem.findMany({
      where: { fulfilmentProviderOrderId: String(printfulOrderId) },
    });
  }
  if (!items.length && externalOrderId) {
    items = await prisma.productOrderItem.findMany({
      where: { productOrderId: externalOrderId, fulfilmentTypeSnapshot: "PRINTFUL" },
    });
  }

  if (!items.length) {
    return res.json({ ok: true, received: true });
  }

  const shouldMarkFulfilled =
    eventType.includes("shipped") || eventType.includes("fulfilled") || status === "shipped" || status === "fulfilled";
  const shouldMarkError =
    eventType.includes("fail") ||
    eventType.includes("cancel") ||
    status.includes("fail") ||
    status.includes("cancel") ||
    status.includes("error");

  if (!shouldMarkFulfilled && !shouldMarkError) {
    return res.json({ ok: true, received: true });
  }

  const tracking = extractTracking(orderData);
  const orderId = items[0]?.productOrderId;
  const itemIds = items.map((item) => item.id);

  if (shouldMarkFulfilled) {
    await prisma.productOrderItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        fulfilmentStatus: "FULFILLED",
        fulfilmentErrorMessage: null,
        trackingNumber: tracking.trackingNumber,
        trackingUrl: tracking.trackingUrl,
        trackingCarrier: tracking.trackingCarrier,
      },
    });
  } else if (shouldMarkError) {
    await prisma.productOrderItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        fulfilmentStatus: "ERROR",
        fulfilmentErrorMessage: payload.message ? String(payload.message) : "Printful fulfilment failed.",
      },
    });
  }

  if (orderId) {
    const refreshedItems = await prisma.productOrderItem.findMany({
      where: { productOrderId: orderId },
      select: { fulfilmentStatus: true },
    });
    await prisma.productOrder.update({
      where: { id: orderId },
      data: { fulfilmentStatus: buildProductOrderFulfilmentStatus(refreshedItems) },
    });
  }

  return res.json({ ok: true, received: true });
});

export default router;
