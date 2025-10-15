import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const router = Router();

// Random friendly serial (avoids ambiguous chars)
function randomSerial(len = 12) {
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

      // We stored these in metadata when creating the session
      const orderId = session.metadata?.orderId;
      const showId = session.metadata?.showId;

      if (!orderId || !showId) {
        console.warn('checkout.session.completed without orderId/showId metadata');
        return res.json({ ok: true, skipped: true });
      }

      // 1) Mark order PAID and load quantity
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        select: { id: true, quantity: true, showId: true },
      });

      // 2) Idempotency: if tickets already exist, do nothing
      const existingCount = await prisma.ticket.count({ where: { orderId: order.id } });
      if (existingCount > 0) {
        console.log(`ℹ️  Order ${order.id} already has ${existingCount} ticket(s). Skipping create.`);
        return res.json({ received: true, alreadyIssued: true });
      }

      // 3) Create N tickets for the order quantity
      const count = Math.max(1, order.quantity);
      const ticketsData = Array.from({ length: count }).map(() => {
        const serial = randomSerial(12);
        return {
          orderId: order.id,
          showId: order.showId,
          serial,
          qrData: `chuckl:${serial}`, // simple QR payload; upgrade later if you like
          status: 'VALID' as const,
        };
      });

      await prisma.ticket.createMany({ data: ticketsData });

      console.log(`🎟️  Issued ${count} ticket(s) for order ${order.id}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.stack || err);
    res.status(500).send('server_error');
  }
});

export default router;
