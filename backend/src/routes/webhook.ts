import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const router = Router();

/**
 * Mounted with express.raw({ type: 'application/json' }) at /webhooks in server.ts
 */
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) {
      console.error('Missing Stripe signature or webhook secret');
      return res.status(400).send('bad_request');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      console.error('❌ Stripe signature verification failed:', err?.message || err);
      return res.status(400).send('signature_error');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // We put orderId into metadata when creating the session
      const orderId = (session.metadata?.orderId || '').toString();
      if (!orderId) {
        console.warn('checkout.session.completed received but no orderId in metadata');
        return res.json({ ok: true });
      }

      // Minimal update: mark order PAID (your schema does not have paidAt/items/tickets)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      });

      console.log(`✅ Order ${orderId} marked PAID (minimal webhook)`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.stack || err);
    res.status(500).send('server_error');
  }
});

export default router;
