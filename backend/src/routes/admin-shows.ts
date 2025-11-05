// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

function isAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

// ---------- Helpers ----------
function requireAdmin(req: any, res: any): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return false;
  }
  return true;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out: any = {};
  for (const k of keys) out[k] = (obj as any)[k];
  return out;
}

// ---------- READ ----------
router.get('/admin/shows/latest', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));

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

// ---------- CREATE ----------
router.post('/admin/shows', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const {
    title,
    description,
    date,          // ISO string
    venueId,
    capacity,      // optional override
    imageUrl       // optional
  } = req.body || {};

  if (!title || !date || !venueId) {
    return res.status(400).json({ error: true, message: 'Missing required fields (title, date, venueId).' });
  }

  // Use venue capacity unless override provided
  let finalCapacity: number | null = null;
  try {
    const venue = await prisma.venue.findUnique({ where: { id: String(venueId) } });
    if (!venue) return res.status(404).json({ error: true, message: 'Venue not found' });
    finalCapacity = Number.isFinite(Number(capacity)) ? Number(capacity) : (venue.capacity ?? null);
  } catch {
    return res.status(400).json({ error: true, message: 'Invalid venueId' });
  }

  const created = await prisma.show.create({
    data: {
      title: String(title),
      description: description ? String(description) : null,
      date: new Date(date),
      venueId: String(venueId),
      // store image URL as part of description JSON (simple placeholder until assets table)
      // or you may add a dedicated column if you prefer
      // here we append "[imageUrl]: ..." to description for now (non-breaking)
      ...(imageUrl
        ? { description: ((description ? String(description) + '\n' : '') + `[imageUrl]: ${String(imageUrl)}`).trim() }
        : {})
    }
  });

  // If capacity known -> seed a single TicketType with that availability (optional)
  if (finalCapacity && finalCapacity > 0) {
    await prisma.ticketType.create({
      data: {
        showId: created.id,
        name: 'General Admission',
        pricePence: 2000,        // default £20.00; editable later
        available: finalCapacity
      }
    });
  }

  res.json({ ok: true, show: created });
});

// ---------- UPDATE ----------
router.put('/admin/shows/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { id } = req.params;
  const { title, description, date, venueId, imageUrl } = req.body || {};

  const data: any = {};
  if (title !== undefined) data.title = String(title);
  if (description !== undefined) data.description = String(description);
  if (date !== undefined) data.date = new Date(date);
  if (venueId !== undefined) data.venueId = String(venueId);
  if (imageUrl !== undefined) {
    data.description = ((data.description ? data.description + '\n' : (description ? String(description) + '\n' : '')) + `[imageUrl]: ${String(imageUrl)}`).trim();
  }

  try {
    const updated = await prisma.show.update({
      where: { id: String(id) },
      data
    });
    res.json({ ok: true, show: updated });
  } catch (e) {
    res.status(400).json({ error: true, message: 'Update failed (invalid ID?)' });
  }
});

// ---------- DELETE ----------
router.delete('/admin/shows/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { id } = req.params;

  // Delete ticket types first (FK)
  await prisma.ticketType.deleteMany({ where: { showId: String(id) } });
  // Tickets and orders will still be present in real life; here we block delete if tickets exist.
  const tCount = await prisma.ticket.count({ where: { showId: String(id) } });
  if (tCount > 0) {
    return res.status(409).json({
      error: true,
      message: 'Cannot delete a show that already has tickets. Archive instead.'
    });
  }

  try {
    await prisma.show.delete({ where: { id: String(id) } });
    res.json({ ok: true, deleted: id });
  } catch {
    res.status(400).json({ error: true, message: 'Delete failed (invalid ID?)' });
  }
});

export default router;
