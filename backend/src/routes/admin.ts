import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail, sendTestEmail } from '../services/email.js';

// Accept either ADMIN_KEY or BOOTSTRAP_KEY for convenience
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '';

export const router = Router();

/** Simple guard for admin endpoints */
function requireAdmin(req: Request, res: Response): boolean {
  if (!ADMIN_KEY) {
    res.status(500).json({ error: 'admin_key_not_set', detail: 'Set ADMIN_KEY or BOOTSTRAP_KEY in Railway.' });
    return false;
  }
  const header = req.header('x-admin-key');
  if (header !== ADMIN_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

/** Health check for admin router */
router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/** Bootstrap: create a Venue, Show, TicketType for testing */
router.post('/bootstrap', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const venue = await prisma.venue.create({
      data: {
        name: 'Chuckl. Test Venue',
        address: '123 Laugh Lane',
        city: 'Comedy-on-Sea',
        postcode: 'HA-HA 1AA',
      },
    });

    const show = await prisma.show.create({
      data: {
        venueId: venue.id,
        title: 'Chuckl. Test Show',
        description: 'A demo show created by /admin/bootstrap',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
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
    res.status(500).json({ error: 'bootstrap_failed', detail: e?.message || String(e) });
  }
});

/** List recent orders */
router.get('/orders', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
  try {
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        email: true,
        amountPence: true,
        quantity: true,
        createdAt: true,
        show: { select: { id: true, title: true, date: true } },
      },
    });
    res.json({ orders });
  } catch (e: any) {
    res.status(500).json({ error: 'list_failed', detail: e?.message || String(e) });
  }
});

/** Get one order */
router.get('/order/:orderId', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { orderId } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: { select: { id: true, serial: true, status: true } },
        show: { select: { id: true, title: true, date: true, venue: { select: { name: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: 'fetch_failed', detail: e?.message || String(e) });
  }
});

/** Resend tickets for an order */
router.post('/order/:orderId/resend', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { orderId } = req.params;
  const overrideTo: string | undefined = req.body?.to;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: { select: { serial: true, qrData: true, status: true } },
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { name: true, address: true, city: true, postcode: true } },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: 'not_found' });

    const to = overrideTo || order.email;
    if (!to) return res.status(400).json({ error: 'no_email' });

    await sendTicketsEmail({
      to,
      show: order.show,
      order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
      tickets: order.tickets.map(t => ({ serial: t.serial, qrData: t.qrData || `chuckl:${t.serial}` })),
    });

    res.json({ ok: true, resent: true, to });
  } catch (e: any) {
    res.status(500).json({ error: 'resend_failed', detail: e?.message || String(e) });
  }
});

/** Send a direct test email via the configured provider */
router.post('/email/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const to: string | undefined = req.body?.to;
  if (!to) return res.status(400).json({ ok: false, error: 'missing_to' });
  try {
    const result = await sendTestEmail(to);
    res.json({ ok: true, provider: result.provider, result: result.result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'email_failed', detail: e?.message || String(e) });
  }
});

export default router;
