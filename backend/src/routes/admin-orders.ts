// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { createRefund } from '../services/stripe.js';

const router = Router();

// ===== Orders List & Detail (same as before, trimmed where unchanged) =====
router.get('/orders', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { stripeId: { contains: q, mode: 'insensitive' } },
      ];
    }
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { show: true },
    });
    res.json({ ok: true, orders });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: {
        show: { select: { id: true, title: true, date: true } },
        tickets: true,
        refunds: true,
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// ===== Refunds =====

/**
 * POST /admin/orders/:id/refund
 * body: { amountPence?: number, reason?: string }
 * Creates a Stripe refund (full if no amount)
 */
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const orderId = String(req.params.id);
    const { amountPence, reason } = req.body || {};
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.stripeId) {
      return res.status(400).json({ error: true, message: 'Order or Stripe charge missing' });
    }

    const refund = await createRefund(order.stripeId, amountPence || order.amountPence, reason);

    // record in db
    const record = await prisma.refund.create({
      data: {
        orderId,
        amount: refund.amount,
        reason: reason || null,
        stripeId: refund.id,
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED' },
    });

    res.json({ ok: true, refund: record });
  } catch (e: any) {
    console.error('Refund error', e);
    res.status(500).json({ error: true, message: e.message || 'Failed to create refund' });
  }
});

export default router;
