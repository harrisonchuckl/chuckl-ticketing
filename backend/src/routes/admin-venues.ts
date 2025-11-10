import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/venues?q=
 * Simple, case-insensitive search over name/city/postcode.
 */
router.get('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = (String(req.query.q || '').trim()) || null;

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { city: { contains: q, mode: 'insensitive' as const } },
            { postcode: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const items = await prisma.venue.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error('GET /admin/venues failed', e);
    res.status(500).json({ ok: false, error: 'Failed to load venues' });
  }
});

/**
 * POST /admin/venues
 * Create a venue (no fee fields here – fees are handled per-ticket / per-show).
 */
router.post('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      postcode,
      capacity,
    } = req.body || {};

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }

    const created = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        postcode: postcode ? String(postcode).trim() : null,
        capacity: capacity != null ? Number(capacity) : null,
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
      },
    });

    res.json({ ok: true, venue: created });
  } catch (e) {
    console.error('POST /admin/venues failed', e);
    res.status(500).json({ ok: false, error: 'Failed to create venue' });
  }
});

export default router;
