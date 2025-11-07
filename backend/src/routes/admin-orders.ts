// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

/**
 * GET /admin/orders
 * Query params:
 *  - q: free text (email, stripeId, show title, venue name)
 *  - status: PENDING | PAID | CANCELLED
 *  - from: ISO date string
 *  - to: ISO date string
 *  - limit: number (default 50, max 200)
 *  - skip: number (default 0)
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

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    // For free text "q", search across email, stripeId, show title, venue name
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { stripeId: { contains: q, mode: 'insensitive' } },
        { show: { title: { contains: q, mode: 'insensitive' } } },
        { show: { venue: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

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
              venue: {
                select: { id: true, name: true, city: true, postcode: true },
              },
            },
          },
          tickets: {
            select: { id: true, serial: true, status: true },
          },
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
 * Same filters as /admin/orders, but returns CSV.
 */
router.get('/orders/export', async (req, res) => {
  try {
    const q = (req.query.q ? String(req.query.q) : '').trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const where: any = {};

    if (status) {
      where.status = status;
    }

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
            venue: {
              select: { id: true, name: true, city: true, postcode: true },
            },
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
        const safe = (v: any) =>
          (v ?? '')
            .toString()
            .replaceAll('"', '""'); // simple CSV escaping for quotes

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

export default router;
