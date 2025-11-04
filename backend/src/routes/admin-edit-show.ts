// backend/src/routes/admin-edit-show.ts
import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/** Simple admin-gate via x-admin-key header or ?k= query */
function requireAdmin(req: any): string | null {
  const headerKey = req.headers['x-admin-key'];
  const queryKey = req.query?.k;
  const key = String(headerKey || queryKey || '');
  if (!key || key !== String(process.env.BOOTSTRAP_KEY)) return null;
  return key;
}

/** GET /admin/shows/:id
 *  Returns a single show with venue and ticket types
 */
router.get('/shows/:id', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const id = String(req.params.id);
  try {
    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: true,
        ticketTypes: {
          orderBy: { createdAt: 'asc' }
        },
        _count: { select: { tickets: true, orders: true } }
      }
    });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });
    return res.json({ ok: true, show });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

/** PATCH /admin/shows/:id
 *  Body: { title?, description?, date?, venueId? }
 */
router.patch('/shows/:id', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const id = String(req.params.id);
  const { title, description, date, venueId } = req.body || {};

  const data: any = {};
  if (typeof title === 'string') data.title = title.trim();
  if (typeof description === 'string') data.description = description;
  if (typeof venueId === 'string' && venueId.length > 0) data.venueId = venueId;
  if (typeof date === 'string' || date instanceof Date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: true, message: 'Invalid date' });
    data.date = d;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: true, message: 'No fields to update' });
  }

  try {
    const updated = await prisma.show.update({
      where: { id },
      data,
      include: { venue: true, ticketTypes: true }
    });
    return res.json({ ok: true, show: updated });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed to update' });
  }
});

/** GET /admin/shows/:id/ticket-types */
router.get('/shows/:id/ticket-types', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });
  const id = String(req.params.id);
  try {
    const list = await prisma.ticketType.findMany({
      where: { showId: id },
      orderBy: { createdAt: 'asc' }
    });
    return res.json({ ok: true, ticketTypes: list });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

/** POST /admin/shows/:id/ticket-types
 *  Body: { name: string, pricePence: number, available?: number }
 */
router.post('/shows/:id/ticket-types', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const showId = String(req.params.id);
  const { name, pricePence, available } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: true, message: 'Name required' });
  }
  const price = Number(pricePence);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: true, message: 'pricePence must be a positive integer' });
  }
  const avail = available == null ? null : Number(available);

  try {
    const tt = await prisma.ticketType.create({
      data: {
        showId,
        name: name.trim(),
        pricePence: Math.round(price),
        available: avail == null || isNaN(avail) ? null : Math.round(avail)
      }
    });
    return res.json({ ok: true, ticketType: tt });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed to create ticket type' });
  }
});

/** PATCH /admin/ticket-types/:id
 *  Body: { name?, pricePence?, available? }
 */
router.patch('/ticket-types/:id', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const id = String(req.params.id);
  const { name, pricePence, available } = req.body || {};
  const data: any = {};

  if (typeof name === 'string') data.name = name.trim();
  if (pricePence != null) {
    const p = Number(pricePence);
    if (!Number.isFinite(p) || p < 0) return res.status(400).json({ error: true, message: 'Invalid pricePence' });
    data.pricePence = Math.round(p);
  }
  if (available != null) {
    const a = Number(available);
    if (!Number.isFinite(a) || a < 0) return res.status(400).json({ error: true, message: 'Invalid available' });
    data.available = Math.round(a);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: true, message: 'No fields to update' });
  }

  try {
    const updated = await prisma.ticketType.update({
      where: { id },
      data
    });
    return res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed to update ticket type' });
  }
});

/** DELETE /admin/ticket-types/:id */
router.delete('/ticket-types/:id', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });

  const id = String(req.params.id);
  try {
    const deleted = await prisma.ticketType.delete({ where: { id } });
    return res.json({ ok: true, ticketType: deleted });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed to delete ticket type' });
  }
});

export default router;
