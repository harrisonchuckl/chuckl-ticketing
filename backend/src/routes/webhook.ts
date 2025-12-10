// backend/src/routes/webhook.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import Stripe from 'stripe';
import { calcFeesForShow } from '../services/fees.js';

// --- ROBUST STRIPE INITIALIZATION (Prevents module load crashes) ---
const StripeClient = (Stripe as any)?.default || Stripe;

const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
// -----------------------------------------------------------
const router = Router();

/**
 * Stripe webhook
 */
router.post('/webhooks/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) return res.status(400).send('No signature');

    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const showId = session.metadata?.showId;

      if (orderId && showId) {
        // Load order to compute fees precisely (unit price = amount/qty)
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            amountPence: true,
            quantity: true,
            userId: true,
          },
        });

        if (order) {
          const unit = order.quantity && order.amountPence ? Math.round(order.amountPence / order.quantity) : 0;

          let organiserSplitBps: number | null = null;
          if (order.userId) {
            const user = await prisma.user.findUnique({
              where: { id: order.userId },
              select: { organiserSplitBps: true },
            });
            organiserSplitBps = user?.organiserSplitBps ?? null;
          }

          const fees = await calcFeesForShow(prisma, showId, Number(order.quantity ?? 0), unit, organiserSplitBps);

          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'PAID',
              platformFeePence: fees.platformFeePence,
              organiserSharePence: fees.organiserSharePence,
              paymentFeePence: fees.paymentFeePence,
              netPayoutPence: fees.netPayoutPence,
              stripeId: session.payment_intent as string,
            },
          });
        }
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('stripe webhook error', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
