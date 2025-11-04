// backend/src/routes/admin.ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail, sendTestEmail } from '../services/email.js';

export const router = Router();

// Validate admin access
function isAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

// Ping
router.get('/bootstrap/ping', (_req, res) =>
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' })
);

// Email test endpoint
router.post('/email/test', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'unauthorized' });
    const { to } = req.body;
    const r = await sendTestEmail(to);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Order resend
router.post('/order/:id/resend', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'unauthorized' });

    const id = req.params.id;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        show: { include: { venue: true } },
        tickets: true
      }
    });

    if (!order) return res.status(404).json({ ok: false, error: 'order not found' });

    const show = {
      id: order.show.id,
      title: order.show.title,
      date: order.show.date,
      venue: order.show.venue
        ? {
            name: order.show.venue.name,
            address: order.show.venue.address,
            city: order.show.venue.city,
            postcode: order.show.venue.postcode
          }
        : null
    };

    const tickets = order.tickets.map((t: any) => ({
      serial: t.serial,
      status: t.status
    }));

    const r = await sendTicketsEmail(order.email, show, tickets);
    res.json(r);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List shows (for admin UI)
router.get('/shows', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'unauthorized' });
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      include: { venue: true }
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List tickets by show
router.get('/tickets/:showId', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'unauthorized' });
    const showId = req.params.showId;
    const tickets = await prisma.ticket.findMany({ where: { showId } });
    res.json({ ok: true, tickets });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
