// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/shows/latest?limit=50
 */
router.get('/shows/latest', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        venue: { select: { name: true, city: true, postcode: true, capacity: true } },
      },
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load shows' });
  }
});

/**
 * GET /admin/shows/:id
 * Returns show, ticket types, and KPIs
 */
router.get('/shows/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true, city: true, postcode: true, capacity: true } },
        ticketTypes: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    // KPIs
    const [orders, ticketsCount] = await Promise.all([
      prisma.order.findMany({
        where: { showId: id, status: { in: ['PAID', 'REFUNDED'] } },
        select: { amountPence: true, quantity: true, status: true },
      }),
      prisma.ticket.count({ where: { order: { showId: id }, status: 'ISSUED' } }),
    ]);

    const revenuePence = orders.reduce((sum, o) => sum + (o.status === 'PAID' ? (o.amountPence || 0) : 0), 0);
    const ticketsSold = orders.reduce((sum, o) => sum + (o.status === 'PAID' ? (o.quantity || 0) : 0), 0);
    const capacity = show.venue?.capacity ?? null;
    const totalAvailable = (show.ticketTypes || []).reduce((a, t) => a + (t.available ?? 0), 0);

    res.json({
      ok: true,
      show,
      kpis: {
        capacity,
        totalAvailable,
        ticketsSold,
        revenuePence,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load show' });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 */
router.post('/shows/:id/ticket-types', requireAdmin, async (req: Request, res: Response) => {
  try {
    const showId = String(req.params.id);
    const { name, pricePence, available } = req.body || {};
    if (!name || typeof pricePence !== 'number') {
      return res.status(400).json({ ok: false, message: 'name and pricePence required' });
    }
    const tt = await prisma.ticketType.create({
      data: { showId, name: String(name), pricePence: Number(pricePence), available: available == null ? null : Number(available) },
    });
    res.json({ ok: true, ticketType: tt });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to add ticket type' });
  }
});

/**
 * GET /admin/shows/:id/attendees.csv
 * Flat CSV of tickets for door list / marketing export.
 */
router.get('/shows/:id/attendees.csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const tickets = await prisma.ticket.findMany({
      where: { order: { showId: id } },
      orderBy: { serial: 'asc' },
      select: {
        serial: true,
        holderName: true,
        status: true,
        scannedAt: true,
        order: { select: { email: true, createdAt: true } },
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendees.csv"');

    const header = ['serial', 'holderName', 'status', 'scannedAt', 'orderEmail', 'orderCreatedAt'];
    res.write(header.join(',') + '\n');

    for (const t of tickets) {
      const row = [
        t.serial,
        t.holderName || '',
        t.status || '',
        t.scannedAt ? t.scannedAt.toISOString() : '',
        t.order?.email || '',
        t.order?.createdAt ? t.order.createdAt.toISOString() : '',
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
      res.write(row + '\n');
    }
    res.end();
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to export attendees' });
  }
});

export default router;
