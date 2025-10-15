import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const router = Router();

function randomCode(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/**
 * Mounted at /webhooks with express.raw({ type: 'application/json' }) in server.ts
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

      const orderId = session.metadata?.orderId;
      const showId = session.metadata?.showId;

      if (!orderId || !showId) {
        console.warn('checkout.session.completed without orderId/showId metadata');
        return res.json({ ok: true, skipped: true });
      }

      // 1) Mark order PAID and fetch quantity + showId
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        select: { id: true, quantity: true, showId: true },
      });

      // 2) Create N tickets (MVP: one ticket per quantity purchased)
      const count = Math.max(1, order.quantity);
      const tickets = Array.from({ length: count }).map(() => ({
        orderId: order.id,
        showId: order.showId,
        code: randomCode(12),
      }));

      await prisma.ticket.createMany({ data: tickets, skipDuplicates: true });

      console.log(`🎟️  Issued ${count} tickets for order ${orderId}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.stack || err);
    res.status(500).send('server_error');
  }
});

export default router;
