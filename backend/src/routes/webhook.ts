import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { calcFeesForVenue } from '../services/fees.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const router = Router();

// Mounted at /webhooks/stripe with raw body in server.ts
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = (session.metadata && session.metadata.orderId) || null;
        if (!orderId) break;

        // Retrieve PaymentIntent and expand charges → balance_transaction for Stripe fees.
        let pi: Stripe.PaymentIntent | null = null;
        if (session.payment_intent) {
          // NOTE: Treat retrieve() as returning a PaymentIntent directly (no Response wrapper).
          pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
            expand: ['charges.data.balance_transaction'],
          });
        }

        let chargeId: string | null = null;
        let stripeFeePence: number | null = null;

        if (pi?.charges?.data?.length) {
          const ch = pi.charges.data[0];
          chargeId = ch.id;
          const bt = ch.balance_transaction as Stripe.BalanceTransaction | null;
          if (bt && typeof bt.fee === 'number' && bt.currency === 'gbp') {
            stripeFeePence = bt.fee; // already in minor units
          }
        }

        const ord = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            amountPence: true,
            quantity: true,
            stripeId: true,
            show: {
              select: {
                venue: {
                  select: {
                    feePercentBps: true,
                    feePerTicketPence: true,
                    basketFeePence: true,
                    feeShareBps: true,
                  },
                },
              },
            },
          },
        });
        if (!ord) break;

        // Finalise venue-based fees from actual order amount/qty
        const feeFinal = calcFeesForVenue(
          ord.amountPence || 0,
          ord.quantity || 0,
          ord.show?.venue || undefined
        );

        const paymentFee = stripeFeePence ?? null;
        const totalPlatformFee = feeFinal.totalPlatformFee;
        const organiserShare = feeFinal.organiserSharePence;
        const platformRevenue = feeFinal.platformRevenuePence;

        // Net payout to organiser:
        // gross - Stripe processing fee - platform fee + organiser share of platform fee
        const netPayout =
          ord.amountPence != null
            ? Math.max(0, ord.amountPence - (paymentFee || 0) - totalPlatformFee + organiserShare)
            : null;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            stripeId: chargeId || ord.stripeId || null,
            paymentFeePence: paymentFee,
            platformFeePence: totalPlatformFee,
            organiserSharePence: organiserShare,
            platformRevenuePence: platformRevenue,
            netPayoutPence: netPayout,
          },
        });

        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Webhook handler failed' });
  }
});

export default router;
