// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import { requireAdmin } from '../lib/authz.js';
import prisma from '../lib/prisma.js';

const router = Router();

function foldTotals(orders: Array<{
  amountPence: number | null;
  platformFeePence: number | null;
  organiserSharePence: number | null;
  paymentFeePence: number | null;
  quantity: number | null;
}>) {
  let totalOrders = 0;
  let totalTickets = 0;
  let gross = 0;
  let platform = 0;
  let organiserShare = 0;
  let payment = 0;

  for (const o of orders) {
    totalOrders += 1;
    totalTickets += Number(o.quantity || 0);
    gross += Number(o.amountPence || 0);
    platform += Number(o.platformFeePence || 0);
    organiserShare += Number(o.organiserSharePence || 0);
    payment += Number(o.paymentFeePence || 0);
  }
  const ourShare = platform - organiserShare;
  const netPayout = gross - payment - ourShare;

  return {
    totalOrders,
    totalTickets,
    totalGrossPence: gross,
    totalPlatformFeePence: platform,
    totalOrganiserSharePence: organiserShare,
    totalPaymentFeePence: payment,
    totalNetPayoutPence: netPayout,
  };
}

/** Existing roll-up for Analytics page */
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
    const where: any = { status: 'PAID' };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        amountPence: true,
        platformFeePence: true,
        organiserSharePence: true,
        paymentFeePence: true,
        quantity: true,
      },
    });

    res.json({ ok: true, ...foldTotals(orders) });
  } catch (err) {
    console.error('GET /admin/analytics failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load analytics' });
  }
});

/** WTD & MTD for Home widget */
router.get('/analytics/summary', requireAdmin, async (_req, res) => {
  try {
    const now = new Date();

    // MTD
    const mtdStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const mtdOrders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: mtdStart } },
      select: {
        amountPence: true,
        platformFeePence: true,
        organiserSharePence: true,
        paymentFeePence: true,
        quantity: true,
      },
    });

    // WTD (Mon)
    const day = now.getUTCDay(); // 0..6
    const diffToMon = (day + 6) % 7;
    const wtdStart = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMon, 0, 0, 0, 0,
    ));
    const wtdOrders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: wtdStart } },
      select: {
        amountPence: true,
        platformFeePence: true,
        organiserSharePence: true,
        paymentFeePence: true,
        quantity: true,
      },
    });

    res.json({ ok: true, wtd: foldTotals(wtdOrders), mtd: foldTotals(mtdOrders) });
  } catch (err) {
    console.error('GET /admin/analytics/summary failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load summary' });
  }
});

/** MTD daily gross for chart (client renders the bars) */
router.get('/analytics/mtd-daily', requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const orders = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: start } },
      select: { createdAt: true, amountPence: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, number> = {};
    for (const o of orders) {
      const d = new Date(o.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      byDay[key] = (byDay[key] || 0) + Number(o.amountPence || 0);
    }

    const points = Object.entries(byDay).map(([date, grossPence]) => ({ date, grossPence }));
    res.json({ ok: true, points });
  } catch (err) {
    console.error('GET /admin/analytics/mtd-daily failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load MTD daily' });
  }
});

export default router;
