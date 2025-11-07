// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import prisma from '../lib/db.js';

const router = Router;

/**
 * Helper: compute basic KPIs for a Show
 */
function computeKPIs(show: any) {
  const capacity = show.venue?.capacity ?? null;
  const totalAvailable = (show.ticketTypes || []).reduce((sum: number, t: any) => sum + (t.available ?? 0), 0);
  const ticketsSold = (show.orders || []).reduce((sum: number, o: any) => sum + (o.quantity ?? 0), 0);
  const revenuePence = (show.orders || [])
    .filter((o: any) => o.status === 'PAID' || o.status === 'REFUNDED') // revenue includes paid; refunds may be handled separately
    .reduce((sum: number, o: any) => sum + (o.amountPence ?? 0), 0);

  return {
    capacity,
    totalAvailable,
    ticketsSold,
    revenuePence,
  };
}

const R = Router();

/**
 * GET /admin/shows/latest
 */
R.get('/shows/latest', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 200);
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        venue: true,
        ticketTypes: { orderBy: { createdAt: 'desc' } },
        _count: { select: { orders: true } },
      },
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to fetch shows' });
  }
});

/**
 * GET /admin/shows/:id
 *  - includes venue, ticketTypes, orders (for KPI calc only)
 */
R.get('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: true,
        ticketTypes: { orderBy: { createdAt: 'desc' } },
        orders: { select: { id: true, amountPence: true, quantity: true, status: true } },
      },
    });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

    const kpis = computeKPIs(show);
    res.json({ ok: true, show, kpis });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to fetch show' });
  }
});

/**
 * PATCH /admin/shows/:id
 * body can include: title, description, date, venueId
 */
R.patch('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { title, description, date, venueId } = req.body || {};
    const show = await prisma.show.update({
      where: { id },
      data: {
        ...(title != null ? { title: String(title) } : {}),
        ...(description !== undefined ? { description: description ? String(description) : null } : {}),
        ...(date != null ? { date: new Date(date) } : {}),
        ...(venueId !== undefined ? { venueId: venueId ? String(venueId) : null } : {}),
      },
      include: { venue: true, ticketTypes: true },
    });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to update show' });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 * body: { name, pricePence, available }
 */
R.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { name, pricePence, available } = req.body || {};
    if (!name || pricePence == null) {
      return res.status(400).json({ error: true, message: 'name and pricePence required' });
    }
    const tt = await prisma.ticketType.create({
      data: {
        name: String(name),
        pricePence: Number(pricePence),
        available: available != null ? Number(available) : null,
        showId: id,
      },
    });
    res.json({ ok: true, ticketType: tt });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to create ticket type' });
  }
});

/**
 * PATCH /admin/ticket-types/:ticketTypeId
 * body: { name?, pricePence?, available? }
 */
R.patch('/ticket-types/:ticketTypeId', async (req, res) => {
  try {
    const ticketTypeId = String(req.params.ticketTypeId);
    const { name, pricePence, available } = req.body || {};
    const tt = await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        ...(name != null ? { name: String(name) } : {}),
        ...(pricePence != null ? { pricePence: Number(pricePence) } : {}),
        ...(available !== undefined ? { available: available == null ? null : Number(available) } : {}),
      },
    });
    res.json({ ok: true, ticketType: tt });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to update ticket type' });
  }
});

/**
 * DELETE /admin/ticket-types/:ticketTypeId
 */
R.delete('/ticket-types/:ticketTypeId', async (req, res) => {
  try {
    const ticketTypeId = String(req.params.ticketTypeId);
    await prisma.ticketType.delete({ where: { id: ticketTypeId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to delete ticket type' });
  }
});

/**
 * GET /admin/shows/:id/attendees.csv
 * CSV of tickets and basic order info
 */
R.get('/shows/:id/attendees.csv', async (req, res) => {
  try {
    const id = String(req.params.id);
    const tickets = await prisma.ticket.findMany({
      where: { order: { showId: id } },
      include: {
        order: { select: { id: true, email: true, status: true, createdAt: true } },
      },
      orderBy: { serial: 'asc' },
    });

    const rows = [
      ['Serial', 'HolderName', 'Status', 'ScannedAt', 'OrderId', 'OrderEmail', 'OrderStatus', 'OrderDate'],
      ...tickets.map(t => [
        t.serial,
        t.holderName ?? '',
        t.status ?? '',
        t.scannedAt ? new Date(t.scannedAt).toISOString() : '',
        t.order?.id ?? '',
        t.order?.email ?? '',
        t.order?.status ?? '',
        t.order?.createdAt ? new Date(t.order.createdAt).toISOString() : '',
      ]),
    ];

    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendees.csv"');
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to export attendees' });
  }
});

export default R;
