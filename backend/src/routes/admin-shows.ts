// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

function isAdmin(req: any) {
  const key = req.headers['x-admin-key'] ?? req.query.k;
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

// Latest list (used by Admin UI)
router.get('/shows/latest', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });
  const limit = Math.min(50, Number(req.query.limit ?? 20));
  const shows = await prisma.show.findMany({
    orderBy: { date: 'desc' },
    take: limit,
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } }
    }
  });
  res.json({ ok: true, shows });
});

// Create show (for future Admin form)
router.post('/shows', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });
  const { title, date, venueId, description, capacityOverride } = req.body || {};
  if (!title || !date || !venueId) {
    return res.status(400).json({ error: true, message: 'title, date, venueId required' });
  }
  const show = await prisma.show.create({
    data: {
      title,
      description: description ?? null,
      date: new Date(date),
      venueId
    }
  });

  // capacityOverride is optional; ticket types are separate
  if (capacityOverride && Number(capacityOverride) > 0) {
    await prisma.ticketType.create({
      data: {
        showId: show.id,
        name: 'General Admission',
        pricePence: 0,
        available: Number(capacityOverride)
      }
    });
  }

  res.json({ ok: true, show });
});

export default router;
