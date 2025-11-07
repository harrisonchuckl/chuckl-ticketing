// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * Utility: coerce primitives safely
 */
function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}
function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /admin/shows/latest?limit=20
 * Lightweight list for dashboards.
 */
router.get('/shows/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        venue: true,
        ticketTypes: true,
      },
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load shows' });
  }
});

/**
 * POST /admin/shows
 * Create new show
 * body: { title, description?, date, venueId?, capacityOverride?, imageUrl? }
 */
router.post('/shows', async (req, res) => {
  try {
    const { title, description, date, venueId, imageUrl } = req.body || {};
    if (!title || !date) {
      return res.status(400).json({ ok: false, message: 'title and date are required' });
    }

    const created = await prisma.show.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        date: new Date(String(date)),
        venueId: venueId ? String(venueId) : null,
      },
      include: {
        venue: true,
        ticketTypes: true,
      },
    });

    if (imageUrl) {
      // Optional: persist imageUrl in a future ShowAsset table or field
      // Skipping for now (placeholder)
    }

    res.json({ ok: true, show: created });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to create show' });
  }
});

/**
 * GET /admin/shows/:id
 * Returns show detail + KPIs
 */
router.get('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: true,
        ticketTypes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    // KPIs
    const paidAgg = await prisma.order.aggregate({
      _sum: { amountPence: true, quantity: true },
      _count: { _all: true },
      where: { showId: id, status: OrderStatus.PAID },
    });

    const allOrdersAgg = await prisma.order.aggregate({
      _sum: { quantity: true },
      _count: { _all: true },
      where: { showId: id },
    });

    const ticketsSold = await prisma.ticket.count({
      where: { order: { showId: id }, status: { in: ['VALID', 'SCANNED'] } },
    });

    const ticketsScanned = await prisma.ticket.count({
      where: { order: { showId: id }, status: 'SCANNED' },
    });

    const capacityFromVenue = show.venue?.capacity ?? null;
    const totalAvailableAcrossTypes =
      show.ticketTypes.reduce((acc, t) => acc + (t.available ?? 0), 0) || null;

    res.json({
      ok: true,
      show,
      kpis: {
        ordersTotal: allOrdersAgg._count._all || 0,
        ordersPaid: paidAgg._count._all || 0,
        revenuePence: paidAgg._sum.amountPence || 0,
        qtyOrderedTotal: allOrdersAgg._sum.quantity || 0,
        ticketsSold,
        ticketsScanned,
        capacity: capacityFromVenue,
        totalAvailableAcrossTypes,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load show detail' });
  }
});

/**
 * PUT /admin/shows/:id
 * Update basic show fields
 */
router.put('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { title, description, date, venueId } = req.body || {};

    const updated = await prisma.show.update({
      where: { id },
      data: {
        title: title ? String(title) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
        date: date ? new Date(String(date)) : undefined,
        venueId: venueId !== undefined ? (venueId ? String(venueId) : null) : undefined,
      },
      include: { venue: true, ticketTypes: true },
    });

    res.json({ ok: true, show: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to update show' });
  }
});

/**
 * Ticket Types — inline management under a show
 */

/** POST /admin/shows/:id/ticket-types  { name, pricePence, available? } */
router.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    const showId = String(req.params.id);
    const { name, pricePence, available } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, message: 'name required' });
    const price = asNumber(pricePence);
    if (price === null) return res.status(400).json({ ok: false, message: 'pricePence required' });

    const created = await prisma.ticketType.create({
      data: {
        name: String(name),
        pricePence: price,
        available: available != null ? asNumber(available) : null,
        showId,
      },
    });

    res.json({ ok: true, ticketType: created });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to create ticket type' });
  }
});

/** PUT /admin/shows/:id/ticket-types/:ttid  { name?, pricePence?, available? } */
router.put('/shows/:id/ticket-types/:ttid', async (req, res) => {
  try {
    const ttid = String(req.params.ttid);
    const { name, pricePence, available } = req.body || {};
    const price = pricePence !== undefined ? asNumber(pricePence) : undefined;
    const avail = available !== undefined ? asNumber(available) : undefined;

    const updated = await prisma.ticketType.update({
      where: { id: ttid },
      data: {
        name: name !== undefined ? (name ? String(name) : '') : undefined,
        pricePence: price !== undefined ? price : undefined,
        available: avail !== undefined ? avail : undefined,
      },
    });

    res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to update ticket type' });
  }
});

/** DELETE /admin/shows/:id/ticket-types/:ttid */
router.delete('/shows/:id/ticket-types/:ttid', async (req, res) => {
  try {
    const ttid = String(req.params.ttid);
    await prisma.ticketType.delete({ where: { id: ttid } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to delete ticket type' });
  }
});

/**
 * GET /admin/shows/:id/attendees.csv
 * Export attendees (tickets) for a show
 */
router.get('/shows/:id/attendees.csv', async (req, res) => {
  try {
    const id = String(req.params.id);
    const tickets = await prisma.ticket.findMany({
      where: { order: { showId: id } },
      include: {
        order: true,
        user: true,
      },
      orderBy: { scannedAt: 'desc' },
    });

    const rows: string[] = [];
    rows.push([
      'serial',
      'holderName',
      'status',
      'scannedAt',
      'orderId',
      'orderEmail',
      'userEmail',
    ].join(','));

    for (const t of tickets) {
      const cells = [
        t.serial || '',
        t.holderName || '',
        t.status || '',
        t.scannedAt ? t.scannedAt.toISOString() : '',
        t.orderId || '',
        t.order?.email || '',
        t.user?.email || '',
      ];
      rows.push(cells.map((c) => {
        const s = String(c);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(','));
    }

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${id}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to export attendees' });
  }
});

export default router;
