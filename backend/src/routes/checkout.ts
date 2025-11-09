import { Router } from 'express';
import prisma from '../lib/prisma.js';
import Stripe from 'stripe';
import { calcFeesForShow } from '../services/fees.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const router = Router();

/**
 * POST /checkout/create
 * body: { showId: string, items: [{ ticketTypeId, qty }], email, promoCode? }
 */
router.post('/create', async (req, res) => {
  try {
    const { showId, items, email, promoCode } = req.body || {};
    if (!showId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'showId and items required' });
    }

    // Load ticket types & compute subtotal
    const ttIds = items.map((i: any) => String(i.ticketTypeId));
    const tts = await prisma.ticketType.findMany({ where: { id: { in: ttIds } } });

    let quantity = 0;
    let subtotalPence = 0;
    for (const line of items) {
      const tt = tts.find((t) => t.id === String(line.ticketTypeId));
      const qty = Number(line.qty || 0);
      if (!tt || qty <= 0) continue;
      if (tt.available != null && qty > tt.available) {
        return res.status(400).json({ ok: false, message: `Insufficient availability for ${tt.name}` });
      }
      quantity += qty;
      subtotalPence += qty * tt.pricePence;
    }
    if (quantity === 0) return res.status(400).json({ ok: false, message: 'No valid items' });

    // Optional: apply coupon
    let couponId: string | null = null;
    let discountPence = 0;
    if (promoCode) {
      const now = new Date();
      const c = await prisma.coupon.findFirst({
        where: {
          code: String(promoCode).toUpperCase(),
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      });
      if (c && (c.maxRedemptions == null || c.timesRedeemed < c.maxRedemptions)) {
        couponId = c.id;
        if (c.percentOff != null) {
          discountPence = Math.floor((subtotalPence * Math.min(Math.max(c.percentOff, 0), 100)) / 100);
        } else if (c.amountOffPence != null) {
          discountPence = Math.min(subtotalPence, Math.max(c.amountOffPence, 0));
        }
      }
    }

    const payablePence = Math.max(subtotalPence - discountPence, 0);

    // Estimate fees for the venue (not added to Stripe price; used for payout)
    const feeEst = await calcFeesForShow(String(showId), payablePence, quantity);

    // Create Order (PENDING)
    const order = await prisma.order.create({
      data: {
        showId: String(showId),
        email: email ? String(email) : null,
        amountPence: payablePence,
        quantity,
        status: 'PENDING',
        couponId,
        discountPence: discountPence || null,
        platformFeePence: feeEst.platformFeePence,
        platformFeeOurSharePence: feeEst.ourSharePence,
        platformFeeOrganiserSharePence: feeEst.organiserSharePence,
      },
      select: { id: true },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'gbp',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            product_data: { name: 'Tickets' },
            unit_amount: payablePence,
          },
        },
      ],
      metadata: { orderId: order.id },
      success_url: `${process.env.PUBLIC_BASE_URL}/events/success?o=${order.id}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/events/cancel?o=${order.id}`,
    });

    res.json({ ok: true, orderId: order.id, stripeUrl: session.url });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Checkout failed' });
  }
});

export default router;
