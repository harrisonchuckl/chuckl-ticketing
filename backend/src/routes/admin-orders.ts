// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

/**
 * Utility: build a Prisma "where" object from query params
 */
function buildOrderWhere(q?: string, status?: string, from?: Date, to?: Date) {
  const where: any = {};

  if (status) where.status = status;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { stripeId: { contains: q, mode: 'insensitive' } },
      { show: { title: { contains: q, mode: 'insensitive' } } },
      { show: { venue: { name: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  return where;
}

/**
 * GET /admin/orders
 * Filters: q, status, from, to, limit, skip
 */
router.get('/orders', async (req, res) => {
  try {
    const q = (req.query.q ? String(req.query.q) : '').trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    let limit = req.query.limit ? Number(req.query.limit) : 50;
    let skip = req.query.skip ? Number(req.query.skip) : 0;
    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 200) limit = 200;
    if (Number.isNaN(skip) || skip < 0) skip = 0;

    const where = buildOrderWhere(q, status, from, to);

    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          status: true,
          email: true,
          quantity: true,
          amountPence: true,
          stripeId: true,
          show: {
            select: {
              id: true,
              title: true,
              date: true,
              venue: { select: { id: true, name: true, city: true, postcode: true } },
            },
          },
          tickets: { select: { id: true, serial: true, status: true } },
        },
      }),
    ]);

    res.json({ ok: true, total, rows, limit, skip });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load orders' });
  }
});

/**
 * GET /admin/orders/export
 * Returns CSV with same filters.
 */
router.get('/orders/export', async (req, res) => {
  try {
    const q = (req.query.q ? String(req.query.q) : '').trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const where = buildOrderWhere(q, status, from, to);

    const rows = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        email: true,
        quantity: true,
        amountPence: true,
        stripeId: true,
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { id: true, name: true, city: true, postcode: true } },
          },
        },
      },
    });

    const header = [
      'order_id',
      'created_at',
      'status',
      'email',
      'quantity',
      'amount_pence',
      'amount_gbp',
      'stripe_id',
      'show_id',
      'show_title',
      'show_date',
      'venue_name',
      'venue_city',
      'venue_postcode',
    ];

    const csv = [
      header.join(','),
      ...rows.map((o) => {
        const gbp = (o.amountPence ?? 0) / 100;
        const venue = o.show?.venue || {};
        const safe = (v: any) => (v ?? '').toString().replaceAll('"', '""');
        return [
          `"${safe(o.id)}"`,
          `"${safe(o.createdAt.toISOString())}"`,
          `"${safe(o.status)}"`,
          `"${safe(o.email)}"`,
          `${o.quantity ?? 0}`,
          `${o.amountPence ?? 0}`,
          `${gbp.toFixed(2)}`,
          `"${safe(o.stripeId)}"`,
          `"${safe(o.show?.id)}"`,
          `"${safe(o.show?.title)}"`,
          `"${safe(o.show?.date?.toISOString())}"`,
          `"${safe(venue.name)}"`,
          `"${safe(venue.city)}"`,
          `"${safe(venue.postcode)}"`,
        ].join(',');
      }),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'CSV export failed' });
  }
});

/**
 * GET /admin/orders/:id
 * Returns a single order with details + tickets for the drawer.
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        status: true,
        email: true,
        quantity: true,
        amountPence: true,
        stripeId: true,
        notes: true,
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { id: true, name: true, address: true, city: true, postcode: true, capacity: true } },
          },
        },
        tickets: {
          select: { id: true, serial: true, status: true, scannedAt: true },
          orderBy: { serial: 'asc' },
        },
      },
    });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load order' });
  }
});

/**
 * POST /admin/orders/:id/resend
 * Resend the confirmation/tickets (placeholder – no external email send in this version).
 * Body: { message?: string }
 */
router.post('/orders/:id/resend', async (req, res) => {
  try {
    const id = String(req.params.id);

    // load to confirm existence + get recipient
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        tickets: { select: { id: true, serial: true, status: true } },
        show: { select: { id: true, title: true, date: true, venue: { select: { name: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    // In a later iteration, hook your real email service here.
    // For now we just record an internal note entry.
    const msg = (req.body?.message && String(req.body.message).trim()) || 'Resent confirmation (no-op stub).';

    await prisma.order.update({
      where: { id },
      data: {
        notes: (order as any).notes
          ? `${(order as any).notes}\n[${new Date().toISOString()}] ${msg}`
          : `[${new Date().toISOString()}] ${msg}`,
      },
    });

    res.json({ ok: true, simulated: true, message: 'Resend recorded (email send stub).' });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to resend' });
  }
});

/**
 * POST /admin/orders/:id/refund
 * Marks CANCELLED and (optionally) records a refund note. Stripe integration to follow.
 * Body: { reason?: string }
 */
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const id = String(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, notes: true },
    });
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    if (order.status === 'CANCELLED') {
      return res.json({ ok: true, message: 'Already cancelled' });
    }

    const reason = (req.body?.reason && String(req.body.reason).trim()) || 'Refunded (manual mark).';

    // TODO: add Stripe refund call here in a future iteration.
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: order.notes
          ? `${order.notes}\n[${new Date().toISOString()}] ${reason}`
          : `[${new Date().toISOString()}] ${reason}`,
      },
      select: { id: true, status: true, notes: true },
    });

    res.json({ ok: true, order: updated });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Refund failed' });
  }
});

export default router;
