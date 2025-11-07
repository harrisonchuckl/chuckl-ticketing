// backend/src/routes/webhook.ts
import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/db.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('Webhook signature error', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'charge.refunded':
      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        const stripeId = refund.id;
        const amount = refund.amount;
        const status = refund.status;
        const chargeId = refund.charge as string | undefined;

        const existing = await prisma.refund.findUnique({ where: { stripeId } });
        if (existing) {
          await prisma.refund.update({
            where: { stripeId },
            data: { amount, reason: refund.reason || null },
          });
        } else {
          // Try to find order by chargeId
          const order = chargeId
            ? await prisma.order.findFirst({ where: { stripeId: chargeId } })
            : null;
          if (order) {
            await prisma.refund.create({
              data: {
                orderId: order.id,
                amount,
                reason: refund.reason || null,
                stripeId,
              },
            });
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'REFUNDED' },
            });
          }
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error', err);
    res.status(500).send('Webhook processing error');
  }
});

export default router;
