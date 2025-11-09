// backend/src/routes/admin-venues.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// Create venue
router.post('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      name, address, city, postcode, capacity,
      feePercentBps, perTicketFeePence, basketFeePence, organiserSplitBps,
    } = req.body || {};

    const v = await prisma.venue.create({
      data: {
        name,
        address: address ?? null,
        city: city ?? null,
        postcode: postcode ?? null,
        capacity: capacity == null ? null : Number(capacity),

        feePercentBps:   feePercentBps   == null ? 0 : Number(feePercentBps),
        perTicketFeePence: perTicketFeePence == null ? 0 : Number(perTicketFeePence),
        basketFeePence:  basketFeePence  == null ? 0 : Number(basketFeePence),
        organiserSplitBps: organiserSplitBps == null ? 5000 : Number(organiserSplitBps),
      }
    });
    res.json({ ok: true, venue: v });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to create venue' });
  }
});

// Update venue
router.patch('/venues/:id', requireAdminOrOrganiser, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name, address, city, postcode, capacity,
      feePercentBps, perTicketFeePence, basketFeePence, organiserSplitBps,
    } = req.body || {};

    const v = await prisma.venue.update({
      where: { id },
      data: {
        ...(name != null ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(postcode !== undefined ? { postcode } : {}),
        ...(capacity !== undefined ? { capacity: capacity == null ? null : Number(capacity) } : {}),

        ...(feePercentBps !== undefined ? { feePercentBps: Number(feePercentBps ?? 0) } : {}),
        ...(perTicketFeePence !== undefined ? { perTicketFeePence: Number(perTicketFeePence ?? 0) } : {}),
        ...(basketFeePence !== undefined ? { basketFeePence: Number(basketFeePence ?? 0) } : {}),
        ...(organiserSplitBps !== undefined ? { organiserSplitBps: Number(organiserSplitBps ?? 5000) } : {}),
      }
    });
    res.json({ ok: true, venue: v });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to update venue' });
  }
});

// Find venues (simple search)
router.get('/venues', requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { name:   { contains: q, mode: 'insensitive' } },
            { city:   { contains: q, mode: 'insensitive' } },
            { postcode: { contains: q, mode: 'insensitive' } },
          ]
        }
      : undefined;

    const venues = await prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, address: true, city: true, postcode: true, capacity: true,
        feePercentBps: true, perTicketFeePence: true, basketFeePence: true, organiserSplitBps: true,
      }
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to fetch venues' });
  }
});

// Get single venue
router.get('/venues/:id', requireAdminOrOrganiser, async (req, res) => {
  try {
    const v = await prisma.venue.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, address: true, city: true, postcode: true, capacity: true,
        feePercentBps: true, perTicketFeePence: true, basketFeePence: true, organiserSplitBps: true,
      }
    });
    if (!v) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, venue: v });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e.message || 'Failed to fetch venue' });
  }
});

export default router;
