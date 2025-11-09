// backend/src/routes/webhook.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { calcFeesForShow } from '../services/fees.js';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });

const router = Router();

router.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;

      const order = await prisma.order.findFirst({
        where: { stripeId: pi.id },
        select: { id: true, showId: true, quantity: true, subtotalPence: true },
      });
      if (!order) return res.json({ ok: true });

      const fees = await calcFeesForShow({
        prisma,
        showId: order.showId as string,
        quantity: order.quantity ?? 0,
        subtotalPence: order.subtotalPence ?? 0,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          platformFeePence: fees.platformFeePence,
          organiserFeePence: fees.organiserFeePence,
          paymentFeePence: 0,
          netPayoutPence: (order.subtotalPence ?? 0) + fees.organiserFeePence - 0,
        },
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await prisma.order.updateMany({
        where: { stripeId: pi.id },
        data: { status: 'CANCELLED' },
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook handler error', err);
    res.status(500).json({ ok: false });
  }
});

export default router;
