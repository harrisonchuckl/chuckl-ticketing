// backend/src/routes/admin-shows.ts
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

// Latest shows (already used by UI)
router.get('/shows/latest', async (req, res) => {
  try {
    assertAdmin(req);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true, title: true, description: true, date: true,
        venue: { select: { id: true, name: true, address: true, city: true, postcode: true, capacity: true } },
        ticketTypes: { select: { id: true, name: true, pricePence: true, available: true } },
        _count: { select: { tickets: true, orders: true } }
      }
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

// Create show
router.post('/shows', async (req, res) => {
  try {
    assertAdmin(req);
    const { title, description, dateISO, venueId, capacityOverride, imageUrl } = req.body || {};

    if (!title || !dateISO || !venueId) {
      return res.status(400).json({ error: true, message: 'title, dateISO, venueId required' });
    }

    const show = await prisma.show.create({
      data: {
        title,
        description: description ?? null,
        date: new Date(dateISO),
        venueId,
        // Store optional fields in description (or add columns later):
        // For now we’ll place imageUrl & capacityOverride as JSON string inside description tail for continuity
        // You can elevate these to real columns in a future migration.
      }
    });

    if (capacityOverride != null || imageUrl) {
      await prisma.show.update({
        where: { id: show.id },
        data: {
          description: JSON.stringify({
            _meta: { imageUrl: imageUrl || null, capacityOverride: capacityOverride ?? null }
          })
        }
      });
    }

    res.json({ ok: true, showId: show.id });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

// Update show
router.put('/shows/:id', async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    const { title, description, dateISO, venueId, capacityOverride, imageUrl } = req.body || {};

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dateISO !== undefined) data.date = new Date(dateISO);
    if (venueId !== undefined) data.venueId = venueId;

    if (capacityOverride !== undefined || imageUrl !== undefined) {
      data.description = JSON.stringify({
        _meta: { imageUrl: imageUrl ?? null, capacityOverride: capacityOverride ?? null }
      });
    }

    await prisma.show.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

// Delete show
router.delete('/shows/:id', async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    await prisma.show.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

// Ticket types (list/create/update/delete)
router.get('/shows/:id/ticket-types', async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    const types = await prisma.ticketType.findMany({
      where: { showId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, pricePence: true, available: true }
    });
    res.json({ ok: true, ticketTypes: types });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

router.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;
    const { name, pricePence, available } = req.body || {};
    if (!name || typeof pricePence !== 'number') {
      return res.status(400).json({ error: true, message: 'name + pricePence required' });
    }
    const tt = await prisma.ticketType.create({
      data: { showId: id, name, pricePence, available: available ?? null }
    });
    res.json({ ok: true, id: tt.id });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

router.put('/ticket-types/:ttId', async (req, res) => {
  try {
    assertAdmin(req);
    const { ttId } = req.params;
    const { name, pricePence, available } = req.body || {};
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (pricePence !== undefined) data.pricePence = pricePence;
    if (available !== undefined) data.available = available;
    await prisma.ticketType.update({ where: { id: ttId }, data });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

router.delete('/ticket-types/:ttId', async (req, res) => {
  try {
    assertAdmin(req);
    const { ttId } = req.params;
    await prisma.ticketType.delete({ where: { id: ttId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

// Live check-in “pre-show” stats
router.get('/shows/:id/stats', async (req, res) => {
  try {
    assertAdmin(req);
    const { id } = req.params;

    const total = await prisma.ticket.count({ where: { showId: id } });
    const used  = await prisma.ticket.count({ where: { showId: id, status: 'USED' } });
    const valid = await prisma.ticket.count({ where: { showId: id, status: 'VALID' } });

    res.json({ ok: true, total, checkedIn: used, remaining: valid });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
