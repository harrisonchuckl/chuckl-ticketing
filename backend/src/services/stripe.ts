// backend/src/services/stripe.ts
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

// Use the current Stripe API version that matches the SDK types
export const stripe = new Stripe(secret, {
  apiVersion: '2024-06-20',
});

export type CreateRefundInput = {
  // Provide either paymentIntentId or chargeId
  paymentIntentId?: string | null;
  chargeId?: string | null;

  // Amount in the smallest currency unit (pence for GBP). If omitted, Stripe will refund the full remaining amount.
  amountPence?: number | null;

  // Optional free-text reason (stored on Stripe as reason or metadata)
  reason?: string | null;

  // Optional extra metadata to add on the refund
  metadata?: Record<string, string> | null;
};

/**
 * Create a Stripe refund. You can pass either a paymentIntentId or a chargeId.
 * If both are provided, paymentIntentId is preferred.
 */
export async function createRefund(input: CreateRefundInput): Promise<Stripe.Response<Stripe.Refund>> {
  const { paymentIntentId, chargeId, amountPence, reason, metadata } = input;

  if (!paymentIntentId && !chargeId) {
    throw new Error('createRefund requires paymentIntentId or chargeId');
  }

  // Map our free-text reason to Stripe's limited enum where possible,
  // otherwise tuck it into metadata. Valid Stripe reasons are:
  // 'duplicate' | 'fraudulent' | 'requested_by_customer'
  let stripeReason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined;
  if (reason) {
    const r = reason.toLowerCase();
    if (r.includes('duplicate')) stripeReason = 'duplicate';
    else if (r.includes('fraud')) stripeReason = 'fraudulent';
    else if (r.includes('request')) stripeReason = 'requested_by_customer';
  }

  const params: Stripe.RefundCreateParams = {
    amount: typeof amountPence === 'number' && amountPence > 0 ? amountPence : undefined,
    reason: stripeReason,
    metadata: {
      ...(metadata || {}),
      ...(reason && !stripeReason ? { human_reason: reason } : {}),
    },
  };

  if (paymentIntentId) {
    (params as any).payment_intent = paymentIntentId;
  } else if (chargeId) {
    (params as any).charge = chargeId;
  }

  const refund = await stripe.refunds.create(params);
  return refund;
}

export default stripe;
