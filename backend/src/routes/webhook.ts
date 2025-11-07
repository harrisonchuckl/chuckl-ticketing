// backend/src/routes/webhook.ts
import type { Request, Response } from 'express';
import prisma from '../lib/db.js';
import stripe from '../services/stripe.js';

const webhookHandler = async (req: Request, res: Response) => {
  // Stripe requires the raw body (server.ts already provides bodyParser.raw for this route)
  const sig = req.headers['stripe-signature'];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return res.status(400).send('Webhook signature/secret missing');
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, whSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      /**
       * We handle refunds via:
       *  - charge.refunded (fires when a charge is fully or partially refunded)
       *  - refund.updated / refund.succeeded (idempotent per refund.id)
       *
       * We locate the Order via either:
       *  - order.stripeId === charge.payment_intent (most common in our flow)
       *  - OR order.stripeId === charge.id (fallback if we stored the charge id)
       */
      case 'charge.refunded': {
        const charge = event.data.object as {
          id: string;
          amount: number;
          amount_refunded: number;
          payment_intent?: string | null;
          refunds?: { data?: Array<{ id: string; amount: number; status?: string }> };
        };

        const candidateStripeIds: string[] = [];
        if (charge.payment_intent) candidateStripeIds.push(String(charge.payment_intent));
        candidateStripeIds.push(charge.id);

        const order = await prisma.order.findFirst({
          where: {
            stripeId: { in: candidateStripeIds },
          },
        });

        if (!order) {
          console.warn('charge.refunded: Order not found for charge', charge.id, candidateStripeIds);
          break;
        }

        const refundItems = charge.refunds?.data ?? [];
        for (const rf of refundItems) {
          const existing = await prisma.refund.findFirst({
            where: { stripeId: rf.id },
          });
          if (!existing) {
            await prisma.refund.create({
              data: {
                stripeId: rf.id,
                amount: rf.amount,
                reason: 'stripe_refund',
                orderId: order.id,
              },
            });
          }
        }

        // If fully refunded, flip order status to REFUNDED
        if ((charge.amount_refunded ?? 0) >= (charge.amount ?? 0)) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'REFUNDED' },
          });
        }
        break;
      }

      case 'refund.succeeded':
      case 'refund.updated': {
        const refund = event.data.object as {
          id: string;
          amount: number;
          charge?: string | null;
          payment_intent?: string | null;
          status?: string;
        };

        // Try to locate the associated Order
        const candidateStripeIds: string[] = [];
        if (refund.payment_intent) candidateStripeIds.push(String(refund.payment_intent));
        if (refund.charge) candidateStripeIds.push(String(refund.charge));

        const order = await prisma.order.findFirst({
          where: { stripeId: { in: candidateStripeIds } },
        });

        if (!order) {
          console.warn('refund.*: Order not found for refund', refund.id, candidateStripeIds);
          break;
        }

        // Idempotent: create a refund row if we haven't yet
        const existing = await prisma.refund.findFirst({
          where: { stripeId: refund.id },
        });

        if (!existing) {
          await prisma.refund.create({
            data: {
              stripeId: refund.id,
              amount: refund.amount,
              reason: 'stripe_refund',
              orderId: order.id,
            },
          });
        } else {
          // Optionally update reason/amount if needed
          await prisma.refund.update({
            where: { id: existing.id },
            data: {
              amount: refund.amount ?? existing.amount,
            },
          });
        }

        // If Stripe has fully refunded (we can infer separately if needed), we leave
        // order status as-is here. Full-refund status flip is handled in charge.refunded.
        break;
      }

      default: {
        // Ignore other event types for now
        // console.log(`Unhandled Stripe event type ${event.type}`);
        break;
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Webhook handler failed' });
  }
};

export default webhookHandler;
