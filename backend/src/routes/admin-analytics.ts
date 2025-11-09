// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../lib/authz.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/analytics/sales?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns daily totals (and platform fee if the column exists).
 */
router.get('/analytics/sales', requireAdmin, async (req, res) => {
  try {
    const start = String(req.query.start || '').trim();
    const end = String(req.query.end || '').trim();

    const startDate = start ? new Date(start + 'T00:00:00Z') : new Date(Date.now() - 30 * 86400000);
    const endDate = end ? new Date(end + 'T23:59:59Z') : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['PAID', 'REFUNDED'] },
      },
      select: {
        id: true,
        createdAt: true,
        amountPence: true,
        // if your schema already has this, great; if not, it will just be undefined at runtime
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        platformFeePence: true as any,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const bucket = new Map<string, { gross: number; platform: number }>();

    for (const o of orders) {
      const k = dayKey(o.createdAt);
      const b = bucket.get(k) || { gross: 0, platform: 0 };
      b.gross += o.amountPence ?? 0;
      // tolerate absence of platformFeePence
      const pf = (o as any).platformFeePence ?? 0;
      b.platform += pf;
      bucket.set(k, b);
    }

    const points = Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        amountPence: v.gross,
        platformFeePence: v.platform,
      }));

    res.json({ ok: true, points });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || 'Failed to load analytics' });
  }
});

export default router;
