// backend/src/routes/admin.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { sendTestEmail, sendTicketsEmail } from '../services/email.js';

export const router = Router();

/** Simple ping so you can curl it */
router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/** One-time bootstrap: create sample venue/show/ticketType */
router.post('/bootstrap', async (req: Request, res: Response) => {
  try {
    const k = req.headers['x-bootstrap-key'];
    if (!k || String(k) !== (process.env.BOOTSTRAP_KEY || 'ashdb77asjkh')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const venue = await prisma.venue.create({
      data: {
        name: 'Chuckl. Test Venue',
        address: '123 High Street',
        city: 'Cambridge',
        postcode: 'CB1 1AA'
      }
    });

    const show = await prisma.show.create({
      data: {
        venueId: venue.id,
        title: 'Chuckl. Test Show',
        description: 'A fun night!',
        date: new Date(Date.now() + 7 * 24 * 3600 * 1000)
      }
    });

    const tt = await prisma.ticketType.create({
      data: {
        showId: show.id,
        name: 'General Admission',
        pricePence: 2000,
        available: 100
      }
    });

    res.json({
      venueId: venue.id,
      showId: show.id,
      ticketTypeId: tt.id,
      message: 'Bootstrap complete. Use these IDs in /checkout/create.'
    });
  } catch (e: any) {
    console.error('bootstrap_failed:', e?.message || e);
    res.status(500).json({ error: 'bootstrap_failed', detail: String(e?.message || e) });
  }
});

/** Test email endpoint */
router.post('/email/test', async (req: Request, res: Response) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'missing_to' });

    if (process.env.EMAIL_ENABLED !== '1') {
      return res.status(400).json({ ok: false, error: 'email_disabled' });
    }

    const rsp = await sendTestEmail(to);
    console.log('📧 Test email queued/sent to', to);
    res.json({ ok: true, provider: process.env.RESEND_API_KEY ? 'resend' : 'smtp', result: rsp });
  } catch (e: any) {
    console.error('📧 Test email failed:', e?.message || e);
    res.status(500).json({ ok: false, error: 'email_failed', detail: e?.message || String(e) });
  }
});

/** Resend order tickets by orderId (optional `?to=` override) */
router.get('/order/:id/resend', async (req: Request, res: Response) => {
  try {
    if (process.env.EMAIL_ENABLED !== '1') {
      return res.status(400).json({ ok: false, error: 'email_disabled' });
    }

    const orderId = req.params.id;
    const toOverride = (req.query.to as string) || '';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        show: { include: { venue: true } },
        tickets: true
      }
    });
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found' });

    const to = toOverride || order.email;
    if (!to) return res.status(400).json({ ok: false, error: 'no_recipient' });

    await sendTicketsEmail({
      to,
      show: {
        id: order.show.id,
        title: order.show.title,
        date: order.show.date,
        venue: {
          name: order.show.venue.name,
          address: order.show.venue.address,
          city: order.show.venue.city,
          postcode: order.show.venue.postcode
        }
      },
      order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
      tickets: order.tickets.map(t => ({ serial: t.serial, qrData: t.qrData }))
    });

    console.log(`📧 Resent ${order.tickets.length} ticket(s) to ${to} for order ${order.id}`);
    res.json({ ok: true, resent: true, to, count: order.tickets.length });
  } catch (e: any) {
    console.error('📧 Resend failed:', e?.message || e);
    res.status(500).json({ ok: false, error: 'resend_failed', detail: e?.message || String(e) });
  }
});

export default router;
