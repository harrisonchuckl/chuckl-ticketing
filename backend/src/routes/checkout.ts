// backend/src/routes/checkout.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { calcFeesForShow } from '../services/fees.js';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

/**
 * POST /checkout/create-intent
 * body: { showId: string, quantity: number, unitPricePence: number, email?: string }
 */
router.post('/create-intent', async (req, res) => {
  try {
    const { showId, quantity, unitPricePence, email } = req.body || {};
    if (!showId || !quantity || !unitPricePence) {
      return res.status(400).json({ ok: false, message: 'Missing showId, quantity or unitPricePence' });
    }

    const subtotalPence = quantity * unitPricePence;

    // ✅ await the async fee helper
    const fees = await calcFeesForShow({
      prisma,
      showId,
      quantity,
      subtotalPence,
    });

    const amountPence = subtotalPence + fees.platformFeePence;

    const pi = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      metadata: {
        showId,
        quantity: String(quantity),
        unitPricePence: String(unitPricePence),
        subtotalPence: String(subtotalPence),
        platformFeePence: String(fees.platformFeePence),
      },
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
    });

    // Create a provisional order row (status PENDING)
    const order = await prisma.order.create({
      data: {
        showId,
        email: email ?? null,
        quantity,
        amountPence,
        stripeId: pi.id,
        status: 'PENDING',
        // if you later persist fee splits per order, add columns and write them here
        platformFeePence: fees.platformFeePence ?? null,
        organiserFeePence: fees.organiserFeePence ?? null,
      } as any, // tolerate extra fields if schema doesn’t have them yet
    });

    res.json({
      ok: true,
      clientSecret: pi.client_secret,
      orderId: order.id,
      fees,
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || 'Failed to create payment intent' });
  }
});

export default router;
