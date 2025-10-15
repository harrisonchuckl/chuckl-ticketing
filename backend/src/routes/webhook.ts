import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { sendTicketsEmail } from '../services/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
export const router = Router();

function randomSerial(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return res.status(400).send('bad_request');

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
      const customerEmail = session.customer_details?.email || session.customer_email || undefined;
      if (!orderId || !showId) return res.json({ ok: true, skipped: true });

      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        select: { id: true, quantity: true, showId: true, amountPence: true, email: true }
      });

      const existingCount = await prisma.ticket.count({ where: { orderId: order.id } });
      if (existingCount > 0) return res.json({ received: true, alreadyIssued: true });

      const count = Math.max(1, order.quantity);
      const ticketsData = Array.from({ length: count }).map(() => {
        const serial = randomSerial(12);
        return { orderId: order.id, showId: order.showId, serial, qrData: `chuckl:${serial}`, status: 'VALID' as const };
      });
      await prisma.ticket.createMany({ data: ticketsData });

      const [tickets, show] = await Promise.all([
        prisma.ticket.findMany({ where: { orderId: order.id }, select: { serial: true, qrData: true } }),
        prisma.show.findUnique({
          where: { id: showId },
          select: { id: true, title: true, date: true, venue: { select: { name: true, address: true, city: true, postcode: true } } }
        })
      ]);

      const to = customerEmail || order.email;
      if (show && to) {
        try {
          await sendTicketsEmail({
            to,
            show,
            order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
            tickets
          });
        } catch (e: any) {
          console.error('📧 Email send failed:', e?.message || e);
        }
      } else {
        console.warn('Skipping email: missing show or recipient email');
      }

      console.log(`🎟️  Issued ${count} ticket(s) and emailed ${to} for order ${order.id}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.stack || err);
    res.status(500).send('server_error');
  }
});

export default router;
