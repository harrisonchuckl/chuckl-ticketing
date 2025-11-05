// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// Simple admin gate via header
function assertAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
}

// List venues (id, name, capacity, location)
router.get('/venues', async (req, res) => {
  try {
    assertAdmin(req);
    const venues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, capacity: true, address: true, city: true, postcode: true
      }
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
