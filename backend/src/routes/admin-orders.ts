// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { Prisma, OrderStatus } from '@prisma/client';
import prisma from '../lib/db.js';
import createRefund from '../services/stripe.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/orders
 * Query params:
 *  - q: search text (email / stripe id / show title)
 *  - status: order status filter
 *  - page / pageSize: pagination
 */
router.get('/orders', requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim().toUpperCase();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));

    const where: Prisma.OrderWhereInput = {};

    if (q) {
      where.OR = [
        { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { stripeId: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { show: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      ];
    }

    if (status && Object.prototype.hasOwnProperty.call(OrderStatus, status)) {
      where.status = status as OrderStatus;
    }

    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          show: { select: { id: true, title: true, date: true } },
        },
      }),
    ]);

    res.json({ ok: true, items, page, pageSize, total, pages: Math.ceil(total / pageSize) });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to load orders' });
  }
});

/**
 * GET /admin/orders/:id
 */
router.get('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: true,
        refunds: true,
        show: { select: { id: true, title: true, date: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to fetch order' });
  }
});

/**
 * GET /admin/orders/:id/notes?q=
 */
router.get('/orders/:id/notes', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const q = String(req.query.q || '').trim();

    const where: Prisma.OrderNoteWhereInput = { orderId };
    if (q) where.text = { contains: q, mode: Prisma.QueryMode.insensitive };

    const notes = await prisma.orderNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({ ok: true, notes });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to fetch notes' });
  }
});

/**
 * POST /admin/orders/:id/notes
 * body: { text }
 */
router.post('/orders/:id/notes', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const userId = (req as any).user?.id ?? null;
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, message: 'Text required' });

    const data: any = { orderId, text };
    if (userId) data.user = { connect: { id: userId } };

    const note = await prisma.orderNote.create({
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({ ok: true, note });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to add note' });
  }
});

/**
 * PATCH /admin/orders/:id/notes/:noteId
 */
router.patch('/orders/:id/notes/:noteId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const noteId = String(req.params.noteId);
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, message: 'Text required' });

    await prisma.orderNote.update({
      where: { id: noteId },
      data: { text },
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to update note' });
  }
});

/**
 * DELETE /admin/orders/:id/notes/:noteId
 */
router.delete('/orders/:id/notes/:noteId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const noteId = String(req.params.noteId);
    await prisma.orderNote.delete({ where: { id: noteId } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'Failed to delete note' });
  }
});

/**
 * POST /admin/orders/:id/refund
 * body: { amountPence?: number, reason?: string }
 */
router.post('/orders/:id/refund', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { amountPence, reason } = req.body || {};

    const refund = await createRefund(
      orderId,
      typeof amountPence === 'number' ? amountPence : undefined,
      reason ? String(reason) : undefined
    );

    res.json({ ok: true, refund });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message ?? 'Refund failed' });
  }
});

/**
 * GET /admin/orders.csv
 */
router.get('/orders.csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim().toUpperCase();

    const where: Prisma.OrderWhereInput = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { stripeId: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { show: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      ];
    }
    if (status && Object.prototype.hasOwnProperty.call(OrderStatus, status)) {
      where.status = status as OrderStatus;
    }

    const items = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { show: { select: { title: true, date: true } } },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');

    const header = ['createdAt', 'email', 'showTitle', 'showDate', 'quantity', 'amountPence', 'status', 'stripeId'];
    res.write(header.join(',') + '\n');

    for (const o of items) {
      const row = [
        o.createdAt.toISOString(),
        o.email ?? '',
        o.show?.title ?? '',
        o.show?.date ? o.show.date.toISOString() : '',
        String(o.quantity ?? ''),
        String(o.amountPence ?? ''),
        o.status,
        o.stripeId ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
      res.write(row + '\n');
    }

    res.end();
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message ?? 'CSV export failed' });
  }
});

export default router;
