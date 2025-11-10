// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// List venues (search by name/city/postcode)
router.get('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const where = q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { postcode: { contains: q, mode: 'insensitive' } },
      ]
    } : {};

    const items = await prisma.venue.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true, name: true, address: true, city: true, postcode: true, capacity: true,
        feePercentBps: true, perTicketFeePence: true, basketFeePence: true,
      }
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error('GET /admin/venues failed', e);
    res.status(500).json({ ok: false, error: 'Failed to list venues' });
  }
});

// Create venue
router.post('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      name, address, city, postcode, capacity,
      feePercentBps, perTicketFeePence, basketFeePence,
    } = req.body || {};

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }

    const created = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        postcode: postcode ? String(postcode).trim() : null,
        capacity: capacity != null ? Number(capacity) : null,
        feePercentBps: feePercentBps != null ? Number(feePercentBps) : null,
        perTicketFeePence: perTicketFeePence != null ? Number(perTicketFeePence) : null,
        basketFeePence: basketFeePence != null ? Number(basketFeePence) : null,
      },
      select: {
        id: true, name: true, city: true, postcode: true, capacity: true,
        feePercentBps: true, perTicketFeePence: true, basketFeePence: true,
      }
    });

    res.json({ ok: true, venue: created });
  } catch (e) {
    console.error('POST /admin/venues failed', e);
    res.status(500).json({ ok: false, error: 'Failed to create venue' });
  }
});

export default router;
