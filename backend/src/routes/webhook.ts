import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { sendEmail } from '../services/email.js';
import { makeTicketQR } from '../services/qrcode.js';

export const router = express.Router();

router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as any, sig as string, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${(err as any).message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId as string;
    if (orderId) {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAID' },
          include: { show: true, items: true }
        });

        for (const it of order.items) {
          await tx.ticketType.update({
            where: { id: it.ticketTypeId },
            data: { sold: { increment: it.quantity } }
          });
        }
        await tx.show.update({
          where: { id: order.showId },
          data: { sold: { increment: order.quantity } }
        });

        const tickets = [];
        for (let i = 0; i < order.quantity; i++) {
          const serial = `CH-${order.showId.slice(0, 6)}-${order.id.slice(0, 6)}-${i + 1}`;
          const qrData = JSON.stringify({ orderId: order.id, serial });
          const t = await tx.ticket.create({
            data: { orderId: order.id, showId: order.showId, serial, qrData, status: 'VALID' }
          });
          tickets.push(t);
        }

        // Email QR (single code pointing to verify endpoint as placeholder)
        const qr = await makeTicketQR(`https://api.example.com/verify?o=${order.id}`);
        const html = `<p>Thanks for your purchase!</p>
                      <p>Show: <b>${order.show.title}</b> on ${order.show.startsAtUTC.toISOString()}</p>
                      <p>Present this code at entry.</p>`;
        await sendEmail(order.email, 'Your Chuckl tickets', html, [
          { filename: 'ticket-qr.png', content: qr.split(',')[1], encoding: 'base64' }
        ]);
      });
    }
  }

  res.json({ received: true });
});
