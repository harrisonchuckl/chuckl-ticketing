// backend/src/routes/events.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /events
 * Query:
 *  - q: string (search in title, venue name, city, postcode)
 *  - city: string
 *  - venueId: string
 *  - month: YYYY-MM
 *  - upcoming: '1' (default) or '0'
 *  - page: number (default 1)
 *  - pageSize: number (default 20, max 100)
 *  - order: 'asc' | 'desc' (by date, default asc)
 */
router.get('/', async (req, res) => {
  try {
    const {
      q = '',
      city = '',
      venueId = '',
      month = '',
      upcoming = '1',
      page = '1',
      pageSize = '20',
      order = 'asc',
    } = (req.query || {}) as Record<string, string>;

    const take = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    // Month bounds if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    }

    const now = new Date();

    const where: any = {
      AND: [
        upcoming === '1' ? { date: { gte: now } } : {},
        startDate && endDate ? { date: { gte: startDate, lt: endDate } } : {},
        city ? { venue: { city: { equals: city } } } : {},
        venueId ? { venueId } : {},
        q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { venue: { name: { contains: q, mode: 'insensitive' } } },
                { venue: { city: { contains: q, mode: 'insensitive' } } },
                { venue: { postcode: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {},
      ].filter(Boolean),
    };

    const orderBy = [{ date: order === 'desc' ? 'desc' : 'asc' }];

    const [items, total] = await Promise.all([
      prisma.show.findMany({
        where,
        include: {
          venue: true,
          ticketTypes: {
            select: { id: true, name: true, pricePence: true, available: true },
            orderBy: { pricePence: 'asc' },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.show.count({ where }),
    ]);

    res.json({
      ok: true,
      items,
      meta: { total, page: pageNum, pageSize: take, pages: Math.ceil(total / take) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load events' });
  }
});

/**
 * GET /events/cities
 */
router.get('/cities', async (req, res) => {
  try {
    const { upcoming = '1' } = (req.query || {}) as Record<string, string>;
    const now = new Date();
    const venues = await prisma.venue.findMany({
      where: { shows: { some: upcoming === '1' ? { date: { gte: now } } : {} } },
      select: { city: true },
      orderBy: { city: 'asc' },
    });
    const cities = Array.from(new Set((venues || []).map(v => (v.city || '').trim()).filter(Boolean)));
    res.json({ ok: true, cities });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load cities' });
  }
});

/**
 * GET /events/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: true,
        ticketTypes: { select: { id: true, name: true, pricePence: true, available: true }, orderBy: { pricePence: 'asc' } },
      },
    });
    if (!show) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, show });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load event' });
  }
});

/**
 * GET /events/venue/:venueId (list shows for a venue; default upcoming)
 * Query: upcoming=1|0
 */
router.get('/venue/:venueId', async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const { upcoming = '1' } = (req.query || {}) as Record<string, string>;
    const now = new Date();

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ ok: false, error: 'Venue not found' });

    const items = await prisma.show.findMany({
      where: { venueId, ...(upcoming === '1' ? { date: { gte: now } } : {}) },
      include: {
        venue: true,
        ticketTypes: { select: { id: true, name: true, pricePence: true, available: true }, orderBy: { pricePence: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ ok: true, venue, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load venue shows' });
  }
});

export default router;
