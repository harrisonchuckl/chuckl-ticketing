// backend/src/routes/public-orders.ts
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/db.js';
import { sendOrderEmail } from '../services/mailer.js';

const router = Router();

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /orders/resend
 * Body: { orderId: string, email: string }
 * Checks email matches the order, then resends the e-ticket email.
 */
router.post('/orders/resend', resendLimiter, async (req: Request, res: Response) => {
  try {
    const { orderId, email } = req.body || {};
    if (!orderId || !email) {
      return res.status(400).json({ ok: false, message: 'orderId and email are required' });
    }

    const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    const normalise = (s: string) => s.trim().toLowerCase();
    if (!order.email || normalise(order.email) !== normalise(String(email))) {
      return res.status(401).json({ ok: false, message: 'Email does not match the order' });
    }

    const result = await sendOrderEmail(order.id);
    res.json({ ok: true, provider: result.provider });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message ?? 'Resend failed' });
  }
});

export default router;
