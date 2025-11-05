// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

function isAdmin(req: any) {
  const key = req.headers['x-admin-key'] ?? req.query.k;
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

router.get('/venues', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: true, message: 'Unauthorized' });
  const venues = await prisma.venue.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, city: true, postcode: true, capacity: true }
  });
  res.json({ ok: true, venues });
});

export default router;
