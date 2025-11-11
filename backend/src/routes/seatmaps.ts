// backend/src/routes/seatmaps.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import type {
  Seat,
  SeatMap,
  Show,
  ExternalAllocation,
  AllocationSeat,
  SeatStatus,
} from '@prisma/client';

const router = Router();

/**
 * Create a seat map for a venue
 * body: { venueId: string, name: string, version?: number, isDefault?: boolean, layout?: object }
 */
router.post('/api/seatmaps', async (req: Request, res: Response) => {
  try {
    const {
      venueId,
      name,
      version = 1,
      isDefault = false,
      layout = null,
    }: {
      venueId: string;
      name: string;
      version?: number;
      isDefault?: boolean;
      layout?: Record<string, unknown> | null;
    } = req.body || {};

    if (!venueId || !name) {
      return res.status(400).json({ error: 'venueId and name are required' });
    }

    const created = await prisma.seatMap.create({
      data: { venueId, name, version, isDefault, layout: layout as any },
    });

    return res.json(created);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /api/seatmaps error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Get a seat map with zones and seats
 */
router.get('/api/seatmaps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const map = await prisma.seatMap.findUnique({
      where: { id },
      include: {
        zones: true,
        seats: true,
      },
    });

    if (!map) return res.status(404).json({ error: 'Not found' });

    // Type the maps to avoid implicit any
    const seats = (map.seats as Seat[]).map((s: Seat) => ({
      id: s.id,
      rowLabel: s.rowLabel,
      seatNumber: s.seatNumber,
      label: s.label,
      kind: s.kind,
      status: s.status,
      level: s.level,
      zoneId: s.zoneId,
    }));

    return res.json({
      ...map,
      seats,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/seatmaps/:id error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Toggle availability for seats on a seat map
 * body: { seatIds: string[], status: "AVAILABLE" | "UNAVAILABLE" | "BLOCKED" }
 */
router.post(
  '/api/seatmaps/:id/seats/toggle',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        seatIds,
        status,
      }: { seatIds: string[]; status: SeatStatus } = req.body || {};

      if (!Array.isArray(seatIds) || seatIds.length === 0) {
        return res.status(400).json({ error: 'seatIds are required' });
      }
      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }

      // Make sure seat map exists
      const map = await prisma.seatMap.findUnique({ where: { id } });
      if (!map) return res.status(404).json({ error: 'Seat map not found' });

      // Batch update
      await prisma.seat.updateMany({
        where: { id: { in: seatIds }, seatMapId: id },
        data: { status },
      });

      // Return the changed seats to caller
      const changed = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
      });

      const payload = (changed as Seat[]).map((seat: Seat) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        status: seat.status,
      }));

      return res.json({ updated: payload });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('POST /api/seatmaps/:id/seats/toggle error', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * Create an external allocation for a show and attach seats.
 * body: { label: string, externalPlatform?: string, contactEmail?: string, notes?: string, seatIds: string[] }
 */
router.post(
  '/api/shows/:showId/allocations',
  async (req: Request, res: Response) => {
    try {
      const { showId } = req.params;
      const {
        label,
        externalPlatform,
        contactEmail,
        notes,
        seatIds,
      }: {
        label: string;
        externalPlatform?: string;
        contactEmail?: string;
        notes?: string;
        seatIds: string[];
      } = req.body || {};

      if (!label || !Array.isArray(seatIds) || seatIds.length === 0) {
        return res
          .status(400)
          .json({ error: 'label and seatIds are required' });
      }

      const show: Show | null = await prisma.show.findUnique({
        where: { id: showId },
      });
      if (!show) return res.status(404).json({ error: 'Show not found' });

      // Create allocation
      const allocation: ExternalAllocation = await prisma.externalAllocation.create(
        {
          data: {
            showId,
            label,
            externalPlatform: externalPlatform ?? null,
            contactEmail: contactEmail ?? null,
            notes: notes ?? null,
          },
        }
      );

      // Get seat snapshots for fast reporting
      const seats = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
        select: {
          id: true,
          rowLabel: true,
          seatNumber: true,
          level: true,
        },
      });

      // Create allocation seats in batch
      const values = seats.map((s) => ({
        allocationId: allocation.id,
        seatId: s.id,
        rowLabel: s.rowLabel,
        seatNumber: s.seatNumber,
        level: s.level ?? null,
      }));

      if (values.length > 0) {
        await prisma.allocationSeat.createMany({ data: values });
      }

      const out = values.map(
        (s: {
          allocationId: string;
          seatId: string;
          rowLabel: string;
          seatNumber: string;
          level: string | null;
        }) => ({
          seatId: s.seatId,
          row: s.rowLabel,
          seat: s.seatNumber,
          level: s.level,
        })
      );

      return res.json({
        allocationId: allocation.id,
        label: allocation.label,
        seats: out,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('POST /api/shows/:showId/allocations error', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * Simple CSV report for an allocation (copy/paste friendly)
 */
router.get(
  '/api/shows/:showId/allocations/:allocationId/report.csv',
  async (req: Request, res: Response) => {
    try {
      const { showId, allocationId } = req.params;

      const alloc = await prisma.externalAllocation.findFirst({
        where: { id: allocationId, showId },
        include: { seats: true },
      });

      if (!alloc) return res.status(404).send('Not found');

      const lines = [
        'Row,Seat,Level',
        ...alloc.seats.map(
          (s: AllocationSeat) =>
            `${s.rowLabel},${s.seatNumber},${s.level ?? ''}`
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="allocation-${allocationId}.csv"`
      );
      return res.send(lines.join('\n'));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('GET allocation CSV error', err);
      return res.status(500).send('Internal error');
    }
  }
);

export default router;