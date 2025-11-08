// backend/src/routes/admin-analytics.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * Helpers
 */
function parseRange(q: Request['query']) {
  const now = new Date();
  const to = q.to ? new Date(String(q.to)) : now;
  const from =
    q.from ? new Date(String(q.from)) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  // normalise to day bounds for consistency
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function dayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * GET /admin/analytics/summary
 * Returns high-level KPIs for a date range (default last 30 days)
 */
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req.query);

    // Sum paid order amounts in range
    const paidOrders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: from, lte: to },
      },
      select: { amountPence: true, id: true, quantity: true },
    });

    const totalPaidPence = paidOrders.reduce((sum, o) => sum + (o.amountPence ?? 0), 0);

    // Sum refunds in range
    const refunds = await prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { amount: true },
    });
    const totalRefundsPence = refunds.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    // Net revenue
    const revenuePence = totalPaidPence - totalRefundsPence;

    // Tickets sold = count of tickets belonging to paid orders in range
    const tickets = await prisma.ticket.findMany({
      where: {
        order: { status: 'PAID', createdAt: { gte: from, lte: to } },
      },
      select: { id: true },
    });
    const ticketsSold = tickets.length;

    // Orders count
    const ordersCount = paidOrders.length;

    // Live shows (upcoming)
    const showsLive = await prisma.show.count({
      where: { date: { gte: new Date() } },
    });

    res.json({
      ok: true,
      range: { from, to },
      kpis: {
        revenuePence,
        refundsPence: totalRefundsPence,
        ticketsSold,
        ordersCount,
        showsLive,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to compute summary' });
  }
});

/**
 * GET /admin/analytics/sales-trend
 * Returns daily series for revenue and tickets (default last 30 days)
 */
router.get('/analytics/sales-trend', async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req.query);

    // Paid orders in range
    const orders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: from, lte: to } },
      select: { id: true, amountPence: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Tickets in range (for paid orders)
    const tickets = await prisma.ticket.findMany({
      where: { order: { status: 'PAID', createdAt: { gte: from, lte: to } } },
      select: { id: true, order: { select: { createdAt: true } } },
    });

    // Build day buckets
    const seriesMap = new Map<string, { date: string; revenuePence: number; tickets: number }>();

    // seed all days in range with zeros (for charts with gaps)
    const cursor = new Date(from.getTime());
    while (cursor <= to) {
      const k = dayKey(cursor);
      seriesMap.set(k, { date: k, revenuePence: 0, tickets: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // add revenue by order day
    for (const o of orders) {
      const k = dayKey(o.createdAt);
      const prev = seriesMap.get(k);
      const amount = o.amountPence ?? 0;
      if (prev) prev.revenuePence += amount;
      else seriesMap.set(k, { date: k, revenuePence: amount, tickets: 0 });
    }

    // add tickets by ticket->order day
    for (const t of tickets) {
      const createdAt = t.order?.createdAt ?? new Date();
      const k = dayKey(createdAt);
      const prev = seriesMap.get(k);
      if (prev) prev.tickets += 1;
      else seriesMap.set(k, { date: k, revenuePence: 0, tickets: 1 });
    }

    const series = Array.from(seriesMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    res.json({ ok: true, range: { from, to }, series });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to compute trend' });
  }
});

/**
 * GET /admin/analytics/top-shows
 * Returns top shows by revenue in range (default last 30 days)
 * ?limit=5
 */
router.get('/analytics/top-shows', async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req.query);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 5)));

    // Pull paid orders with their show
    const orders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: from, lte: to },
        showId: { not: null },
      },
      select: {
        amountPence: true,
        showId: true,
        show: { select: { id: true, title: true, date: true, venue: { select: { name: true } } } },
      },
    });

    // Aggregate by showId
    const agg = new Map<
      string,
      { showId: string; title: string; date: Date | null; venueName: string | null; revenuePence: number }
    >();

    for (const o of orders) {
      const key = o.showId as string;
      const info = agg.get(key) ?? {
        showId: key,
        title: o.show?.title ?? 'Untitled show',
        date: o.show?.date ?? null,
        venueName: o.show?.venue?.name ?? null,
        revenuePence: 0,
      };
      info.revenuePence += o.amountPence ?? 0;
      agg.set(key, info);
    }

    const list = Array.from(agg.values())
      .sort((a, b) => b.revenuePence - a.revenuePence)
      .slice(0, limit);

    res.json({ ok: true, range: { from, to }, items: list });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to compute top shows' });
  }
});

export default router;
