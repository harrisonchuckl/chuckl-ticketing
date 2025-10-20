// backend/src/routes/admin.ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail } from '../services/email.js';

export const router = Router();

const BOOTSTRAP_KEY = process.env.BOOTSTRAP_KEY || 'ashdb77asjkh';

/**
 * Health/ping for this router
 */
router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/**
 * Seed a venue + show + one ticket type so you can test checkout quickly.
 * Protect with a simple header "x-bootstrap-key".
 */
router.post('/bootstrap', async (req, res) => {
  try {
    const key = (req.headers['x-bootstrap-key'] as string) || '';
    if (key !== BOOTSTRAP_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Create Venue
    const venue = await prisma.venue.create({
      data: {
        name: 'Chuckl. Test Venue',
        address: '123 High Street',
        city: 'Littleport',
        postcode: 'CB6 1RA',
      },
      select: { id: true },
    });

    // Create Show (schema uses "date" DateTime)
    const show = await prisma.show.create({
      data: {
        venueId: venue.id,
        title: 'Chuckl. Test Night',
        description: 'A seeded show for end-to-end testing.',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // one week from now
      },
      select: { id: true },
    });

    // One ticket type (schema has optional "available")
    const ticketType = await prisma.ticketType.create({
      data: {
        showId: show.id,
        name: 'General Admission',
        pricePence: 2000,
        available: 100,
      },
      select: { id: true },
    });

    res.json({
      venueId: venue.id,
      showId: show.id,
      ticketTypeId: ticketType.id,
      message: 'Bootstrap complete. Use these IDs in /checkout/create.',
    });
  } catch (e: any) {
    console.error('bootstrap_failed:', e?.message || e);
    res.status(500).json({ error: 'bootstrap_failed', detail: String(e?.message || e) });
  }
});

/**
 * Quick order inspector (handy during testing)
 * GET /admin/order/:id
 */
router.get('/order/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        tickets: true,
        show: { select: { id: true, title: true, date: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: 'failed', detail: String(e?.message || e) });
  }
});

/**
 * Re-send tickets email for an order
 * POST /admin/order/:id/resend
 * Body: { to?: string }
 */
router.post('/order/:id/resend', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { tickets: true, show: { include: { venue: true } } },
    });
    if (!order) return res.status(404).json({ error: 'not_found' });

    const to = (req.body?.to as string) || order.email;
    if (!to) return res.status(400).json({ error: 'no_recipient' });

    const show = order.show;
    if (!show) return res.status(400).json({ error: 'missing_show' });

    await sendTicketsEmail({
      to,
      show: {
        id: show.id,
        title: show.title,
        date: show.date,
        venue: show.venue
          ? {
              name: show.venue.name,
              address: show.venue.address,
              city: show.venue.city,
              postcode: show.venue.postcode,
            }
          : null,
      },
      order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
      tickets: order.tickets.map((t) => ({ serial: t.serial, qrData: t.qrData })),
    });

    res.json({ ok: true, resent: true, to });
  } catch (e: any) {
    console.error('resend_failed:', e?.message || e);
    res.status(500).json({ error: 'failed', detail: String(e?.message || e) });
  }
});

export default router;
