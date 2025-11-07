// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/shows/latest?limit=20
 * Returns latest shows with venue and ticket types, plus counts for orders & ticketTypes
 */
router.get('/shows/latest', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        venue: true,
        ticketTypes: true,
        _count: { select: { orders: true, ticketTypes: true } }
      }
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load shows' });
  }
});

/**
 * POST /admin/shows
 * Create a new show
 * body: { title, description?, date (ISO), venueId?, imageUrl? }
 */
router.post('/shows', async (req, res) => {
  try {
    const { title, description, date, venueId } = req.body || {};
    if (!title || !date) {
      return res.status(400).json({ ok: false, message: 'title and date are required' });
    }
    const show = await prisma.show.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        date: new Date(String(date)),
        venueId: venueId ? String(venueId) : null
      }
    });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to create show' });
  }
});

/**
 * GET /admin/shows/:id
 * Single show
 */
router.get('/shows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const show = await prisma.show.findUnique({
      where: { id: String(id) },
      include: {
        venue: true,
        ticketTypes: true,
        orders: {
          include: { tickets: true }
        },
        _count: { select: { orders: true, ticketTypes: true } }
      }
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load show' });
  }
});

/**
 * PATCH /admin/shows/:id
 * Update basic fields
 */
router.patch('/shows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, venueId } = req.body || {};
    const updated = await prisma.show.update({
      where: { id: String(id) },
      data: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(description !== undefined ? { description: description ? String(description) : null } : {}),
        ...(date !== undefined ? { date: new Date(String(date)) } : {}),
        ...(venueId !== undefined ? { venueId: venueId ? String(venueId) : null } : {})
      }
    });
    res.json({ ok: true, show: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to update show' });
  }
});

/**
 * DELETE /admin/shows/:id
 */
router.delete('/shows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.show.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to delete show' });
  }
});

export default router;
