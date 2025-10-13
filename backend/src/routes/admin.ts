import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export const router = Router();

/**
 * Create/Update shows & ticket types (Admin)
 * NOTE: We use explicit type assertions to Prisma's *Unchecked* inputs
 * to avoid relational "connect" typing noise and the TS errors you hit.
 */

// ---------- Create Show ----------
const ShowInput = z.object({
  title: z.string(),
  startsAtUTC: z.string(), // ISO string
  venueId: z.string(),
  capacity: z.number().int().min(0),
  description: z.string().optional(),
  trailerUrl: z.string().url().optional()
});

router.post(
  '/shows',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const body = ShowInput.safeParse(req.body);
    if (!body.success) return res.status(400).json(body.error);

    const data: Prisma.ShowUncheckedCreateInput = {
      title: body.data.title,
      startsAtUTC: new Date(body.data.startsAtUTC),
      venueId: body.data.venueId,
      capacity: body.data.capacity,
      sold: 0,
      status: 'ON_SALE',
      description: body.data.description ?? null,
      trailerUrl: body.data.trailerUrl ?? null
    };

    const show = await prisma.show.create({ data });
    res.json(show);
  }
);

// ---------- Update Show ----------
const ShowUpdate = ShowInput.partial();

router.patch(
  '/shows/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const body = ShowUpdate.safeParse(req.body);
    if (!body.success) return res.status(400).json(body.error);

    // Build a partial update object explicitly to avoid TS inference issues
    const update: Prisma.ShowUncheckedUpdateInput = {};
    if (body.data.title !== undefined) update.title = body.data.title;
    if (body.data.startsAtUTC !== undefined)
      update.startsAtUTC = new Date(body.data.startsAtUTC);
    if (body.data.venueId !== undefined) update.venueId = body.data.venueId;
    if (body.data.capacity !== undefined) update.capacity = body.data.capacity;
    if (body.data.description !== undefined)
      update.description = body.data.description;
    if (body.data.trailerUrl !== undefined)
      update.trailerUrl = body.data.trailerUrl;

    const show = await prisma.show.update({
      where: { id: req.params.id },
      data: update
    });
    res.json(show);
  }
);

// ---------- Create Ticket Type ----------
const TicketTypeInput = z.object({
  name: z.string(),
  pricePence: z.number().int().min(0),
  allocation: z.number().int().min(0),
  sort: z.number().int().optional()
});

router.post(
  '/shows/:id/ticket-types',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const body = TicketTypeInput.safeParse(req.body);
    if (!body.success) return res.status(400).json(body.error);

    const data: Prisma.TicketTypeUncheckedCreateInput = {
      showId: req.params.id,
      name: body.data.name,
      pricePence: body.data.pricePence,
      allocation: body.data.allocation,
      sold: 0,
      sort: body.data.sort ?? 0,
      createdAt: undefined, // let DB default
      updatedAt: undefined  // let DB default
    };

    const tt = await prisma.ticketType.create({ data });
    res.json(tt);
  }
);

export default router;
