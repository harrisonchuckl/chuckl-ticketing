// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * Create a venue (with optional fee policy fields)
 * POST /admin/venues
 */
router.post('/venues', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      postcode,
      capacity,

      // Venue fee policy
      feePercentBps,
      perTicketFeePence,
      basketFeePence,
      organiserSplitBps,
    } = req.body || {};

    if (!name) return res.status(400).json({ ok: false, message: 'Name is required' });

    const v = await prisma.venue.create({
      data: {
        name,
        address: address ?? null,
        city: city ?? null,
        postcode: postcode ?? null,
        capacity: typeof capacity === 'number' ? capacity : null,

        feePercentBps: typeof feePercentBps === 'number' ? feePercentBps : null,
        perTicketFeePence: typeof perTicketFeePence === 'number' ? perTicketFeePence : null,
        basketFeePence: typeof basketFeePence === 'number' ? basketFeePence : null,
        organiserSplitBps: typeof organiserSplitBps === 'number' ? organiserSplitBps : null,
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
        organiserSplitBps: true,
      },
    });

    res.json({ ok: true, venue: v });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to create venue' });
  }
});

/**
 * Find venues (basic search over name/city/postcode)
 * GET /admin/venues?q=...
 */
router.get('/venues', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q as string) || '';

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { city: { contains: q } },
            { postcode: { contains: q } },
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
        organiserSplitBps: true,
      },
      take: 200,
    });

    res.json({ ok: true, venues });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to fetch venues' });
  }
});

/**
 * Update a venue (including fee policy)
 * PATCH /admin/venues/:id
 */
router.patch('/venues/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const {
      name,
      address,
      city,
      postcode,
      capacity,

      feePercentBps,
      perTicketFeePence,
      basketFeePence,
      organiserSplitBps,
    } = req.body || {};

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (postcode !== undefined) data.postcode = postcode;
    if (capacity !== undefined) data.capacity = capacity === null ? null : Number(capacity);

    if (feePercentBps !== undefined) data.feePercentBps = feePercentBps === null ? null : Number(feePercentBps);
    if (perTicketFeePence !== undefined) data.perTicketFeePence = perTicketFeePence === null ? null : Number(perTicketFeePence);
    if (basketFeePence !== undefined) data.basketFeePence = basketFeePence === null ? null : Number(basketFeePence);
    if (organiserSplitBps !== undefined) data.organiserSplitBps = organiserSplitBps === null ? null : Number(organiserSplitBps);

    const venue = await prisma.venue.update({
      where: { id },
      data,
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
        organiserSplitBps: true,
      },
    });

    res.json({ ok: true, venue });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to update venue' });
  }
});

export default router;
