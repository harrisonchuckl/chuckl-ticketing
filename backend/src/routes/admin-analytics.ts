// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns daily buckets of:
 *  - ordersCount (PAID orders),
 *  - ticketsCount (tickets linked to PAID orders),
 *  - revenuePence (sum of amountPence on PAID orders)
 *
 * Default range: last 30 days (inclusive).
 */
router.get('/analytics/overview', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    // Default range: last 30 days
    const now = new Date();
    const end = to ? new Date(to + 'T23:59:59.999Z') : now;
    const start = from
      ? new Date(from + 'T00:00:00.000Z')
      : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

    // Fetch PAID orders in range with tickets (to count tickets reliably)
    const orders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: { tickets: true },
      orderBy: { createdAt: 'asc' },
    });

    // Bucket by YYYY-MM-DD (UTC)
    const dayKey = (d: Date) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
        .toISOString()
        .slice(0, 10);

    // Pre-seed buckets to keep chart continuous
    const buckets: Record<
      string,
      { date: string; ordersCount: number; ticketsCount: number; revenuePence: number }
    > = {};
    for (
      let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      t <= Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
      t += 24 * 60 * 60 * 1000
    ) {
      const d = new Date(t).toISOString().slice(0, 10);
      buckets[d] = { date: d, ordersCount: 0, ticketsCount: 0, revenuePence: 0 };
    }

    for (const o of orders) {
      const k = dayKey(o.createdAt);
      if (!buckets[k]) {
        buckets[k] = { date: k, ordersCount: 0, ticketsCount: 0, revenuePence: 0 };
      }
      buckets[k].ordersCount += 1;
      buckets[k].ticketsCount += (o.tickets?.length || 0);
      buckets[k].revenuePence += Number(o.amountPence || 0);
    }

    const series = Object.values(buckets).sort((a, b) => (a.date < b.date ? -1 : 1));

    // High-level KPIs
    const totalRevenuePence = series.reduce((s, d) => s + d.revenuePence, 0);
    const totalOrders = series.reduce((s, d) => s + d.ordersCount, 0);
    const totalTickets = series.reduce((s, d) => s + d.ticketsCount, 0);

    res.json({
      ok: true,
      range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      series,
      kpis: {
        totalRevenuePence,
        totalOrders,
        totalTickets,
        avgOrderValuePence: totalOrders ? Math.round(totalRevenuePence / totalOrders) : 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load analytics' });
  }
});

export default router;
