// backend/src/routes/webhook.ts
//
// Stripe webhook handler. Mounted with raw body in server.ts:
// app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);
//
// Handles:
// - payment_intent.succeeded  -> mark order PAID, compute/stash platform fees
// - charge.refunded / refund.created -> mark order REFUNDED (best-effort)
//
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { calcFeesForVenue } from '../services/fees.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  // We store PaymentIntent ID in Order.stripeId (consistent with the checkout flow).
  const order = await prisma.order.findUnique({
    where: { stripeId: pi.id },
    include: {
      show: {
        include: {
          venue: true, // include venue fee config
        },
      },
    },
  });

  if (!order) return;

  // Defensive: compute subtotal from tickets or from order.amountPence if you store gross
  // Here we assume order.amountPence is the gross (tickets only, before platform fee),
  // adjust if needed for your flow.
  const subtotalPence = Math.max(0, order.amountPence ?? 0);
  const qty = Math.max(0, order.quantity ?? 0);

  const venueCfg = order.show?.venue
    ? {
        perTicketFeePence: (order.show.venue as any).perTicketFeePence ?? 0,
        basketFeePence: (order.show.venue as any).basketFeePence ?? 0,
        feePercent: (order.show.venue as any).feePercent ?? 0,
        organiserSharePercent: (order.show.venue as any).organiserSharePercent ?? 0,
      }
    : null;

  const fee = calcFeesForVenue({
    venue: venueCfg,
    ticketCount: qty,
    subtotalPence,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      platformFeePence: fee.platformFeePence, // field exists on your Order type per your earlier logs
      // If you later add organiserSharePence to schema, you can persist: organiserSharePence: fee.organiserSharePence
    },
  });
}

async function markOrderRefundedByChargeId(chargeId: string) {
  // If you stored PaymentIntent on order.stripeId, we can look up the PI for the charge,
  // but an easier best-effort path is: find the PaymentIntent from charge and then use its id.
  try {
    const ch = await stripe.charges.retrieve(chargeId);
    const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
    if (!piId) return;
    const order = await prisma.order.findUnique({ where: { stripeId: piId } });
    if (!order) return;
    await prisma.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
  } catch {
    /* noop */
  }
}

export default async function webhook(req: Request, res: Response) {
  let event: Stripe.Event;

  // Verify signature if a secret is set; otherwise trust the payload (not recommended in prod)
  if (WH_SECRET) {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WH_SECRET);
    } catch (err: any) {
      return res.status(400).send(`Webhook signature verification failed: ${err?.message || String(err)}`);
    }
  } else {
    try {
      event = JSON.parse(req.body.toString());
    } catch (e) {
      return res.status(400).send('Invalid JSON body');
    }
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(pi);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.id) await markOrderRefundedByChargeId(charge.id);
        break;
      }
      case 'refund.created': {
        const refund = event.data.object as Stripe.Refund;
        if (refund.charge && typeof refund.charge === 'string') {
          await markOrderRefundedByChargeId(refund.charge);
        }
        break;
      }
      default:
        // ignore other events gracefully
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: true, message: e?.message ?? 'Webhook handler failure' });
  }
}
