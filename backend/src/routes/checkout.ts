import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';

export const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

/**
 * POST /checkout/create
 * body: {
 *   showId: string,
 *   email: string,
 *   items: [{ ticketTypeId: string, quantity: number }]
 * }
 * Creates an Order row (PENDING) and a Stripe Checkout Session.
 */
router.post('/create', async (req, res) => {
  try {
    const { showId, email, items } = req.body || {};
    if (!showId || !email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'invalid_body' });
    }

    // Fetch show to confirm it exists
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: 'show_not_found' });

    // Load ticket types and compute amount/stock checks
    const ttIds = items.map((i: any) => i.ticketTypeId);
    const ttypes = await prisma.ticketType.findMany({
      where: { id: { in: ttIds }, showId },
      select: { id: true, name: true, pricePence: true, available: true },
    });

    if (ttypes.length !== items.length) {
      return res.status(400).json({ error: 'ticket_type_mismatch' });
    }

    // validate quantities and availability
    for (const it of items) {
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
        return res.status(400).json({ error: 'invalid_quantity' });
      }
      const tt = ttypes.find(t => t.id === it.ticketTypeId)!;
      if (typeof tt.available === 'number' && it.quantity > tt.available) {
        return res.status(400).json({ error: 'insufficient_available', ticketTypeId: tt.id });
      }
    }

    // compute aggregate totals
    const quantityTotal = items.reduce((sum: number, it: any) => sum + it.quantity, 0);
    const amountPence = items.reduce((sum: number, it: any) => {
      const tt = ttypes.find(t => t.id === it.ticketTypeId)!;
      return sum + tt.pricePence * it.quantity;
    }, 0);

    // Create minimal order (PENDING)
    const order = await prisma.order.create({
      data: {
        showId,
        email,
        quantity: quantityTotal,
        amountPence,
        stripeId: 'pending',
        status: 'PENDING',
      },
      select: { id: true, quantity: true, amountPence: true },
    });

    // Prepare line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it: any) => {
      const tt = ttypes.find(t => t.id === it.ticketTypeId)!;
      return {
        quantity: it.quantity,
        price_data: {
          currency: process.env.STRIPE_CURRENCY || 'gbp',
          product_data: { name: tt.name },
          unit_amount: tt.pricePence,
        },
      };
    });

    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${base}/success?orderId=${order.id}`,
      cancel_url: `${base}/events/${showId}`,
      metadata: {
        orderId: order.id,
        showId,
      },
    });

    // attach Stripe id to order
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeId: session.id },
    });

    res.json({ checkoutUrl: session.url, orderId: order.id });
  } catch (e: any) {
    console.error('checkout_create_error', e?.message || e);
    res.status(500).json({ error: 'checkout_create_failed', detail: String(e?.message || e) });
  }
});

export default router;
