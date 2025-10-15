import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/**
 * GET /events
 * Lists upcoming shows with venue and ticket types.
 */
router.get('/', async (_req, res) => {
  try {
    const now = new Date();
    const shows = await prisma.show.findMany({
      where: { date: { gte: now } },
      orderBy: { date: 'asc' },
      include: {
        venue: true,
        ticketTypes: { orderBy: { pricePence: 'asc' } },
      },
    });
    res.json({ shows });
  } catch (e: any) {
    res.status(500).json({ error: 'list_failed', detail: String(e?.message || e) });
  }
});

/**
 * GET /events/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: {
        venue: true,
        ticketTypes: { orderBy: { pricePence: 'asc' } },
      },
    });
    if (!show) return res.status(404).json({ error: 'not_found' });
    res.json({ show });
  } catch (e: any) {
    res.status(500).json({ error: 'detail_failed', detail: String(e?.message || e) });
  }
});

export default router;
