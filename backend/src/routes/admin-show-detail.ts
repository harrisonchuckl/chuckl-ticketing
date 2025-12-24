// backend/src/routes/admin-show-detail.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { clampBookingFeePence } from '../lib/booking-fee.js';
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

    const bookingFeePenceValue = clampBookingFeePence(Number(pricePence), bookingFeePence);

    const ticketType = await prisma.ticketType.create({
      data: {
        name: String(name),
        pricePence: Number(pricePence),
        bookingFeePence: bookingFeePenceValue,
        available: available === '' || available === undefined ? null : Number(available),
        onSaleAt: onSaleAt ? new Date(onSaleAt) : null,
        offSaleAt: offSaleAt ? new Date(offSaleAt) : null,
        show: { connect: { id: showId } },
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
  try {
    const id = String(req.params.ttid);
    const { name, pricePence, bookingFeePence, available, onSaleAt, offSaleAt } = req.body || {};

    const data: any = {};
    if (name !== undefined) data.name = String(name);
    if (pricePence !== undefined) data.pricePence = Number(pricePence);
    if (bookingFeePence !== undefined) {
      const priceForFee = pricePence !== undefined ? Number(pricePence) : undefined;
      if (priceForFee !== undefined) {
        data.bookingFeePence = clampBookingFeePence(priceForFee, bookingFeePence);
      } else {
        data.bookingFeePence = Math.max(0, Math.round(Number(bookingFeePence)));
      }
    }
    if (available !== undefined) {
      data.available = available === '' || available === undefined ? null : Number(available);
    }
    if (onSaleAt !== undefined) data.onSaleAt = onSaleAt ? new Date(onSaleAt) : null;
    if (offSaleAt !== undefined) data.offSaleAt = offSaleAt ? new Date(offSaleAt) : null;

    const updated = await prisma.ticketType.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message ?? 'Failed to update ticket type' });
  }
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
