// backend/src/routes/webhook.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import Stripe from 'stripe';
import { calcFeesForShow } from '../services/fees.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

function markSeatsSold(layout: any, seatIds: string[]): any {
  const seatSet = new Set(seatIds);

  const mutateNode = (node: any) => {
    if (!node || typeof node !== 'object') return;

    const attrs = node.attrs || node;

    const isSeat =
      (attrs.isSeat || attrs.isSeat === 'true') &&
      ((node.className === 'Circle') ||
       (attrs.className === 'Circle') ||
       typeof attrs.radius === 'number');

    const sbSeatId = attrs.sbSeatId;
    const id = attrs.id;

    const matches =
      (typeof sbSeatId === 'string' && seatSet.has(sbSeatId)) ||
      (typeof id === 'string' && seatSet.has(id));

    if (isSeat && matches) {
      // These flags are used by the checkout view to black out unavailable seats
      attrs.status = 'SOLD';
      attrs.sbHoldStatus = 'sold';
    }

    if (node.attrs) node.attrs = attrs;

    if (Array.isArray(node.children)) {
      node.children.forEach(mutateNode);
    }
  };

  let root = layout;
  let wasString = false;

  if (typeof root === 'string') {
    wasString = true;
    try {
      root = JSON.parse(root);
    } catch {
      return layout;
    }
  }

  mutateNode(root);

  return wasString ? JSON.stringify(root) : root;
}


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
      const seatIdsRaw = session.metadata?.seatIds || '';
      const seatIds = seatIdsRaw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (orderId && showId) {
        // Load order to compute fees precisely
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
          let organiserSplitBps: number | null = null;

          if (order.userId) {
            const user = await prisma.user.findUnique({
              where: { id: order.userId },
              select: { organiserSplitBps: true },
            });
            organiserSplitBps = user?.organiserSplitBps ?? null;
          }

          // Use the new calcFeesForShow signature: (showId, amountPence, quantity, organiserSplitBps?)
          const fees = await calcFeesForShow(
            showId,
            Number(order.amountPence ?? 0),
            Number(order.quantity ?? 0),
            organiserSplitBps ?? undefined
          );

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

          // If we have seat IDs, mark them as SOLD in the latest seat map for this show
          if (seatIds.length > 0) {
            const seatMap = await prisma.seatMap.findFirst({
              where: { showId },
              orderBy: { updatedAt: 'desc' },
            });

            if (seatMap && seatMap.layout) {
              let layout: any = seatMap.layout as any;

              if (layout.konvaJson) {
                layout = {
                  ...layout,
                  konvaJson: markSeatsSold(layout.konvaJson, seatIds),
                };
              } else {
                layout = markSeatsSold(layout, seatIds);
              }

              await prisma.seatMap.update({
                where: { id: seatMap.id },
                data: { layout },
              });
            }
          }
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
