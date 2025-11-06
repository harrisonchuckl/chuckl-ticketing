// backend/src/routes/admin-tickettypes.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

/** Admin auth via header OR ?k= */
function isAdmin(req: Request): boolean {
  const headerKey = (req.headers['x-admin-key'] ?? '') as string;
  const queryKey = (req.query.k ?? '') as string;
  const key = headerKey || queryKey;
  return !!key && String(key) === String(process.env.BOOTSTRAP_KEY);
}
function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return false;
  }
  return true;
}

/** List ticket types for a show */
router.get('/shows/:showId/ticket-types', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.showId);

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

  const types = await prisma.ticketType.findMany({
    where: { showId },
    orderBy: [{ createdAt: 'asc' }]
  });

  res.json({ ok: true, ticketTypes: types });
});

/** Create a ticket type */
router.post('/shows/:showId/ticket-types', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.showId);
  const { name, pricePence, available } = req.body || {};

  if (!name || typeof pricePence !== 'number') {
    return res.status(400).json({ error: true, message: 'name and pricePence are required' });
  }
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

  const created = await prisma.ticketType.create({
    data: {
      showId,
      name: String(name),
      pricePence: Math.max(0, Math.floor(pricePence)),
      available: typeof available === 'number' ? Math.max(0, Math.floor(available)) : null
    }
  });

  res.json({ ok: true, ticketType: created });
});

/** Update a ticket type */
router.put('/shows/:showId/ticket-types/:typeId', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.showId);
  const typeId = String(req.params.typeId);
  const { name, pricePence, available } = req.body || {};

  const tt = await prisma.ticketType.findFirst({ where: { id: typeId, showId } });
  if (!tt) return res.status(404).json({ error: true, message: 'Ticket type not found' });

  const data: any = {};
  if (typeof name === 'string') data.name = name;
  if (typeof pricePence === 'number') data.pricePence = Math.max(0, Math.floor(pricePence));
  if (typeof available === 'number' || available === null) {
    data.available = available === null ? null : Math.max(0, Math.floor(available));
  }

  const updated = await prisma.ticketType.update({
    where: { id: typeId },
    data
  });

  res.json({ ok: true, ticketType: updated });
});

/** Delete a ticket type */
router.delete('/shows/:showId/ticket-types/:typeId', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const showId = String(req.params.showId);
  const typeId = String(req.params.typeId);

  const tt = await prisma.ticketType.findFirst({ where: { id: typeId, showId } });
  if (!tt) return res.status(404).json({ error: true, message: 'Ticket type not found' });

  await prisma.ticketType.delete({ where: { id: typeId } });
  res.json({ ok: true, deleted: true, id: typeId });
});

export default router;
