import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { withAuth } from '../middleware/requireAuth.js';
import { readSession } from '../lib/auth.js';

const router = Router();
router.use(...withAuth());

// List venues (restricted to ones linked to user unless SUPERADMIN)
router.get('/venues', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    let venues;
    if (s.role === 'SUPERADMIN') {
      venues = await prisma.venue.findMany({ orderBy: { name: 'asc' } });
    } else {
      venues = await prisma.venue.findMany({
        where: { userLinks: { some: { userId: s.uid } } },
        orderBy: { name: 'asc' }
      });
    }
    return res.json({ venues });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// Create venue
router.post('/venues', async (req: Request, res: Response) => {
  try {
    const { name, capacity, address, city, postcode } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: true, message: 'Name required' });
    }
    const v = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        capacity: capacity != null && String(capacity).trim() !== '' ? Number(capacity) : null,
        address: address ? String(address) : null,
        city: city ? String(city) : null,
        postcode: postcode ? String(postcode) : null
      }
    });
    return res.json({ venue: v });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

export default router;
