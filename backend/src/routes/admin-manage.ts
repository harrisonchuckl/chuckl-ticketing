// backend/src/routes/admin-manage.ts
// A compact “manage” view aggregator used by your UI tabs
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/manage/overview
 * Quick dashboard numbers
 */
router.get('/manage/overview', async (_req, res) => {
  try {
    const [shows, venues, orders] = await Promise.all([
      prisma.show.count(),
      prisma.venue.count(),
      prisma.order.count()
    ]);
    res.json({ ok: true, metrics: { shows, venues, orders } });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load overview' });
  }
});

/**
 * GET /admin/manage/shows
 * Paginated shows list
 */
router.get('/manage/shows', async (req, res) => {
  try {
    const take = Math.max(1, Math.min(100, Number(req.query.take) || 20));
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      prisma.show.findMany({
        orderBy: { date: 'desc' },
        skip, take,
        include: {
          venue: true,
          _count: { select: { orders: true, ticketTypes: true } }
        }
      }),
      prisma.show.count()
    ]);

    res.json({ ok: true, items, total, page, take });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load shows' });
  }
});

export default router;
