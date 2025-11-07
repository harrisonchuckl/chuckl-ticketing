// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { createRefund } from '../services/stripe.js';

const router = Router();

/**
 * POST /admin/orders/:id/refund
 * Issue a partial or full refund for an order.
 */
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { amountPence, reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { refunds: true },
    });

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }
    if (!order.stripeId) {
      return res.status(400).json({ ok: false, message: 'No Stripe payment ID found for this order' });
    }

    // Check if already refunded
    if (order.status === 'REFUNDED') {
      return res.status(400).json({ ok: false, message: 'Order already refunded' });
    }

    // Send refund request to Stripe
    const refund = await createRefund({
      paymentIntentId: order.stripeId,
      amountPence: amountPence ? Number(amountPence) : undefined,
      reason,
      metadata: { orderId: order.id },
    });

    // Record refund in DB
    await prisma.refund.create({
      data: {
        orderId: order.id,
        stripeId: refund.id,
        amount: refund.amount ?? 0,
        reason: reason || 'manual_refund',
      },
    });

    // Update order status if full refund
    if (!amountPence || (refund.status && refund.status === 'succeeded')) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });
    }

    res.json({ ok: true, refund });
  } catch (err: any) {
    console.error('Refund failed:', err);
    res.status(500).json({ ok: false, message: err.message || 'Refund failed' });
  }
});

/**
 * GET /admin/orders/:id
 * Returns full order details including tickets and notes.
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        show: { include: { venue: true } },
        tickets: true,
        refunds: true,
        notes: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (err: any) {
    console.error('Fetch order failed:', err);
    res.status(500).json({ ok: false, message: 'Fetch failed' });
  }
});

/**
 * GET /admin/orders
 * Basic order search endpoint
 */
router.get('/orders', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Number(req.query.limit || 50);

    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { stripeId: { contains: q, mode: 'insensitive' } },
            { show: { title: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};

    const items = await prisma.order.findMany({
      where,
      include: { show: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ ok: true, items });
  } catch (err: any) {
    console.error('Load orders failed:', err);
    res.status(500).json({ ok: false, message: 'Failed to load orders' });
  }
});

export default router;
