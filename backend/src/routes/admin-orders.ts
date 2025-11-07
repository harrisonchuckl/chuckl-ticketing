// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { sendTicketsEmail } from '../services/email.js';

const router = Router();

/**
 * GET /admin/orders
 * Query:
 *   q?: string (search by email, show title, venue name)
 *   limit?: number (default 25)
 *   cursor?: string (order.id cursor for pagination)
 */
router.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const where =
      q && q.length > 1
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { show: { title: { contains: q, mode: 'insensitive' as const } } },
              { show: { venue: { name: { contains: q, mode: 'insensitive' as const } } } },
            ],
          }
        : undefined;

    const orders = await prisma.order.findMany({
      where,
      include: {
        show: { include: { venue: true } },
        tickets: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    let nextCursor: string | null = null;
    if (orders.length > limit) {
      const last = orders.pop();
      nextCursor = last?.id ?? null;
    }

    res.json({ ok: true, orders, nextCursor });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load orders' });
  }
});

/**
 * GET /admin/orders/:id
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const o = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: {
        show: { include: { venue: true, ticketTypes: true } },
        tickets: true,
        user: true,
      },
    });
    if (!o) return res.status(404).json({ error: true, message: 'Order not found' });
    res.json({ ok: true, order: o });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load order' });
  }
});

/**
 * POST /admin/orders/:id/resend
 * Body: { to?: string }
 */
router.post('/orders/:id/resend', async (req, res) => {
  try {
    const id = String(req.params.id);
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : undefined;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    const result = await sendTicketsEmail(id, to);
    // Avoid duplicate 'ok' – just return what the service returns
    return res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Resend failed' });
  }
});

export default router;
