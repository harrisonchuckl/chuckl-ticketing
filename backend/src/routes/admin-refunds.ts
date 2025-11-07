// backend/src/routes/admin-refunds.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

/**
 * POST /admin/refunds
 * body: { orderId: string, amountPence?: number, reason?: string, createdBy?: string }
 */
router.post('/refunds', async (req, res) => {
  try {
    const { orderId, amountPence, reason, createdBy } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, message: 'orderId required' });

    const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
    if (!order || !order.stripeId) {
      return res.status(404).json({ ok: false, message: 'Order or Stripe ID not found' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: order.stripeId,
      amount: amountPence || order.amountPence || undefined,
      reason: reason ? 'requested_by_customer' : undefined,
      metadata: { orderId, note: reason || '' }
    });

    await prisma.refund.create({
      data: {
        amount: refund.amount,
        reason: reason || null,
        stripeId: refund.id,
        orderId: order.id,
        createdBy: createdBy || 'admin'
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' }
    });

    res.json({ ok: true, refund });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, message: e.message || 'Refund failed' });
  }
});

/**
 * GET /admin/refunds/:orderId
 * Lists all refunds for an order.
 */
router.get('/refunds/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const refunds = await prisma.refund.findMany({
      where: { orderId: String(orderId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ ok: true, refunds });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message || 'Failed to load refunds' });
  }
});

export default router;
