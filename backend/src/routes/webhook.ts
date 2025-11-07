// backend/src/routes/webhook.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/db.js';

const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Stripe webhooks (raw body set up in server.ts)
router.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Missing Stripe signature or webhook secret');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session?.metadata?.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'PAID' },
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const orderId = charge?.metadata?.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'REFUNDED' }, // ✅ Matches new enum
          });
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    res.status(500).send(`Webhook handler error: ${e?.message || 'Unknown error'}`);
  }
});

export default router;
