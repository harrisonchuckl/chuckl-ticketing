// backend/src/routes/checkout.ts
import { Router } from 'express';
import { Prisma, ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

/**
 * POST /checkout/session
 * Body: { showId: string, quantity: number, unitPricePence?: number }
 */
router.post('/session', async (req, res) => {
  try {
    const { showId, quantity } = req.body ?? {};
    if (!showId || !quantity || quantity < 1) {
      return res.status(400).json({ ok: false, message: 'showId and quantity are required' });
    }

    // Unit price: prefer ticket type price or fallback to provided value
    const show = await prisma.show.findFirst({
      where: { id: showId, status: ShowStatus.LIVE },
      select: {
        status: true,
        ticketTypes: { select: { pricePence: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const typedShow = show as
      | Prisma.ShowGetPayload<{
          select: {
            status: true;
            ticketTypes: { select: { pricePence: true } };
          };
        }>
      | null;

    if (!typedShow) {
      return res.status(404).json({ ok: false, message: 'Show not available' });
    }

    const unitPricePence =
      typedShow.ticketTypes?.[0]?.pricePence ??
      (typeof req.body.unitPricePence === 'number' ? req.body.unitPricePence : null);

    if (!unitPricePence) {
      return res.status(400).json({ ok: false, message: 'No ticket price found' });
    }

    // Optional organiser fee split (if user logged-in and has a custom split)
    let organiserSplitBps: number | null = null;
    const userId = (req as any).userId as string | undefined;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organiserSplitBps: true },
      });
      organiserSplitBps = user?.organiserSplitBps ?? null;
    }

    const fees = await calcFeesForShow(prisma, showId, Number(quantity), Number(unitPricePence), organiserSplitBps);

    // Create a placeholder order (PENDING)
    const order = await prisma.order.create({
      data: {
        show: { connect: { id: showId } },
        quantity: Number(quantity),
        amountPence: Number(unitPricePence) * Number(quantity),
        status: 'PENDING',
        platformFeePence: fees.platformFeePence,
        organiserSharePence: fees.organiserSharePence,
        paymentFeePence: fees.paymentFeePence,
        netPayoutPence: fees.netPayoutPence,
      },
      select: { id: true },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      line_items: [
        {
          quantity,
          price_data: {
            currency: 'gbp',
            unit_amount: unitPricePence,
            product_data: {
              name: 'Tickets',
            },
          },
        },
      ],
      metadata: { orderId: order.id, showId },
      success_url: `${process.env.PUBLIC_BASE_URL}/success?order=${order.id}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel?order=${order.id}`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error('checkout/session error', err);
    return res.status(500).json({ ok: false, message: 'Checkout error' });
  }
});

export default router;
