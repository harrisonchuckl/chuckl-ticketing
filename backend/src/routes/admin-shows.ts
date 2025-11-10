import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/shows
 * Lists upcoming shows with venue and ticket type count.
 */
router.get('/shows', requireAdminOrOrganiser, async (_req, res) => {
  try {
    const items = await prisma.show.findMany({
      orderBy: [{ date: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        imageUrl: true,
        venue: {
          select: { id: true, name: true, city: true },
        },
        _count: { select: { ticketTypes: true, orders: true } },
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error('GET /admin/shows failed', e);
    res.status(500).json({ ok: false, error: 'Failed to load shows' });
  }
});

/**
 * POST /admin/shows
 * Creates a show and (optionally) its first ticket type in one go.
 * body: { title, description?, date, venueId, imageUrl?, ticket?: { name, pricePence, available? } }
 */
router.post('/shows', requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      venueId,
      imageUrl,
      ticket,
    } = req.body || {};

    if (!title || !date || !venueId) {
      return res
        .status(400)
        .json({ ok: false, error: 'title, date and venueId are required' });
    }

    const created = await prisma.show.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description) : null,
        date: new Date(date),
        venue: { connect: { id: String(venueId) } },
        imageUrl: imageUrl ? String(imageUrl) : null,
      },
      select: { id: true, title: true, date: true, venueId: true },
    });

    if (ticket && ticket.name && ticket.pricePence != null) {
      await prisma.ticketType.create({
        data: {
          name: String(ticket.name).trim(),
          pricePence: Number(ticket.pricePence),
          available: ticket.available != null ? Number(ticket.available) : null,
          show: { connect: { id: created.id } },
        },
      });
    }

    res.json({ ok: true, show: created });
  } catch (e) {
    console.error('POST /admin/shows failed', e);
    res.status(500).json({ ok: false, error: 'Failed to create show' });
  }
});

export default router;
