// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// GET /admin/orders?q=&from=&to=
router.get('/orders', requireAdminOrOrganiser, async (req, res) => {
  const { q, from, to } = req.query as Record<string, string | undefined>;

  const where: any = {};

  // Date window
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      // make 'to' inclusive by bumping to the next day 00:00
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      where.createdAt.lte = end;
    }
  }

  // Search term
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { email: { contains: term, mode: 'insensitive' as const } },
      { stripeId: { contains: term, mode: 'insensitive' as const } },
      { show: { is: { title: { contains: term, mode: 'insensitive' as const } } } },
    ];
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      email: true,
      amountPence: true,
      status: true,
      platformFeePence: true,
      paymentFeePence: true,
      organiserSharePence: true,
      show: { select: { title: true } },
    },
    take: 500,
  });

  const items = rows.map((o) => {
    const netPayoutPence =
      (o.amountPence ?? 0) - (o.paymentFeePence ?? 0) - (o.platformFeePence ?? 0);
    return { ...o, netPayoutPence };
  });

  res.json({ ok: true, items });
});

export default router;
