import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail, sendTestEmail } from '../services/email.js';

export const router = Router();

// --- tiny helpers ---
function bool(v: any) {
  return String(v).trim() === '1' || String(v).toLowerCase() === 'true';
}

// Quick ping
router.get('/bootstrap/ping', (_req, res) => {
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' });
});

// 1) Inspect env the API is actually running with (no secrets)
router.get('/env', (_req: Request, res: Response) => {
  res.json({
    EMAIL_ENABLED: process.env.EMAIL_ENABLED ?? null,
    SMTP_HOST: process.env.SMTP_HOST ?? null,
    SMTP_USER: process.env.SMTP_USER ?? null,
    SMTP_FROM: process.env.SMTP_FROM ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    note: 'If EMAIL_ENABLED is not "1", emails will be skipped.'
  });
});

// 2) Resend tickets email for an order
router.post('/order/:id/resend', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const to = (req.body?.to as string | undefined)?.trim();

    // Check email toggle
    if (!bool(process.env.EMAIL_ENABLED)) {
      console.warn('📭 EMAIL_ENABLED is not 1 → skipping email send');
      return res.status(409).json({ ok: false, skipped: true, reason: 'EMAIL_DISABLED' });
    }

    // Pull order, show and tickets
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        amountPence: true,
        quantity: true,
        showId: true,
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { name: true, address: true, city: true, postcode: true } }
          }
        },
        tickets: { select: { serial: true, qrData: true } }
      }
    });

    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found' });
    if (!order.show) return res.status(404).json({ ok: false, error: 'show_not_found' });

    const recipient = to || order.email;
    if (!recipient) return res.status(400).json({ ok: false, error: 'no_recipient_email' });

    try {
      await sendTicketsEmail({
        to: recipient,
        show: order.show,
        order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
        tickets: order.tickets
      });
      console.log(`📧 Resent tickets to ${recipient} for order ${order.id}`);
      return res.json({ ok: true, resent: true, to: recipient });
    } catch (err: any) {
      console.error('📧 Email send failed:', err?.message || err);
      return res.status(500).json({ ok: false, error: 'smtp_failed', detail: String(err?.message || err) });
    }
  } catch (e: any) {
    console.error('resend error:', e?.stack || e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// 3) Minimal direct test (no order required)
router.post('/email/test', async (req: Request, res: Response) => {
  try {
    const to = (req.body?.to as string | undefined)?.trim();
    if (!to) return res.status(400).json({ ok: false, error: 'missing_to' });

    if (!bool(process.env.EMAIL_ENABLED)) {
      console.warn('📭 EMAIL_ENABLED is not 1 → skipping email send');
      return res.status(409).json({ ok: false, skipped: true, reason: 'EMAIL_DISABLED' });
    }

    try {
      await sendTestEmail(to);
      console.log(`📧 Test email sent to ${to}`);
      res.json({ ok: true, to });
    } catch (err: any) {
      console.error('📧 Test email failed:', err?.message || err);
      res.status(500).json({ ok: false, error: 'smtp_failed', detail: String(err?.message || err) });
    }
  } catch (e: any) {
    console.error('test email route error:', e?.stack || e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
