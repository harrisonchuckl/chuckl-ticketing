import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';

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
        const orderId = session.metadata?.orderId || null;
        if (!orderId) break;

        const existing = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, amountPence: true, showId: true, stripeId: true },
        });
        if (!existing) break;

        // Retrieve PI (expanded) and read the balance transaction for Stripe fees
        let paymentFeePence: number | null = null;
        let chargeId: string | null = null;

        if (session.payment_intent) {
          const resp = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
            expand: ['charges.data.balance_transaction'],
          }) as Stripe.Response<Stripe.PaymentIntent>;
          const pi = resp.data;

          if (pi.charges?.data?.length) {
            const ch = pi.charges.data[0];
            chargeId = ch.id;
            const bt = ch.balance_transaction as Stripe.BalanceTransaction | null;
            if (bt && typeof bt.fee === 'number' && bt.currency === 'gbp') {
              paymentFeePence = bt.fee;
            }
          }
        }

        // Final fee calc (based on actual gross + ticket count if needed)
        const showId = existing.showId!;
        const gross = existing.amountPence || 0;

        // We don’t have itemised qty in Order; infer from tickets after fulfillment if you prefer.
        // For now, we approximate qty by counting tickets linked to this order (if any created already),
        // else default to 1 (basket-level fee still applies).
        const qty = await prisma.ticket.count({ where: { orderId: orderId } }).then(n => (n > 0 ? n : 1));

        const feeFinal = await calcFeesForShow(showId, gross, qty);

        const ourShare = feeFinal.ourSharePence;
        const organiserShare = feeFinal.organiserSharePence;

        // Net payout to organiser: gross - payment fees - our share
        const netPayout =
          gross - (paymentFeePence || 0) - ourShare;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            stripeId: chargeId || existing.stripeId || null,
            paymentFeePence: paymentFeePence,
            platformFeePence: feeFinal.platformFeePence,
            platformFeeOurSharePence: ourShare,
            platformFeeOrganiserSharePence: organiserShare,
            netPayoutPence: Math.max(0, netPayout),
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
