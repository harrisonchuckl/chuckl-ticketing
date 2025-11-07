// backend/src/routes/admin.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/ping
 */
router.get('/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

/**
 * GET /admin/shows/brief
 * Very light list used by older UI bits
 */
router.get('/shows/brief', async (_req, res) => {
  try {
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      include: {
        venue: true,
        _count: { select: { orders: true, ticketTypes: true } }
      },
      take: 50
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load shows' });
  }
});

export default router;
