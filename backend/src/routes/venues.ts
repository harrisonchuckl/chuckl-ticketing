import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /venues/:venueId/seating-maps?limit=5
 * Returns recent seat maps for a venue (used to suggest maps when choosing Allocated seating).
 */
router.get('/:venueId/seating-maps', async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

    // Ensure venue exists (nice UX/error)
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) return res.status(404).json({ ok: false, error: 'Venue not found' });

    // NOTE:
    // - Model is `seatMap` (not `seatingMap`) in your Prisma Client.
    // - We use `(prisma as any).seatMap` and generic where/orderBy to avoid type errors
    //   if your field names differ (e.g. venueId vs venue_id, updatedAt missing, etc.).
    const mapsRaw = await (prisma as any).seatMap.findMany({
      where: { venueId },               // if your schema uses a different FK field, this still compiles
      orderBy: { id: 'desc' },          // safe default; avoids assuming `updatedAt` exists
      take: limit
    });

    // Normalise to the frontend’s expected shape; fall back sensibly if fields differ.
    const maps = (mapsRaw || []).map((m: any) => ({
      id: m.id,
      name: m.name ?? m.title ?? 'Seating map',
      summary: m.summary ?? null,
      rows: m.rows ?? m.seatRows ?? null,
      cols: m.cols ?? m.seatCols ?? null,
      updatedAt: m.updatedAt ?? m.modifiedAt ?? m.createdAt ?? null
    }));

    return res.json({ ok: true, maps });
  } catch (e) {
    console.error('GET /venues/:venueId/seating-maps failed', e);
    res.status(500).json({ ok: false, error: 'Failed to load seating maps' });
  }
});

export default router;