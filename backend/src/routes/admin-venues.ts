// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/venues
 * Optional q= search across name/city/postcode
 */
router.get('/venues', requireAdmin, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
          { postcode: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const venues = await prisma.venue.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      postcode: true,
      capacity: true,
      feePercentBps: true,
      perTicketFeePence: true,
      basketFeePence: true,
    },
  });

  res.json({ ok: true, items: venues });
});

/**
 * POST /admin/venues
 */
router.post('/venues', requireAdmin, async (req, res) => {
  const { name, address, city, postcode, capacity, feePercentBps, perTicketFeePence, basketFeePence } = req.body ?? {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name is required' });

  const created = await prisma.venue.create({
    data: {
      name,
      address: address ?? null,
      city: city ?? null,
      postcode: postcode ?? null,
      capacity: typeof capacity === 'number' ? capacity : null,
      feePercentBps: typeof feePercentBps === 'number' ? feePercentBps : null,
      perTicketFeePence: typeof perTicketFeePence === 'number' ? perTicketFeePence : null,
      basketFeePence: typeof basketFeePence === 'number' ? basketFeePence : null,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      postcode: true,
      capacity: true,
      feePercentBps: true,
      perTicketFeePence: true,
      basketFeePence: true,
    },
  });

  res.json({ ok: true, item: created });
});

/**
 * PATCH /admin/venues/:id
 */
router.patch('/venues/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { name, address, city, postcode, capacity, feePercentBps, perTicketFeePence, basketFeePence } = req.body ?? {};

  const updated = await prisma.venue.update({
    where: { id },
    data: {
      name: name ?? undefined,
      address: address ?? undefined,
      city: city ?? undefined,
      postcode: postcode ?? undefined,
      capacity: typeof capacity === 'number' ? capacity : undefined,
      feePercentBps: typeof feePercentBps === 'number' ? feePercentBps : undefined,
      perTicketFeePence: typeof perTicketFeePence === 'number' ? perTicketFeePence : undefined,
      basketFeePence: typeof basketFeePence === 'number' ? basketFeePence : undefined,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      postcode: true,
      capacity: true,
      feePercentBps: true,
      perTicketFeePence: true,
      basketFeePence: true,
    },
  });

  res.json({ ok: true, item: updated });
});

export default router;
