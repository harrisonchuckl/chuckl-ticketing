// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { Prisma } from '@prisma/client';
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

    // Already fully refunded?
    if (order.status === 'REFUNDED') {
      return res.status(400).json({ ok: false, message: 'Order already refunded' });
    }

    // Call Stripe
    const refund = await createRefund({
      paymentIntentId: order.stripeId,
      amountPence: amountPence ? Number(amountPence) : undefined,
      reason,
      metadata: { orderId: order.id },
    });

    // Save refund in DB
    await prisma.refund.create({
      data: {
        orderId: order.id,
        stripeId: refund.id,
        amount: refund.amount ?? 0,
        reason: reason || 'manual_refund',
      },
    });

    // If it’s a full refund (or Stripe says succeeded), mark order refunded
    if (!amountPence || refund.status === 'succeeded') {
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
 * Return full order details including tickets, refunds and notes.
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
        // If you have OrderNote model:
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
 * Search orders by email, stripeId or show title.
 */
router.get('/orders', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Number(req.query.limit || 50);

    const where: Prisma.OrderWhereInput | undefined = q
      ? {
          OR: [
            // email is nullable in schema, so use StringNullableFilter with QueryMode
            { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { stripeId: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { show: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
      : undefined;

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
