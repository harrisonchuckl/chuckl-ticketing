// backend/src/routes/webhook.ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail } from '../services/email.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
export const router = Router();

router.post('/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).send('Missing signature');

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type === 'checkout.session.completed') {
      const session: any = event.data.object;
      const orderId = session.metadata?.orderId;

      if (!orderId) return res.status(400).json({ ok: false, error: 'Missing orderId' });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          show: { include: { venue: true } },
          tickets: true
        }
      });

      if (!order) return res.status(404).json({ ok: false, error: 'order not found' });

      const show = {
        id: order.show.id,
        title: order.show.title,
        date: order.show.date,
        venue: order.show.venue
          ? {
              name: order.show.venue.name,
              address: order.show.venue.address,
              city: order.show.venue.city,
              postcode: order.show.venue.postcode
            }
          : null
      };

      const tickets = order.tickets.map((t: any) => ({
        serial: t.serial,
        status: t.status
      }));

      await sendTicketsEmail(order.email, show, tickets);
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
