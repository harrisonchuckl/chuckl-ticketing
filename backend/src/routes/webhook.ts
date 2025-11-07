// backend/src/routes/webhook.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('Webhook signature failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const order = await prisma.order.findFirst({ where: { stripeId: intent.id } });
        if (order) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PAID' }
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const refundList = charge.refunds?.data || [];
        const existingOrder = await prisma.order.findFirst({
          where: { stripeId: charge.payment_intent as string }
        });
        if (existingOrder) {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: { status: 'REFUNDED' }
          });

          for (const ref of refundList) {
            const exists = await prisma.refund.findFirst({ where: { stripeId: ref.id } });
            if (!exists) {
              await prisma.refund.create({
                data: {
                  stripeId: ref.id,
                  orderId: existingOrder.id,
                  amount: ref.amount || 0,
                  reason: ref.reason || null
                }
              });
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Webhook processing failed', e);
    res.status(500).send('Webhook handling error');
  }
});

export default router;
