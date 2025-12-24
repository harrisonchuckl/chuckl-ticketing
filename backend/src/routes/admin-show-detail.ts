// backend/src/routes/admin-show-detail.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { clampBookingFeePence } from "../lib/booking-fee.js";
import { OrderStatus } from '@prisma/client';

const router = Router();

/**
 * GET /admin/shows/:id
 * Returns show details plus KPIs used by the Admin UI (capacity, sold, revenue, etc.)
 */
router.get('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: true,
        ticketTypes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    // Gross paid orders for this show
    const paidOrders = await prisma.order.findMany({
      where: { showId: id, status: OrderStatus.PAID },
      select: { amountPence: true, quantity: true, id: true },
    });

    const revenueGrossPence = paidOrders.reduce((sum, o) => sum + (o.amountPence ?? 0), 0);
    const ticketsSold = paidOrders.reduce((sum, o) => sum + (o.quantity ?? 0), 0);

    // Refunds linked to any order for this show
    const refunds = await prisma.refund.findMany({
      where: { order: { showId: id } },
      select: { amount: true },
    });
    const refundsTotalPence = refunds.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const revenuePence = revenueGrossPence - refundsTotalPence;

    // Capacity & total available (if using inventory on ticket types)
    const capacity = show.venue?.capacity ?? null;
    const totalAvailable = (show.ticketTypes ?? []).reduce(
      (sum, tt) => sum + (tt.available ?? 0),
      0
    );

    const kpis = {
      capacity,
      totalAvailable,
      ticketsSold,
      revenuePence,
    };

    return res.json({ ok: true, show, kpis });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load show' });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 * Add a ticket type to a show.
 * Body: { name: string, pricePence: number, available?: number | null }
 */
router.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    const showId = String(req.params.id);
const { name, pricePence, bookingFeePence, available, onSaleAt, offSaleAt } = req.body || {};

    if (!name || pricePence == null || Number.isNaN(Number(pricePence))) {
      return res
        .status(400)
        .json({ ok: false, message: 'name and pricePence are required' });
    }

   const pricePenceInt = Math.round(Number(pricePence));
const bookingFeePenceClamped = clampBookingFeePence(pricePenceInt, bookingFeePence);

const created = await prisma.ticketType.create({
  data: {
    showId,
    name: String(name),
    pricePence: pricePenceInt,
    bookingFeePence: bookingFeePenceClamped,
    available: available == null ? null : Number(available),
    onSaleAt: onSaleAt ? new Date(onSaleAt) : null,
    offSaleAt: offSaleAt ? new Date(offSaleAt) : null,
  },
});

    return res.json({ ok: true, ticketType });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message ?? 'Failed to add ticket type' });
  }
});

/**
 * PATCH /admin/ticket-types/:ttid
 * Update a ticket type.
 * Body: { name?: string, pricePence?: number, available?: number | null }
 */
router.patch('/ticket-types/:ttid', async (req, res) => {
  const ttid = String(req.params.ttid || "");
  const { name, pricePence, bookingFeePence, available, onSaleAt, offSaleAt } = req.body || {};

  const existing = await prisma.ticketType.findUnique({
    where: { id: ttid },
    select: { pricePence: true, bookingFeePence: true },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });

  const hasPrice = pricePence !== undefined;
  const hasFee = bookingFeePence !== undefined;

  const effectivePricePence = hasPrice ? Math.round(Number(pricePence)) : existing.pricePence;
  if (!Number.isFinite(effectivePricePence) || effectivePricePence < 0) {
    return res.status(400).json({ error: "invalid_price" });
  }

  const effectiveFeeInput = hasFee ? bookingFeePence : existing.bookingFeePence;
  const bookingFeePenceClamped = clampBookingFeePence(effectivePricePence, effectiveFeeInput);

  const data: any = {};
  if (name !== undefined) data.name = String(name);
  if (hasPrice) data.pricePence = effectivePricePence;
  if (hasFee || hasPrice) data.bookingFeePence = bookingFeePenceClamped;

  if (available !== undefined) data.available = available == null ? null : Number(available);
  if (onSaleAt !== undefined) data.onSaleAt = onSaleAt ? new Date(onSaleAt) : null;
  if (offSaleAt !== undefined) data.offSaleAt = offSaleAt ? new Date(offSaleAt) : null;

  const updated = await prisma.ticketType.update({
    where: { id: ttid },
    data,
  });

  return res.json({ ok: true, ticketType: updated });
});

/**
 * DELETE /admin/ticket-types/:ttid
 * Delete a ticket type by id.
 */
router.delete('/ticket-types/:ttid', async (req, res) => {
  try {
    const id = String(req.params.ttid);

    await prisma.ticketType.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message ?? 'Failed to delete ticket type' });
  }
});

export default router;
