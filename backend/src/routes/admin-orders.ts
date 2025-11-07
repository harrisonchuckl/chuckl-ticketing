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
 *  - q: free text (email / stripe id / show title)
 *  - status: PAID|PENDING|REFUNDED|CANCELLED
 *  - page: number (1-based)
 *  - pageSize: number (default 25)
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
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to fetch orders' });
  }
});

/**
 * GET /admin/orders/:id
 * Includes tickets, refunds, notes (if present)
 */
router.get('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: { select: { id: true, serial: true, holderName: true, status: true, scannedAt: true } },
        refunds: { orderBy: { createdAt: 'desc' } },
        // Notes model assumed from earlier steps
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        show: { select: { id: true, title: true, date: true } },
      },
    });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to fetch order' });
  }
});

/**
 * GET /admin/orders/:id/notes
 * Optional search param: q
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
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to fetch notes' });
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
✅ 3) Fix the Stripe “no call signatures” issue

In your backend/src/services/stripe.ts, make sure you have:

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export default async function createRefund(orderId: string, amountPence?: number, reason?: string) {
  // ... existing refund logic ...
}


Then in your routes, the import must be:

import createRefund from '../services/stripe.js';


✅ not { createRefund }.

    res.json({ ok: true, note });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to create note' });
  }
});

/**
 * PATCH /admin/orders/:id/notes/:noteId
 * body: { text }
 */
router.patch('/orders/:id/notes/:noteId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const noteId = String(req.params.noteId);
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, message: 'Text required' });

    await prisma.orderNote.update({ where: { id: noteId }, data: { text } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to update note' });
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
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to delete note' });
  }
});

/**
 * Order activity feed (notes + refunds + ticket scans)
 * GET /admin/orders/:id/activity
 */
router.get('/orders/:id/activity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const [notes, refunds, tickets, order] = await Promise.all([
      prisma.orderNote.findMany({
        where: { orderId: id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.refund.findMany({
        where: { orderId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.findMany({
        where: { orderId: id, scannedAt: { not: null } },
        orderBy: { scannedAt: 'desc' },
        select: { id: true, serial: true, scannedAt: true, holderName: true },
      }),
      prisma.order.findUnique({ where: { id }, select: { createdAt: true } }),
    ]);

    const events: Array<{
      type: 'ORDER_CREATED' | 'NOTE' | 'REFUND' | 'TICKET_SCANNED';
      at: string;
      data: any;
    }> = [];

    if (order) {
      events.push({ type: 'ORDER_CREATED', at: order.createdAt.toISOString(), data: {} });
    }
    notes.forEach(n => events.push({ type: 'NOTE', at: n.createdAt.toISOString(), data: n }));
    refunds.forEach(rf => events.push({ type: 'REFUND', at: rf.createdAt.toISOString(), data: rf }));
    tickets.forEach(t => {
      if (t.scannedAt) {
        events.push({ type: 'TICKET_SCANNED', at: t.scannedAt.toISOString(), data: t });
      }
    });

    events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    res.json({ ok: true, events });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load activity' });
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

    // createRefund handles amount (optional) and logs Refund row + Stripe refund
    const rf = await createRefund(orderId, typeof amountPence === 'number' ? amountPence : undefined, String(reason || '') || undefined);

    res.json({ ok: true, refund: rf });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message ?? 'Refund failed' });
  }
});

/**
 * POST /admin/orders/bulk-refund
 * body: { orderIds: string[], amountPence?: number, reason?: string }
 */
router.post('/orders/bulk-refund', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderIds: string[] = Array.isArray(req.body?.orderIds) ? req.body.orderIds.map(String) : [];
    const amountPence = typeof req.body?.amountPence === 'number' ? req.body.amountPence : undefined;
    const reason = req.body?.reason ? String(req.body.reason) : undefined;

    if (!orderIds.length) return res.status(400).json({ ok: false, message: 'orderIds required' });

    const results = [];
    for (const id of orderIds) {
      try {
        const rf = await createRefund(id, amountPence, reason);
        results.push({ id, ok: true, refundId: rf.id });
      } catch (err: any) {
        results.push({ id, ok: false, message: err?.message ?? 'Failed' });
      }
    }

    res.json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Bulk refund failed' });
  }
});

/**
 * GET /admin/orders.csv
 * Exports current filtered result set to CSV.
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
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
      res.write(row + '\n');
    }
    res.end();
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'CSV export failed' });
  }
});

export default router;
