// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics/summary
 * Returns quick KPIs for the dashboard:
 *  - last 7 days
 *  - month-to-date
 *
 * Assumes Order has fields:
 *   amountPence, platformFeePence, organiserSharePence, paymentFeePence, netPayoutPence, status, createdAt
 */
router.get('/analytics/summary', requireAdminOrOrganiser, async (_req, res) => {
  try {
    const now = new Date();

    // last 7 days window
    const start7 = new Date(now);
    start7.setDate(now.getDate() - 7);

    // month-to-date (UTC month start)
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const baseSelect = {
      createdAt: true,
      amountPence: true,
      platformFeePence: true,
      organiserSharePence: true,
      paymentFeePence: true,
      netPayoutPence: true,
      status: true,
    } as const;

    const [last7Orders, mtdOrders] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'PAID', createdAt: { gte: start7, lte: now } },
        select: baseSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({
        where: { status: 'PAID', createdAt: { gte: startMonth, lte: now } },
        select: baseSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    function summarise(items: typeof last7Orders) {
      const orders = items.length;
      const gmvPence = items.reduce((a, o) => a + (o.amountPence ?? 0), 0);
      const ourFeesPence = items.reduce((a, o) => {
        const platform = o.platformFeePence ?? 0;
        const organiserShare = o.organiserSharePence ?? 0;
        return a + (platform - organiserShare);
      }, 0);
      const netPayoutPence = items.reduce((a, o) => a + (o.netPayoutPence ?? 0), 0);
      return { orders, gmvPence, ourFeesPence, netPayoutPence };
    }

    res.json({
      ok: true,
      summary: {
        last7: summarise(last7Orders),
        mtd: summarise(mtdOrders),
      },
    });
  } catch (err) {
    console.error('analytics/summary failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load analytics' });
  }
});

export default router;
