// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function asNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /admin/shows/latest
 */
router.get('/shows/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: { venue: true, ticketTypes: true },
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * POST /admin/shows
 */
router.post('/shows', async (req, res) => {
  try {
    const { title, description, date, venueId } = req.body || {};
    if (!title || !date) return res.status(400).json({ ok: false, message: 'Missing title/date' });
    const show = await prisma.show.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        venueId: venueId || null,
      },
      include: { venue: true, ticketTypes: true },
    });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * GET /admin/shows/:id
 */
router.get('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id },
      include: { venue: true, ticketTypes: true },
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Not found' });

    const paidAgg = await prisma.order.aggregate({
      _sum: { amountPence: true, quantity: true },
      _count: { _all: true },
      where: { showId: id, status: OrderStatus.PAID },
    });
    const ticketsSold = await prisma.ticket.count({
      where: { order: { showId: id }, status: { in: ['VALID', 'SCANNED'] } },
    });
    const ticketsScanned = await prisma.ticket.count({
      where: { order: { showId: id }, status: 'SCANNED' },
    });

    res.json({
      ok: true,
      show,
      kpis: {
        ordersPaid: paidAgg._count._all || 0,
        revenuePence: paidAgg._sum.amountPence || 0,
        ticketsSold,
        ticketsScanned,
        capacity: show.venue?.capacity ?? null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * PUT /admin/shows/:id
 */
router.put('/shows/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { title, description, date, venueId } = req.body || {};
    const updated = await prisma.show.update({
      where: { id },
      data: {
        title: title ?? undefined,
        description: description ?? undefined,
        date: date ? new Date(date) : undefined,
        venueId: venueId ?? undefined,
      },
      include: { venue: true, ticketTypes: true },
    });
    res.json({ ok: true, show: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 */
router.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    const showId = String(req.params.id);
    const { name, pricePence, available } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

    const created = await prisma.ticketType.create({
      data: {
        name: String(name),
        pricePence: Number(pricePence),
        available: asNumber(available),
        showId,
      },
    });
    res.json({ ok: true, ticketType: created });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * PUT /admin/shows/:id/ticket-types/:ttid
 */
router.put('/shows/:id/ticket-types/:ttid', async (req, res) => {
  try {
    const ttid = String(req.params.ttid);
    const { name, pricePence, available } = req.body || {};
    const data: any = {};
    if (name !== undefined) data.name = String(name);
    if (pricePence !== undefined) data.pricePence = Number(pricePence);
    if (available !== undefined) {
      const num = asNumber(available);
      if (num !== undefined) data.available = num; // ✅ null now skipped, not sent
    }

    const updated = await prisma.ticketType.update({
      where: { id: ttid },
      data,
    });
    res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * DELETE /admin/shows/:id/ticket-types/:ttid
 */
router.delete('/shows/:id/ticket-types/:ttid', async (req, res) => {
  try {
    const ttid = String(req.params.ttid);
    await prisma.ticketType.delete({ where: { id: ttid } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * GET /admin/shows/:id/attendees.csv
 */
router.get('/shows/:id/attendees.csv', async (req, res) => {
  try {
    const id = String(req.params.id);
    const tickets = await prisma.ticket.findMany({
      where: { order: { showId: id } },
      include: { order: true, user: true },
      orderBy: { scannedAt: 'desc' },
    });

    const rows: string[] = [
      'serial,holderName,status,scannedAt,orderId,orderEmail,userEmail',
      ...tickets.map((t) =>
        [
          t.serial || '',
          t.holderName || '',
          t.status || '',
          t.scannedAt ? t.scannedAt.toISOString() : '',
          t.orderId || '',
          t.order?.email || '',
          t.user?.email || '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${id}.csv"`);
    res.send(rows.join('\n'));
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
