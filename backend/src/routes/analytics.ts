// backend/src/routes/analytics.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
 * KPI totals + daily time-series for PAID orders across everything.
 */
router.get('/analytics/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const whereOrders: any = {};
    if (from || to) {
      whereOrders.createdAt = {};
      if (from) whereOrders.createdAt.gte = from;
      if (to) whereOrders.createdAt.lte = to;
    }

    const orders = await prisma.order.findMany({
      where: whereOrders,
      include: { tickets: true },
    });

    const paidOrders = orders.filter(o => o.status === 'PAID');
    const refundedOrders = orders.filter(o => o.status === 'REFUNDED');

    const ordersCount = paidOrders.length;
    const revenuePence = paidOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);
    const refundsPence = refundedOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);
    const ticketsSold = paidOrders.reduce((sum, o) => sum + (o.tickets?.length || 0), 0);
    const avgOrderValuePence = ordersCount ? Math.round(revenuePence / ordersCount) : 0;

    const seriesMap: Record<string, { revenuePence: number; orders: number; tickets: number }> = {};
    for (const o of paidOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!seriesMap[key]) seriesMap[key] = { revenuePence: 0, orders: 0, tickets: 0 };
      seriesMap[key].revenuePence += (o.amountPence || 0);
      seriesMap[key].orders += 1;
      seriesMap[key].tickets += (o.tickets?.length || 0);
    }
    const series = Object.entries(seriesMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      ok: true,
      kpis: {
        ordersCount,
        ticketsSold,
        revenuePence,
        refundsPence,
        avgOrderValuePence,
      },
      series,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Analytics failed' });
  }
});

/**
 * GET /admin/analytics/show/:id
 * Per-show KPI breakdown + daily series + ticket-type breakdown.
 */
router.get('/analytics/show/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const showId = String(req.params.id);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        ticketTypes: true,
        orders: { include: { tickets: true } },
      },
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    const paid = show.orders.filter(o => o.status === 'PAID');
    const refunded = show.orders.filter(o => o.status === 'REFUNDED');

    const ordersCount = paid.length;
    const revenuePence = paid.reduce((s, o) => s + (o.amountPence || 0), 0);
    const refundedRevenuePence = refunded.reduce((s, o) => s + (o.amountPence || 0), 0);
    const ticketsSold = paid.reduce((s, o) => s + (o.tickets?.length || 0), 0);

    const byDayMap: Record<string, { revenuePence: number; orders: number; tickets: number }> = {};
    for (const o of paid) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!byDayMap[key]) byDayMap[key] = { revenuePence: 0, orders: 0, tickets: 0 };
      byDayMap[key].revenuePence += (o.amountPence || 0);
      byDayMap[key].orders += 1;
      byDayMap[key].tickets += (o.tickets?.length || 0);
    }
    const series = Object.entries(byDayMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Ticket-type breakdown: price * count of tickets sold referencing order.showId and ticketTypes
    const ttCounts: Record<string, { name: string; pricePence: number; sold: number }> = {};
    for (const tt of show.ticketTypes) {
      ttCounts[tt.id] = { name: tt.name, pricePence: tt.pricePence, sold: 0 };
    }
    // We don't have explicit item lines; approximate by distributing tickets evenly by price match.
    // If your schema later adds OrderItems (with ticketTypeId), replace this logic accordingly.
    for (const o of paid) {
      for (const t of o.tickets) {
        // No ticketTypeId on Ticket model — best-effort: skip counting per TT if we cannot match.
        // (Safe behaviour: aggregate as "Unknown" if not matchable.)
        // Keeping simple: add into a virtual "Unknown" bucket.
        if (!ttCounts['__unknown__']) ttCounts['__unknown__'] = { name: 'Unknown', pricePence: 0, sold: 0 };
        ttCounts['__unknown__'].sold += 1;
      }
    }
    const ticketTypeBreakdown = Object.values(ttCounts);

    res.json({
      ok: true,
      show: {
        id: show.id,
        title: show.title,
        date: show.date,
        venue: show.venue ? { id: show.venue.id, name: show.venue.name, city: show.venue.city, postcode: show.venue.postcode } : null,
      },
      kpis: {
        ordersCount,
        ticketsSold,
        revenuePence,
        refundedRevenuePence,
      },
      series,
      ticketTypeBreakdown,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Show analytics failed' });
  }
});

export default router;
