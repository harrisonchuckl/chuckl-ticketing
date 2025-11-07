// backend/src/services/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Creates a refund on a Stripe charge or payment intent.
 * @param stripeId charge/payment intent id
 * @param amountPence integer amount in pence
 * @param reason optional reason
 */
export async function createRefund(stripeId: string, amountPence?: number | null, reason?: string) {
  const refund = await stripe.refunds.create({
    charge: stripeId.startsWith('ch_') ? stripeId : undefined,
    payment_intent: stripeId.startsWith('pi_') ? stripeId : undefined,
    amount: amountPence || undefined,
    reason: reason ? undefined : undefined,
  });
  return refund;
}

export async function retrieveRefund(refundId: string) {
  return await stripe.refunds.retrieve(refundId);
}
