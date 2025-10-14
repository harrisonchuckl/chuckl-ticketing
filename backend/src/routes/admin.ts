import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import type { Prisma } from '@prisma/client';

export const router = Router();

// Prove the router is mounted
router.get('/bootstrap/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/**
 * Bootstrap: create Venue + Show + TicketType
 * Requires header: x-bootstrap-key: <BOOTSTRAP_KEY>
 */
router.post('/bootstrap', async (req: Request, res: Response) => {
  try {
    const headerKey = req.headers['x-bootstrap-key'];
    const envKey = process.env.BOOTSTRAP_KEY;

    if (!envKey) {
      console.error('BOOTSTRAP_KEY is missing in service variables');
      return res.status(500).json({ error: 'server_misconfigured', detail: 'BOOTSTRAP_KEY missing' });
    }
    if (!headerKey || headerKey !== envKey) {
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
  } catch (err: any) {
    console.error('Bootstrap error:', err?.stack || err);
    res.status(500).json({ error: 'bootstrap_failed', detail: String(err?.message || err) });
  }
});

export default router;
