import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export const router = Router();

/**
 * TEMP bootstrap endpoint:
 * Creates one Venue, one Show (in 7 days), and one TicketType.
 * Security: requires header x-bootstrap-key: <BOOTSTRAP_KEY>.
 * Delete this after seeding real data.
 */
router.post('/bootstrap', async (req: Request, res: Response) => {
  const key = req.headers['x-bootstrap-key'];
  if (!key || key !== process.env.BOOTSTRAP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const venue = await prisma.venue.create({
    data: {
      name: 'Chuckl. Cambridge',
      address: 'Corn Exchange, Cambridge',
      county: 'Cambridgeshire'
    }
  });

  const show = await prisma.show.create({
    data: {
      title: 'Friday Night at Chuckl',
      startsAtUTC: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      venueId: venue.id,
      capacity: 250,
      sold: 0,
      status: 'ON_SALE',
      description: 'A proper night of stand-up.'
    } satisfies Prisma.ShowUncheckedCreateInput
  });

  const tt = await prisma.ticketType.create({
    data: {
      showId: show.id,
      name: 'General Admission',
      pricePence: 2000, // £20.00
      allocation: 200,
      sold: 0,
      sort: 1
    } satisfies Prisma.TicketTypeUncheckedCreateInput
  });

  res.json({
    venueId: venue.id,
    showId: show.id,
    ticketTypeId: tt.id,
    message: 'Bootstrap complete. Use these IDs in /checkout/create.'
  });
});

export default router;
