// backend/src/services/stripe.ts
import Stripe from 'stripe';
import { OrderStatus } from '@prisma/client';
import prisma from '../lib/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

/**
 * Create a Stripe refund for a given order.
 *
 * - If amountPence is omitted, we refund the remaining paid balance (full refund net of previous refunds).
 * - Records a Refund row in Prisma.
 * - Updates Order.status to REFUNDED for full refunds, leaves PAID for partials.
 *
 * @param orderId string
 * @param amountPence number | undefined
 * @param reason string | undefined
 */
export default async function createRefund(
  orderId: string,
  amountPence?: number,
  reason?: string
): Promise<{ ok: true; refundId: string; amountPence: number; newStatus: OrderStatus }> {
  // Load the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { refunds: true },
  });
  if (!order) {
    throw new Error('Order not found');
  }
  if (!order.stripeId) {
    throw new Error('Order is missing Stripe payment intent ID');
  }
  const totalPaid = order.amountPence ?? 0;

  // Sum existing refunds for this order
  const alreadyRefunded = (order.refunds || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const remaining = Math.max(0, totalPaid - alreadyRefunded);

  if (remaining <= 0) {
    throw new Error('Nothing left to refund for this order');
  }

  const refundAmount = typeof amountPence === 'number' ? amountPence : remaining;
  if (refundAmount <= 0) {
    throw new Error('Refund amount must be > 0');
  }
  if (refundAmount > remaining) {
    throw new Error(`Refund amount exceeds remaining paid amount (${remaining} pence)`);
  }

  // Create the refund in Stripe against the payment intent
  const refund = await stripe.refunds.create({
    payment_intent: order.stripeId,
    amount: refundAmount,
    reason: reason ? 'requested_by_customer' : undefined,
    metadata: {
      orderId: order.id,
      reason: reason || '',
    },
  });

  // Record the refund in our DB
  await prisma.refund.create({
    data: {
      amount: refundAmount,
      reason: reason || null,
      stripeId: refund.id,
      orderId: order.id,
    },
  });

  // If fully refunded now, flip order status
  const newAlreadyRefunded = alreadyRefunded + refundAmount;
  const isFullyRefunded = newAlreadyRefunded >= totalPaid && totalPaid > 0;

  const updateData: { status?: OrderStatus } = {};
  if (isFullyRefunded) {
    updateData.status = OrderStatus.REFUNDED;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });
  }

  return {
    ok: true,
    refundId: refund.id,
    amountPence: refundAmount,
    newStatus: isFullyRefunded ? OrderStatus.REFUNDED : order.status,
  };
}
