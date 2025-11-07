// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics/summary
 * Returns headline metrics: total revenue, tickets sold, refund amount, etc.
 */
router.get('/summary', requireAdmin, async (_req, res) => {
  try {
    const [orders, refunds, tickets] = await Promise.all([
      prisma.order.aggregate({
        _sum: { amountPence: true, quantity: true },
        where: { status: { in: ['PAID', 'REFUNDED'] } }
      }),
      prisma.refund.aggregate({
        _sum: { amount: true }
      }),
      prisma.ticket.count()
    ]);

    const totalRevenue = (orders._sum.amountPence || 0) / 100;
    const totalRefunds = (refunds._sum.amount || 0) / 100;
    const netRevenue = totalRevenue - totalRefunds;

    res.json({
      ok: true,
      metrics: {
        totalRevenue,
        totalRefunds,
        netRevenue,
        ticketsSold: orders._sum.quantity || 0,
        totalTickets: tickets
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Failed to load summary' });
  }
});

/**
 * GET /admin/analytics/sales-trend
 * Returns revenue and tickets sold grouped by day for charts.
 */
router.get('/sales-trend', requireAdmin, async (_req, res) => {
  try {
    const data = await prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        SUM("amountPence") / 100 AS revenue,
        SUM("quantity") AS tickets
      FROM "Order"
      WHERE "status" IN ('PAID', 'REFUNDED')
      GROUP BY 1
      ORDER BY 1 ASC;
    `);
    res.json({ ok: true, trend: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Failed to load trend data' });
  }
});

/**
 * GET /admin/analytics/top-shows
 * Returns top 5 shows by revenue.
 */
router.get('/top-shows', requireAdmin, async (_req, res) => {
  try {
    const data = await prisma.order.groupBy({
      by: ['showId'],
      _sum: { amountPence: true, quantity: true },
      where: { status: { in: ['PAID', 'REFUNDED'] } },
      orderBy: { _sum: { amountPence: 'desc' } },
      take: 5
    });

    const enriched = await Promise.all(
      data.map(async (d) => {
        const show = d.showId ? await prisma.show.findUnique({ where: { id: d.showId } }) : null;
        return {
          showTitle: show?.title || 'Unknown',
          venue: show?.venueId ? (await prisma.venue.findUnique({ where: { id: show.venueId } }))?.name : null,
          revenue: (d._sum.amountPence || 0) / 100,
          tickets: d._sum.quantity || 0
        };
      })
    );

    res.json({ ok: true, topShows: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Failed to load top shows' });
  }
});

export default router;
