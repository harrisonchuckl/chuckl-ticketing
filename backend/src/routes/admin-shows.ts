// backend/src/routes/admin-shows.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

/** Accept admin key via header OR query ?k= */
function isAdmin(req: Request): boolean {
  const headerKey = (req.headers['x-admin-key'] ?? '') as string;
  const queryKey = (req.query.k ?? '') as string;
  const key = headerKey || queryKey;
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return false;
  }
  return true;
}

/** -------- SHOWS: LIST (latest) --------
 * GET /admin/shows/latest?limit=20
 */
router.get('/shows/latest', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);

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

/** -------- SHOW: READ ONE --------
 * GET /admin/shows/:id
 */
router.get('/shows/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } }
    }
  });
  if (!show) return res.status(404).json({ error: true, message: 'Show not found' });
  res.json({ ok: true, show });
});

/** -------- SHOW: CREATE --------
 * POST /admin/shows
 * { title, description?, dateISO, venueId, posterUrl? }
 */
router.post('/shows', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { title, description, dateISO, venueId, posterUrl } = req.body || {};

  if (!title || !dateISO || !venueId) {
    return res.status(400).json({ error: true, message: 'title, dateISO and venueId are required' });
  }

  const date = new Date(dateISO);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: true, message: 'Invalid dateISO' });
  }

  const venue = await prisma.venue.findUnique({ where: { id: String(venueId) } });
  if (!venue) return res.status(400).json({ error: true, message: 'Venue not found' });

  const show = await prisma.show.create({
    data: {
      title: String(title),
      description: description ? String(description) : null,
      date,
      venueId: String(venueId)
      // Note: schema does not have posterUrl yet; we’ll store it soon when field exists.
    }
  });

  // Return with relations for immediate UI update
  const full = await prisma.show.findUnique({
    where: { id: show.id },
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } }
    }
  });

  res.json({ ok: true, show: full });
});

/** -------- SHOW: UPDATE --------
 * PUT /admin/shows/:id
 * Any of: { title?, description?, dateISO?, venueId? }
 */
router.put('/shows/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const { title, description, dateISO, venueId } = req.body || {};

  const data: any = {};
  if (typeof title === 'string') data.title = title;
  if (typeof description === 'string' || description === null) data.description = description;
  if (typeof venueId === 'string') data.venueId = venueId;
  if (typeof dateISO === 'string') {
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return res.status(400).json({ error: true, message: 'Invalid dateISO' });
    data.date = d;
  }

  try {
    await prisma.show.update({ where: { id }, data });
  } catch (e) {
    return res.status(404).json({ error: true, message: 'Show not found' });
  }

  const full = await prisma.show.findUnique({
    where: { id },
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } }
    }
  });
  res.json({ ok: true, show: full });
});

/** -------- SHOW: DELETE --------
 * DELETE /admin/shows/:id
 */
router.delete('/shows/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  try {
    // Consider soft-delete later; this hard-deletes
    await prisma.show.delete({ where: { id } });
  } catch (e) {
    return res.status(404).json({ error: true, message: 'Show not found' });
  }
  res.json({ ok: true, deleted: true, id });
});

/** -------- TICKET TYPES: LIST --------
 * GET /admin/shows/:id/ticket-types
 */
router.get('/shows/:id/ticket-types', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.id);
  const list = await prisma.ticketType.findMany({
    where: { showId },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ ok: true, ticketTypes: list });
});

/** -------- TICKET TYPES: CREATE --------
 * POST /admin/shows/:id/ticket-types
 * { name, pricePence, available? }
 */
router.post('/shows/:id/ticket-types', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.id);
  const { name, pricePence, available } = req.body || {};

  if (!name || typeof pricePence !== 'number') {
    return res.status(400).json({ error: true, message: 'name and pricePence required' });
  }

  // Ensure show exists
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

  const tt = await prisma.ticketType.create({
    data: {
      showId,
      name: String(name),
      pricePence: Math.floor(pricePence),
      available: typeof available === 'number' ? Math.max(0, Math.floor(available)) : null
    }
  });

  res.json({ ok: true, ticketType: tt });
});

/** -------- TICKET TYPES: UPDATE --------
 * PUT /admin/ticket-types/:ticketTypeId
 */
router.put('/ticket-types/:ticketTypeId', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.ticketTypeId);
  const { name, pricePence, available } = req.body || {};

  const data: any = {};
  if (typeof name === 'string') data.name = name;
  if (typeof pricePence === 'number') data.pricePence = Math.floor(pricePence);
  if (typeof available === 'number' || available === null) {
    data.available = available === null ? null : Math.max(0, Math.floor(available));
  }

  try {
    const tt = await prisma.ticketType.update({ where: { id }, data });
    res.json({ ok: true, ticketType: tt });
  } catch (e) {
    res.status(404).json({ error: true, message: 'Ticket type not found' });
  }
});

/** -------- TICKET TYPES: DELETE --------
 * DELETE /admin/ticket-types/:ticketTypeId
 */
router.delete('/ticket-types/:ticketTypeId', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.ticketTypeId);
  try {
    await prisma.ticketType.delete({ where: { id } });
    res.json({ ok: true, deleted: true, id });
  } catch (e) {
    res.status(404).json({ error: true, message: 'Ticket type not found' });
  }
});

/** -------- ORDERS (READ-ONLY BASIC) --------
 * GET /admin/orders?showId=…&status=…&q=…&page=1&limit=20
 */
router.get('/orders', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = req.query.showId ? String(req.query.showId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined; // PENDING/PAID/CANCELLED
  const q = req.query.q ? String(req.query.q).trim() : '';
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 100);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (showId) where.showId = showId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { stripeId: { contains: q, mode: 'insensitive' } }
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { show: { select: { id: true, title: true } } }
    })
  ]);

  res.json({ ok: true, page, limit, total, orders });
});

export default router;
