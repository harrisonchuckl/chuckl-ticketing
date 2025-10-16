import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
export const router = Router();

/**
 * Simple ping to confirm the admin router is mounted
 */
router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

/**
 * One-time bootstrap to seed:
 * - Venue
 * - Show (in ~14 days at 8pm UK time)
 * - TicketType (General Admission)
 *
 * Guarded by header: x-bootstrap-key: <BOOTSTRAP_KEY>
 */
router.post('/bootstrap', async (req, res) => {
  try {
    const headerKey = req.header('x-bootstrap-key');
    const expected = process.env.BOOTSTRAP_KEY;
    if (!expected) {
      return res.status(500).json({ error: 'server_not_configured', detail: 'BOOTSTRAP_KEY is not set on the service.' });
    }
    if (headerKey !== expected) {
      return res.status(401).json({ error: 'unauthorized', detail: 'x-bootstrap-key mismatch' });
    }

    // Create a venue
    const venue = await prisma.venue.create({
      data: {
        name: 'Chuckl. Test Venue',
        address: '123 Laugh St',
        city: 'Cambridge',
        postcode: 'CB1 1AB'
      }
    });

    // Create a show (two weeks from now, 20:00 UTC)
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    twoWeeks.setUTCHours(20, 0, 0, 0);

    const show = await prisma.show.create({
      data: {
        venueId: venue.id,
        title: 'Chuckl. Test Show',
        description: 'A night of testing and giggles.',
        date: twoWeeks // your schema has `date` with @default(now()), we still set a real future date
      }
    });

    // Create a ticket type
    const ticketType = await prisma.ticketType.create({
      data: {
        showId: show.id,
        name: 'General Admission',
        pricePence: 1000, // £10.00
        available: 200
      }
    });

    res.json({
      venueId: venue.id,
      showId: show.id,
      ticketTypeId: ticketType.id,
      message: 'Bootstrap complete. Use these IDs in /checkout/create.'
    });
  } catch (err: any) {
    console.error('Bootstrap error:', err);
    return res.status(500).json({ error: 'bootstrap_failed', detail: String(err?.message || err) });
  }
});

/**
 * Optional: test email endpoint (requires SMTP_* env vars).
 * POST { "to": "you@example.com" }
 */
router.post('/email/test', async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ error: 'missing_to' });

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !port || !user || !pass || !from) {
      return res.status(400).json({
        error: 'smtp_not_configured',
        missing: {
          SMTP_HOST: !host,
          SMTP_PORT: !process.env.SMTP_PORT,
          SMTP_USER: !user,
          SMTP_PASS: !pass,
          SMTP_FROM: !from
        }
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Chuckl. Test Email',
      text: 'Hello from Chuckl. Ticketing!',
      html: '<p>Hello from <b>Chuckl. Ticketing</b>! ✅</p>'
    });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('Email test error:', err);
    return res.status(500).json({ error: 'email_send_failed', detail: String(err?.message || err) });
  }
});
