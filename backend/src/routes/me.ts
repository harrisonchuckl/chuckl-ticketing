import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/**
 * GET /me/ping
 */
router.get('/ping', (_req, res) => {
  res.json({ ok: true, router: 'me' });
});

/**
 * TEMP: GET /me/orders?email=you@example.com
 * Lists orders for a given email (useful before JWT auth is in place).
 * NOTE: This endpoint is intentionally simple and DOES NOT use any fields
 * like role/items/deletedAt that your schema doesn't have.
 */
router.get('/orders', async (req, res) => {
  try {
    const email = (req.query.email as string) || '';
    if (!email) return res.status(400).json({ error: 'email_required' });

    const orders = await prisma.order.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      // Include nothing extra that doesn't exist in your schema
    });

    res.json({ orders });
  } catch (e: any) {
    res.status(500).json({ error: 'fetch_failed', detail: String(e?.message || e) });
  }
});

export default router;
