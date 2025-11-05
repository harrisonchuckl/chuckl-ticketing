// backend/src/routes/admin-venues.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

/** Admin auth via header OR ?k= support */
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

/** List venues (optional search) */
router.get('/venues', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = (req.query.q ? String(req.query.q) : '').trim();
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { postcode: { contains: q, mode: 'insensitive' } }
    ];
  }

  const venues = await prisma.venue.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    take: limit
  });

  res.json({ ok: true, venues });
});

/** Read one venue */
router.get('/venues/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) return res.status(404).json({ error: true, message: 'Venue not found' });
  res.json({ ok: true, venue });
});

/** Create venue */
router.post('/venues', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, address, city, postcode, capacity } = req.body || {};
  if (!name) return res.status(400).json({ error: true, message: 'name is required' });

  const ven = await prisma.venue.create({
    data: {
      name: String(name),
      address: address ? String(address) : null,
      city: city ? String(city) : null,
      postcode: postcode ? String(postcode) : null,
      capacity: typeof capacity === 'number' ? Math.max(0, Math.floor(capacity)) : null
    }
  });

  res.json({ ok: true, venue: ven });
});

/** Update venue */
router.put('/venues/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const { name, address, city, postcode, capacity } = req.body || {};
  const data: any = {};
  if (typeof name === 'string') data.name = name;
  if (typeof address === 'string' || address === null) data.address = address;
  if (typeof city === 'string' || city === null) data.city = city;
  if (typeof postcode === 'string' || postcode === null) data.postcode = postcode;
  if (typeof capacity === 'number' || capacity === null) {
    data.capacity = capacity === null ? null : Math.max(0, Math.floor(capacity));
  }

  try {
    const ven = await prisma.venue.update({ where: { id }, data });
    res.json({ ok: true, venue: ven });
  } catch {
    res.status(404).json({ error: true, message: 'Venue not found' });
  }
});

/** Delete venue (rare; usually avoid deleting referenced records) */
router.delete('/venues/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  try {
    await prisma.venue.delete({ where: { id } });
    res.json({ ok: true, deleted: true, id });
  } catch {
    res.status(400).json({ error: true, message: 'Unable to delete venue (in use?)' });
  }
});

export default router;
