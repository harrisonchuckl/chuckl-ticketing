import { Router } from 'express';
import prisma from '../lib/prisma.js';
import Stripe from 'stripe';

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
    const ttMap = new Map<string, { id: string; name: string; pricePence: number; available: number | null }>();
    const tts = await prisma.ticketType.findMany({ where: { id: { in: ttIds } } });
    tts.forEach((t) => ttMap.set(t.id, { id: t.id, name: t.name, pricePence: t.pricePence, available: t.available ?? null }));

    let quantity = 0;
    let subtotalPence = 0;
    for (const line of items) {
      const tt = ttMap.get(String(line.ticketTypeId));
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
    let coupon = null as null | { id: string; code: string; percentOff: number | null; amountOffPence: number | null };
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
          OR: [
            { maxRedemptions: null },
            { timesRedeemed: { lt: prisma.coupon.fields.maxRedemptions } }, // pseudo; Prisma doesn't allow this shortcut
          ],
        },
      });

      // Workaround for maxRedemptions (since we can't reference fields): check in code
      if (c && (c.maxRedemptions == null || c.timesRedeemed < c.maxRedemptions)) {
        coupon = { id: c.id, code: c.code, percentOff: c.percentOff, amountOffPence: c.amountOffPence };
        if (c.percentOff != null) {
          discountPence = Math.floor((subtotalPence * Math.min(Math.max(c.percentOff, 0), 100)) / 100);
        } else if (c.amountOffPence != null) {
          discountPence = Math.min(subtotalPence, Math.max(c.amountOffPence, 0));
        }
      }
    }

    const payablePence = Math.max(subtotalPence - discountPence, 0);

    // Create Order (PENDING)
    const order = await prisma.order.create({
      data: {
        showId: String(showId),
        email: email ? String(email) : null,
        amountPence: payablePence,
        quantity,
        status: 'PENDING',
        couponId: coupon?.id ?? null,
        discountPence: discountPence || null,
      },
      select: { id: true },
    });

    // Stripe payment link / session
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

    // (Optional) reserve stock here

    res.json({ ok: true, orderId: order.id, stripeUrl: session.url });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Checkout failed' });
  }
});

export default router;
