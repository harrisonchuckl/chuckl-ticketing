// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

function isAdmin(req: any) {
  const key = req.headers['x-admin-key'] ?? req.query.k;
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

/**
 * GET /admin/shows/latest?limit=20
 * Used by Admin UI list
 */
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

/**
 * GET /admin/shows/:id
 * Detailed view for one show + basic stats
 */
router.get('/shows/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const { id } = req.params;
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } }
    }
  });
  if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

  // Basic check-in stats (USED = scanned)
  const total = await prisma.ticket.count({ where: { showId: id } });
  const used = await prisma.ticket.count({ where: { showId: id, status: 'USED' } });
  const remaining = Math.max(0, total - used);

  res.json({
    ok: true,
    show,
    stats: { checkedIn: used, remaining, total }
  });
});

/**
 * POST /admin/shows
 * Minimal create (you can enhance later)
 * body: { title, date, venueId, description?, capacityOverride? }
 */
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

  // Optional: seed a default ticket type with capacity override
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
