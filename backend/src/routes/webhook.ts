import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { calcPlatformFeePence } from '../services/fees.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const router = Router();

// NB: server.ts mounts this with bodyParser.raw({type:'application/json'}) at /webhooks/stripe

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

        // Retrieve payment intent with charges & balance tx
        const pi = session.payment_intent
          ? await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ['charges.data.balance_transaction'] })
          : null;

        let chargeId: string | null = null;
        let stripeFeePence: number | null = null;

        if (pi && pi.charges && pi.charges.data && pi.charges.data.length > 0) {
          const ch = pi.charges.data[0];
          chargeId = ch.id;
          const bt = ch.balance_transaction as Stripe.BalanceTransaction | null;
          if (bt && typeof bt.fee === 'number' && bt.currency === 'gbp') {
            stripeFeePence = bt.fee;
          }
        }

        const existing = await prisma.order.findUnique({ where: { id: orderId } });
        if (!existing) break;

        // Final platform fee based on actual gross
        const platformFee = calcPlatformFeePence(existing.amountPence || 0);

        const paymentFee = stripeFeePence ?? null;
        const netPayout =
          existing.amountPence != null
            ? Math.max(0, existing.amountPence - (platformFee || 0) - (paymentFee || 0))
            : null;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            stripeId: chargeId || existing.stripeId || null,
            platformFeePence: platformFee,
            paymentFeePence: paymentFee,
            netPayoutPence: netPayout,
          },
        });

        break;
      }

      // Optional: handle refund webhook events here to adjust fees if desired

      default:
        break;
    }

    res.json({ received: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Webhook handler failed' });
  }
});

export default router;
