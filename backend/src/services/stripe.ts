// backend/src/services/stripe.ts
import Stripe from 'stripe';
import prisma from '../lib/db.js';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  // We throw early so you get a clear env error in logs.
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2024-06-20',
});

/**
 * Creates a Stripe refund for a given order and records it in the database.
 *
 * @param orderId - The order to refund.
 * @param amountPence - Optional partial amount in pence. Defaults to full order amount.
 * @param reason - Optional free-text reason (stored in DB; short code sent to Stripe metadata).
 *
 * @returns { ok: true, refundId, amountPence, newStatus } on success
 * @throws Error with message suitable for surfacing to API users
 */
export default async function createRefund(
  orderId: string,
  amountPence?: number | null,
  reason?: string | null
): Promise<{ ok: true; refundId: string; amountPence: number; newStatus: string }> {
  // 1) Load order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      amountPence: true,
      stripeId: true,
      status: true,
      refunds: { select: { amount: true } },
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }
  if (!order.stripeId) {
    throw new Error('Order is missing Stripe payment reference');
  }

  // 2) Decide refund amount
  const orderTotal = Number(order.amountPence ?? 0);
  if (!orderTotal || orderTotal <= 0) {
    throw new Error('Order amount is invalid for refund');
  }

  const alreadyRefunded = order.refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const remaining = Math.max(orderTotal - alreadyRefunded, 0);

  const refundAmount = amountPence != null ? Number(amountPence) : remaining || orderTotal;
  if (refundAmount <= 0) {
    throw new Error('Nothing left to refund');
  }
  if (refundAmount > remaining) {
    throw new Error('Refund amount exceeds remaining balance');
  }

  // 3) Create Stripe refund
  // We assume order.stripeId is a PaymentIntent id.
  // If your integration used “charges”, switch to { charge: order.stripeId }.
  const stripeRefund = await stripe.refunds.create({
    payment_intent: order.stripeId,
    amount: refundAmount,
    // Stripe reason is limited enum; we put free text into metadata.
    reason: 'requested_by_customer',
    metadata: {
      orderId: order.id,
      appReason: reason || '',
    },
  });

  if (!stripeRefund || !stripeRefund.id) {
    throw new Error('Stripe refund failed to create');
  }

  // 4) Record refund in DB
  await prisma.refund.create({
    data: {
      amount: refundAmount,
      reason: reason || null,
      stripeId: stripeRefund.id,
      orderId: order.id,
      // ticketId: null  // Optional: link to a specific ticket in partial-use workflows
    },
  });

  // 5) Update order status if fully refunded
  const newTotalRefunded = alreadyRefunded + refundAmount;
  const fullyRefunded = newTotalRefunded >= orderTotal;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: fullyRefunded
      ? { status: 'REFUNDED' } // matches your Prisma enum OrderStatus
      : undefined,
    select: { status: true },
  });

  return {
    ok: true,
    refundId: stripeRefund.id,
    amountPence: refundAmount,
    newStatus: updated.status,
  };
}
