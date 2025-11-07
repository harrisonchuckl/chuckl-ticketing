// backend/src/routes/webhook.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/db.js';
import { OrderStatus } from '@prisma/client';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

// Verify + parse Stripe event from raw body (server.ts mounts bodyParser.raw on this route)
router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (whSecret && sig) {
      // req.body is a Buffer because server.ts uses bodyParser.raw for this route
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, whSecret);
    } else {
      // Fallback if no webhook secret is configured
      event = JSON.parse((req.body as any)?.toString?.() || req.body) as Stripe.Event;
    }
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // Mark orders as paid when the payment intent succeeds
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = pi.id;

        // Update any order with this payment intent stripeId
        await prisma.order.updateMany({
          where: { stripeId: paymentIntentId },
          data: { status: OrderStatus.PAID },
        });
        break;
      }

      // Handle refunds created (either API or dashboard)
      case 'refund.created':
      case 'charge.refunded': {
        // refund.created gives us a Refund object directly
        // charge.refunded contains a Charge object with refunds — handle primary fields
        let paymentIntentId = '';
        let amount = 0;
        let refundId = '';
        let reason: string | null = null;

        if (event.type === 'refund.created') {
          const refund = event.data.object as Stripe.Refund;
          refundId = refund.id;
          paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : (refund.payment_intent as Stripe.PaymentIntent).id;
          amount = refund.amount || 0;
          reason = refund.reason ?? null;
        } else {
          const charge = event.data.object as Stripe.Charge;
          paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent as Stripe.PaymentIntent).id;
          // Use the first refund item if present
          const r = charge.refunds?.data?.[0];
          if (r) {
            refundId = r.id;
            amount = r.amount || 0;
            reason = r.reason ?? null;
          }
        }

        if (!paymentIntentId || amount <= 0 || !refundId) break;

        // Find the order
        const order = await prisma.order.findFirst({
          where: { stripeId: paymentIntentId },
          include: { refunds: true },
        });
        if (!order) break;

        // Idempotency: avoid duplicate refund rows by Stripe refund id
        const existing = await prisma.refund.findFirst({ where: { stripeId: refundId } });
        if (!existing) {
          await prisma.refund.create({
            data: {
              amount,
              reason,
              stripeId: refundId,
              orderId: order.id,
            },
          });
        }

        // Work out if the order is now fully refunded
        const totalPaid = order.amountPence ?? 0;
        const alreadyRefunded = (order.refunds || []).reduce((sum, r) => sum + (r.amount || 0), 0);
        const newRefunded = existing ? alreadyRefunded : alreadyRefunded + amount;
        const isFullyRefunded = newRefunded >= totalPaid && totalPaid > 0;

        if (isFullyRefunded) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.REFUNDED },
          });
        }
        break;
      }

      // You can add more events as needed
      default:
        // No-op for unhandled events
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Webhook processing failed' });
  }
});

export default router;
