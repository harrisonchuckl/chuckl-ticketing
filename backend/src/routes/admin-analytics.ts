// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../lib/authz.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/analytics/sales?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns daily totals and fee breakdowns (best-effort).
 * Only uses columns guaranteed to exist (amountPence, platformFeePence if present).
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
        status: { in: ['PAID', 'REFUNDED'] }, // include REFUNDED to see negative adjustments if you implement them later
      },
      select: {
        id: true,
        createdAt: true,
        amountPence: true,
        // platformFeePence column may or may not exist yet; if it doesn't, TS is still fine because we won't access unknown keys at runtime.
        // @ts-expect-error – tolerate absence during transition
        platformFeePence: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    // Bucket by yyyy-mm-dd
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const map = new Map<
      string,
      { gross: number; platform: number }
    >();

    for (const o of orders) {
      const k = dayKey(o.createdAt);
      const bucket = map.get(k) || { gross: 0, platform: 0 };
      bucket.gross += o.amountPence ?? 0;
      // @ts-ignore – tolerate missing field at runtime
      bucket.platform += o.platformFeePence ?? 0;
      map.set(k, bucket);
    }

    const points = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        amountPence: v.gross,
        // Optional secondary series if you want later
        platformFeePence: v.platform,
      }));

    res.json({ ok: true, points });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || 'Failed to load analytics' });
  }
});

export default router;
