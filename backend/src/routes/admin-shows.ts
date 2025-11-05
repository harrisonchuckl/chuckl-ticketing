// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

function assertAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
}

/**
 * POST /admin/shows
 * body: { title, description?, date (ISO), venueId, capacityOverride?, posterUrl? }
 * Creates a Show and a default TicketType "General Admission"
 * with available = capacityOverride ?? venue.capacity ?? 100
 * pricePence default: 2000 (can adjust later in UI)
 */
router.post('/shows', async (req, res) => {
  try {
    assertAdmin(req);
    const { title, description, date, venueId, capacityOverride, posterUrl } = req.body || {};
    if (!title || !date || !venueId) {
      return res.status(400).json({ error: true, message: 'Missing title, date or venueId' });
    }
    const venue = await prisma.venue.findUnique({ where: { id: String(venueId) } });
    if (!venue) return res.status(404).json({ error: true, message: 'Venue not found' });

    const available = Number(capacityOverride ?? venue.capacity ?? 100);
    const when = new Date(date);

    const show = await prisma.show.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        date: when,
        venueId: String(venueId),
        // If you later add posterUrl to the schema, attach it there.
        ticketTypes: {
          create: {
            name: 'General Admission',
            pricePence: 2000,
            available: available
          }
        }
      },
      include: {
        venue: true,
        ticketTypes: true,
        _count: { select: { tickets: true, orders: true } }
      }
    });

    res.json({ ok: true, show });
  } catch (e: any) {
    console.error(e);
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

/**
 * GET /admin/shows/latest?limit=20
 */
router.get('/shows/latest', async (req, res) => {
  try {
    assertAdmin(req);
    const limit = Math.min(50, Number(req.query.limit || 20));
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        venue: { select: { id: true, name: true, city: true, postcode: true, capacity: true } },
        ticketTypes: true,
        _count: { select: { tickets: true, orders: true } }
      }
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
