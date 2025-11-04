// backend/src/routes/admin-create-show.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

/**
 * POST /admin/show/create
 * Create a new show (requires x-admin-key header = BOOTSTRAP_KEY)
 */
router.post('/show/create', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-admin-key'];
    if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
      return res.status(401).json({ error: true, message: 'Unauthorized' });
    }

    const {
      title,
      date,
      venueId,
      ticketPrice,
      imageUrl,
      capacity,
      description,
      capacityOverride,
    } = req.body;

    if (!title || !date || !venueId) {
      return res.status(400).json({ error: true, message: 'Missing required fields' });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ error: true, message: 'Venue not found' });

    const show = await prisma.show.create({
      data: {
        title,
        description: description || '',
        date: new Date(date),
        venue: { connect: { id: venue.id } },
        tickets: {},
        orders: {},
      },
      include: { venue: true },
    });

    return res.json({ ok: true, show });
  } catch (e: any) {
    console.error('Create show error:', e);
    res.status(500).json({ error: true, message: e.message || 'Internal error' });
  }
});

/**
 * GET /admin/venues
 * List venues for dropdowns
 */
router.get('/venues', async (req: Request, res: Response) => {
  try {
    const venues = await prisma.venue.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

export default router;
