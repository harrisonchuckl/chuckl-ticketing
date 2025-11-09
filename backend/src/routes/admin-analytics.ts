import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// KPIs
router.get('/analytics/summary', requireAdminOrOrganiser, async (_req, res) => {
  try {
    const [paidOrders, refunds, ticketsSold] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'PAID' },
        select: { amountPence: true, platformFeePence: true, paymentFeePence: true, netPayoutPence: true },
      }),
      prisma.refund.findMany({ select: { amount: true } }),
      prisma.ticket.count({ where: { status: 'VALID' } }),
    ]);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0);

    const revenuePence = sum(paidOrders.map((o) => o.amountPence || 0));
    const platformFeesPence = sum(paidOrders.map((o) => o.platformFeePence || 0));
    const paymentFeesPence = sum(paidOrders.map((o) => o.paymentFeePence || 0));
    const netPayoutPence = sum(paidOrders.map((o) => o.netPayoutPence || 0));
    const refundsPence = sum(refunds.map((r) => r.amount || 0));

    res.json({
      ok: true,
      kpis: {
        revenuePence,
        platformFeesPence,
        paymentFeesPence,
        netPayoutPence,
        refundsPence,
        ticketsSold,
        orders: paidOrders.length,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed' });
  }
});

// Daily sales trend (gross + net)
router.get('/analytics/sales-trend', requireAdminOrOrganiser, async (_req, res) => {
  try {
    // last 30 days
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const rows = await prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: since } },
      select: { createdAt: true, amountPence: true, netPayoutPence: true },
      orderBy: { createdAt: 'asc' },
    });

    // bucket by day
    const map = new Map<string, { revenuePence: number; netPayoutPence: number }>();
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const cur = map.get(day) || { revenuePence: 0, netPayoutPence: 0 };
      cur.revenuePence += r.amountPence || 0;
      cur.netPayoutPence += r.netPayoutPence || 0;
      map.set(day, cur);
    }
    const days = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, revenuePence: v.revenuePence, netPayoutPence: v.netPayoutPence }));

    res.json({ ok: true, days });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed' });
  }
});

// Top shows by revenue
router.get('/analytics/top-shows', requireAdminOrOrganiser, async (_req, res) => {
  try {
    const shows = await prisma.show.findMany({
      select: {
        id: true,
        title: true,
        date: true,
        orders: { where: { status: 'PAID' }, select: { amountPence: true } },
      },
      orderBy: { date: 'desc' },
      take: 20,
    });
    const items = shows
      .map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        revenuePence: s.orders.reduce((a, b) => a + (b.amountPence || 0), 0),
      }))
      .sort((a, b) => b.revenuePence - a.revenuePence)
      .slice(0, 10);

    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed' });
  }
});

export default router;
