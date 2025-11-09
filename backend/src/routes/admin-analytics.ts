// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Simple revenue + fees rollup for now.
 */
router.get('/analytics', requireAdmin, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;

  const where = {
    status: 'PAID' as const,
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(to ? { createdAt: { lte: to } } : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      amountPence: true,
      platformFeePence: true,
      organiserSharePence: true,
      paymentFeePence: true,
      netPayoutPence: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let gross = 0;
  let platformFee = 0;
  let organiserShare = 0;
  let paymentFees = 0;
  let netPayout = 0;

  for (const o of orders) {
    gross += o.amountPence ?? 0;
    platformFee += o.platformFeePence ?? 0;
    organiserShare += o.organiserSharePence ?? 0;
    paymentFees += o.paymentFeePence ?? 0;
    netPayout += o.netPayoutPence ?? 0;
  }

  res.json({
    ok: true,
    totals: {
      gross,
      platformFee,
      organiserShare,
      ourShare: platformFee - organiserShare,
      paymentFees,
      netPayout,
      count: orders.length,
    },
    items: orders,
  });
});

export default router;
