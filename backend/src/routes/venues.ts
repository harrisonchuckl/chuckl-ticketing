import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /venues/:venueId/seating-maps?limit=5
 * Returns recent saved seating maps to suggest during allocated seating setup.
 */
router.get('/:venueId/seating-maps', async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

    // Ensure venue exists (optional but helps UX)
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ ok: false, error: 'Venue not found' });

    const maps = await prisma.seatingMap.findMany({
      where: { venueId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        summary: true,
        rows: true,
        cols: true,
        updatedAt: true,
      },
    });

    res.json({ ok: true, maps });
  } catch (e) {
    console.error('GET /venues/:venueId/seating-maps failed', e);
    res.status(500).json({ ok: false, error: 'Failed to load seating maps' });
  }
});

export default router;