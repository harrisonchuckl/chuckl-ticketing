// backend/src/routes/checkout.ts
//
// Creates a Stripe PaymentIntent for a basket of tickets.
// Expects: { showId: string, items: [{ ticketTypeId: string, qty: number }], email?: string }
//
// NOTE: This file updates older calls to calcFeesForShow(show, qty, subtotal)
// to the new single-argument signature.
//
// Charges the customer the ticket subtotal + platform fee.
// Stores an Order with amountPence=subtotal (ticket revenue), quantity, status=PENDING,
// and saves platformFeePence (for later settlement splits).

import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

type ItemInput = { ticketTypeId: string; qty: number };

router.post('/intent', async (req, res) => {
  try {
    const { showId, items, email } = req.body as {
      showId: string;
      items: ItemInput[];
      email?: string;
    };

    if (!showId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Invalid payload' });
    }

    // Load show (with venue config)
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { venue: true },
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    // Load the ticket types referenced and compute subtotal + quantity
    const ttIds = items.map(i => i.ticketTypeId);
    const tt = await prisma.ticketType.findMany({
      where: { id: { in: ttIds }, showId: showId },
      select: { id: true, pricePence: true },
    });

    // Build a map for price lookup
    const priceMap = new Map<string, number>();
    tt.forEach(t => priceMap.set(t.id, t.pricePence));

    let subtotalPence = 0;
    let totalQty = 0;
    for (const i of items) {
      const price = priceMap.get(i.ticketTypeId);
      if (price == null) {
        return res.status(400).json({ ok: false, message: 'Invalid ticket type in basket' });
      }
      const qty = Math.max(0, Number(i.qty || 0));
      totalQty += qty;
      subtotalPence += price * qty;
    }

    // Fees (new signature)
    const fees = calcFeesForShow({
      show,
      ticketCount: totalQty,
      subtotalPence,
    });

    // Amount to charge the customer is subtotal + platform fee
    const amountToCharge = subtotalPence + fees.platformFeePence;
    if (amountToCharge <= 0) {
      return res.status(400).json({ ok: false, message: 'Amount must be > 0' });
    }

    // Create or upsert a pending order for this basket
    const order = await prisma.order.create({
      data: {
        email: email ?? null,
        amountPence: subtotalPence,
        quantity: totalQty,
        status: 'PENDING',
        showId: show.id,
        platformFeePence: fees.platformFeePence,
      },
    });

    // Create PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount: amountToCharge,
      currency: 'gbp',
      receipt_email: email || undefined,
      metadata: {
        orderId: order.id,
        showId: show.id,
      },
      automatic_payment_methods: { enabled: true },
    });

    // Save Stripe ID on order
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeId: pi.id },
    });

    res.json({
      ok: true,
      clientSecret: pi.client_secret,
      orderId: order.id,
    });
  } catch (err: any) {
    console.error('checkout/intent error:', err);
    res.status(500).json({ ok: false, message: err?.message || 'Checkout error' });
  }
});

// (Optional) basic endpoint to fetch an order by id to render a confirmation page
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        show: { include: { venue: true } },
      },
    });
    if (!order) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, order });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || 'Error' });
  }
});

export default router;
