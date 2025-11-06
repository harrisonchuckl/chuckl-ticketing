// backend/src/routes/admin-venues.ts
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// List venues (simple search by name/city/postcode)
router.get('/venues', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { postcode: { contains: q, mode: 'insensitive' } }
          ]
        }
      : {};
    const venues = await prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load venues' });
  }
});

// Create a new venue
router.post('/venues', async (req: Request, res: Response) => {
  try {
    const { name, address, city, postcode, capacity } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: true, message: 'Venue name is required' });
    }
    const cap = capacity == null || capacity === '' ? null : Number(capacity);
    const created = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        postcode: postcode ? String(postcode).trim() : null,
        capacity: Number.isFinite(cap) ? cap : null
      }
    });
    res.json({ ok: true, venue: created });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to create venue' });
  }
});

export default router;
