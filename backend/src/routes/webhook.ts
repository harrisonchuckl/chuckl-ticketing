import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const router = Router();

/**
 * Stripe sends a raw body (we mounted express.raw in server.ts).
 * DO NOT use express.json() here.
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
      return res.status(400).send(`signature_error`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // We stored orderId in metadata when creating the session
      const orderId = (session.metadata?.orderId || '').toString();
      const email = (session.customer_details?.email || session.customer_email || '').toString();

      if (!orderId) {
        console.error('checkout.session.completed but no orderId in metadata');
        return res.json({ ok: true });
      }

      // Mark order paid (idempotent)
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        include: {
          items: { include: { ticketType: true } },
          tickets: true,
          user: true,
        },
      });

      // Allocate tickets if none exist yet (idempotent safety)
      if (order.tickets.length === 0) {
        const createTickets = order.items.flatMap((it) =>
          Array.from({ length: it.quantity }).map(() => ({
            orderId: order.id,
            showId: it.ticketType.showId,
            ticketTypeId: it.ticketTypeId,
            // add any fields you use for QR / validation
          }))
        );

        if (createTickets.length > 0) {
          await prisma.ticket.createMany({ data: createTickets });
        }

        // increment sold counts (per item)
        for (const it of order.items) {
          await prisma.ticketType.update({
            where: { id: it.ticketTypeId },
            data: { sold: { increment: it.quantity } },
          });
        }
      }

      console.log(`✅ Order ${orderId} marked PAID and tickets issued`);

      // Try to send email if SMTP configured
      try {
        if (process.env.SMTP_HOST && email) {
          const { sendOrderEmail } = await import('../services/email.js');
          await sendOrderEmail(orderId, email);
          console.log(`✉️ Ticket email queued for ${email}`);
        } else {
          console.log('SMTP not configured or email missing; skipping email send');
        }
      } catch (e: any) {
        console.error('Email send failed:', e?.message || e);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err?.stack || err);
    res.status(500).send('server_error');
  }
});

export default router;
