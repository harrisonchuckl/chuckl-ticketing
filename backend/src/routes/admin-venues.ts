// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireAdmin } from '../lib/authz.js';

const prisma = new PrismaClient();
const router = Router();

// Create / update venue
router.post('/venues', requireAdmin, async (req, res) => {
  try {
    const {
      id,
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

    const data: Prisma.VenueUncheckedCreateInput = {
      name,
      address: address ?? null,
      city: city ?? null,
      postcode: postcode ?? null,
      capacity: capacity ?? null,
      feePercentBps: feePercentBps ?? null,
      perTicketFeePence: perTicketFeePence ?? null,
      basketFeePence: basketFeePence ?? null,
      organiserSplitBps: organiserSplitBps ?? 5000,
    };

    const venue = id
      ? await prisma.venue.update({ where: { id }, data })
      : await prisma.venue.create({ data });

    res.json({ ok: true, venue });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || 'Failed to save venue' });
  }
});

// Search venues
router.get('/venues', requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where: Prisma.VenueWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { city: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { postcode: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined;

    const venues = await prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 50,
    });

    res.json({ ok: true, venues });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || 'Failed to load venues' });
  }
});

export default router;
