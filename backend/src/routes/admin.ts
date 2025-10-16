import { Router } from 'express';
import prisma from '../db.js';
import { sendOrderEmail } from '../services/email.js';

export const router = Router();

function checkKey(req: any) {
  const want = process.env.BOOTSTRAP_KEY || 'ashdb77asjkh';
  const got = req.header('x-bootstrap-key') || req.header('x-admin-key');
  if (got !== want) {
    const err: any = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
}

router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/**
 * One-time bootstrap to seed a venue/show/ticketType
 */
router.post('/bootstrap', async (req, res) => {
  try {
    checkKey(req);

    const venue = await prisma.venue.create({
      data: {
        name: 'Chuckl. Test Venue',
        address: '123 Example Street',
        city: 'Cambridge',
        postcode: 'CB1 1AA',
      },
    });

    const show = await prisma.show.create({
      data: {
        venueId: venue.id,
        title: 'Chuckl. Comedy Night (Test)',
        description: 'An evening of laughs. (seeded)',
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // +7 days
      },
    });

    const ticketType = await prisma.ticketType.create({
      data: {
        showId: show.id,
        name: 'General Admission',
        pricePence: 2000,
        available: 100,
      },
    });

    res.json({
      venueId: venue.id,
      showId: show.id,
      ticketTypeId: ticketType.id,
      message: 'Bootstrap complete. Use these IDs in /checkout/create.',
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: 'bootstrap_failed', detail: String(e.message || e) });
  }
});

/**
 * Quick inspect: GET /admin/order/:id
 */
router.get('/order/:id', async (req, res) => {
  try {
    checkKey(req);
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: { show: true, tickets: true },
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: 'failed', detail: String(e.message || e) });
  }
});

/**
 * Resend email: POST /admin/order/:id/email
 */
router.post('/order/:id/email', async (req, res) => {
  try {
    checkKey(req);
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: { show: true, tickets: true },
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    if (order.tickets.length === 0) return res.status(400).json({ error: 'no_tickets' });

    const result = await sendOrderEmail({ order });
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: 'email_failed', detail: String(e.message || e) });
  }
});
