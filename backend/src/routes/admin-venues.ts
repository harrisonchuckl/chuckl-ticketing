// backend/src/routes/admin-venues.ts
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

router.get('/venues', async (req, res) => {
  try {
    assertAdmin(req);
    const venues = await prisma.venue.findMany({
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, city: true, postcode: true, capacity: true }
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

router.post('/venues', async (req, res) => {
  try {
    assertAdmin(req);
    const { name, capacity, address, city, postcode } = req.body || {};
    if (!name) return res.status(400).json({ error: true, message: 'name required' });
    const venue = await prisma.venue.create({
      data: {
        name: String(name),
        capacity: capacity ? Number(capacity) : null,
        address: address ? String(address) : null,
        city: city ? String(city) : null,
        postcode: postcode ? String(postcode) : null
      },
      select: { id: true, name: true, capacity: true, city: true, postcode: true }
    });
    res.json({ ok: true, venue });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
