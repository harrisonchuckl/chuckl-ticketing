// backend/src/routes/analytics.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns KPI totals + daily sales time-series (PAID orders).
 */
router.get('/analytics/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const whereOrders: any = { };
    if (from || to) {
      whereOrders.createdAt = {};
      if (from) whereOrders.createdAt.gte = from;
      if (to) whereOrders.createdAt.lte = to;
    }

    // Pull orders + tickets
    const orders = await prisma.order.findMany({
      where: whereOrders,
      include: { tickets: true },
    });

    // KPIs
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const refundedOrders = orders.filter(o => o.status === 'REFUNDED');

    const ordersCount = paidOrders.length;
    const revenuePence = paidOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);
    const refundsPence = refundedOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);
    const ticketsSold = paidOrders.reduce((sum, o) => sum + (o.tickets?.length || 0), 0);
    const avgOrderValuePence = ordersCount ? Math.round(revenuePence / ordersCount) : 0;

    // Daily series (paid only)
    const seriesMap: Record<string, { revenuePence: number; orders: number; tickets: number }> = {};
    for (const o of paidOrders) {
      const d = new Date(o.createdAt);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
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

export default router;
