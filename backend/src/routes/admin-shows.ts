// backend/src/routes/admin-shows.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/shows
 * Optional ?q=search by title or venue
 */
router.get('/shows', requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();

    const where = q
      ? {
          OR: [
            {
              title: {
                contains: q,
                mode: 'insensitive' as const,
              },
            },
            {
              venue: {
                name: {
                  contains: q,
                  mode: 'insensitive' as const,
                },
              },
            },
          ],
        }
      : {};

    const shows = await prisma.show.findMany({
      where,
      include: {
        venue: true,
        ticketTypes: true,
        _count: {
          select: {
            orders: true,
            ticketTypes: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ ok: true, shows });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * GET /admin/shows/:id
 * Includes KPIs and ticket type list
 */
router.get('/shows/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const showId = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        ticketTypes: true,
        orders: {
          select: {
            id: true,
            amountPence: true,
            status: true,
            tickets: true,
          },
        },
      },
    });

    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    // --- KPIs ---
    const totalOrders = show.orders.length;
    const paidOrders = show.orders.filter((o) => o.status === 'PAID');
    const refundedOrders = show.orders.filter((o) => o.status === 'REFUNDED');

    const totalTickets = show.orders.reduce((sum, o) => sum + (o.tickets?.length || 0), 0);
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);
    const refundedRevenue = refundedOrders.reduce((sum, o) => sum + (o.amountPence || 0), 0);

    res.json({
      ok: true,
      show: {
        ...show,
        kpis: {
          totalOrders,
          totalTickets,
          totalRevenue,
          refundedRevenue,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * PATCH /admin/shows/:id/ticket-types/:ticketTypeId
 * Inline editing for ticket type name, price, available qty
 */
router.patch('/shows/:id/ticket-types/:ticketTypeId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ticketTypeId } = req.params;
    const { name, pricePence, available } = req.body;

    const updated = await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        name,
        pricePence: Number(pricePence),
        available: available !== undefined ? Number(available) : undefined,
      },
    });

    res.json({ ok: true, updated });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 * Create new ticket type inline
 */
router.post('/shows/:id/ticket-types', requireAdmin, async (req: Request, res: Response) => {
  try {
    const showId = String(req.params.id);
    const { name, pricePence, available } = req.body;

    const created = await prisma.ticketType.create({
      data: {
        name,
        pricePence: Number(pricePence),
        available: available !== undefined ? Number(available) : null,
        show: { connect: { id: showId } },
      },
    });

    res.json({ ok: true, created });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * DELETE /admin/shows/:id/ticket-types/:ticketTypeId
 */
router.delete('/shows/:id/ticket-types/:ticketTypeId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ticketTypeId } = req.params;
    await prisma.ticketType.delete({ where: { id: ticketTypeId } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * GET /admin/shows/:id/attendees.csv
 * Exports list of tickets with holderName, email, status
 */
router.get('/shows/:id/attendees.csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const showId = String(req.params.id);

    const tickets = await prisma.ticket.findMany({
      where: { order: { showId } },
      include: {
        order: {
          select: {
            email: true,
            status: true,
          },
        },
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${showId}.csv"`);

    const header = ['Ticket ID', 'Holder Name', 'Email', 'Status'];
    res.write(header.join(',') + '\n');

    for (const t of tickets) {
      const email = t.order?.email ?? '';
      const status = t.order?.status ?? '';
      const row = [t.id, t.holderName ?? '', email, status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
      res.write(row + '\n');
    }

    res.end();
  } catch (err: any) {
    console.error('CSV export error', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
