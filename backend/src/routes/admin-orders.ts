// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import prisma from '../lib/db.js';

const router = Router();

/**
 * GET /admin/orders
 * Query:
 *  - q: free text (email, stripeId contains)
 *  - status: PENDING|PAID|REFUNDED|CANCELLED (optional)
 *  - limit, offset
 */
router.get('/orders', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { stripeId: { contains: q, mode: 'insensitive' } },
        { show: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          createdAt: true,
          email: true,
          amountPence: true,
          quantity: true,
          status: true,
          stripeId: true,
          show: { select: { id: true, title: true, date: true } },
          _count: { select: { tickets: true, refunds: true } },
        },
      }),
    ]);

    res.json({ ok: true, total, items, limit, offset });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to fetch orders' });
  }
});

/**
 * GET /admin/orders/:id
 *  - includes notes and tickets summary
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        show: { select: { id: true, title: true, date: true, venue: { select: { name: true, city: true } } } },
        tickets: { select: { id: true, serial: true, status: true, scannedAt: true, holderName: true } },
        refunds: { select: { id: true, amount: true, reason: true, stripeId: true, createdAt: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to fetch order' });
  }
});

/**
 * POST /admin/orders/:id/notes
 * body: { text: string }
 */
router.post('/orders/:id/notes', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: true, message: 'Text required' });
    }

    // If you have auth middleware, you can set req.user.id here; for now authorId is optional
    const authorId = (req as any).user?.id ?? null;

    // ensure order exists
    const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: true, message: 'Order not found' });

    const note = await prisma.orderNote.create({
      data: {
        orderId: id,
        authorId: authorId ?? undefined,
        text: String(text),
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    res.json({ ok: true, note });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to create note' });
  }
});

/**
 * PATCH /admin/orders/:id/notes/:noteId
 * body: { text: string }
 */
router.patch('/orders/:id/notes/:noteId', async (req, res) => {
  try {
    const noteId = String(req.params.noteId);
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: true, message: 'Text required' });
    }
    const note = await prisma.orderNote.update({
      where: { id: noteId },
      data: { text: String(text) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.json({ ok: true, note });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to update note' });
  }
});

/**
 * DELETE /admin/orders/:id/notes/:noteId
 */
router.delete('/orders/:id/notes/:noteId', async (req, res) => {
  try {
    const noteId = String(req.params.noteId);
    await prisma.orderNote.delete({ where: { id: noteId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to delete note' });
  }
});

export default router;
