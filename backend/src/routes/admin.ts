import { Router } from 'express';
import { prisma } from '../db.js';
import { sendTicketsEmail, sendTestEmail } from '../services/email.js';

export const router = Router();

// Admin auth via header
function isAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  return key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

// Ping (you already use this)
router.get('/bootstrap/ping', (_req, res) =>
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' })
);

// Email connectivity test (requires x-admin-key)
router.post('/email/test', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
    const to = (req.body?.to || '').trim();
    if (!to) return res.status(400).json({ error: 'missing_to' });
    const result = await sendTestEmail(to);
    res.json({ ok: true, provider: process.env.RESEND_API_KEY ? 'resend' : 'smtp', result });
  } catch (e: any) {
    console.error('Test email failed:', e?.message || e);
    res.status(500).json({ ok: false, error: 'email_failed', detail: e?.message || String(e) });
  }
});

// Admin list orders
router.get('/orders', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const orders = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, email: true, amountPence: true, quantity: true, createdAt: true,
      show: { select: { id: true, title: true, date: true } }
    }
  });
  res.json({ orders });
});

// Admin get order
router.get('/order/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      tickets: { select: { id: true, serial: true, status: true } },
      show: { select: { id: true, title: true, date: true, venue: { select: { name: true } } } },
    }
  });
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json(order);
});

// Admin resend tickets
router.post('/order/:id/resend', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
    const id = req.params.id;
    const to = (req.body?.to || '').trim();

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: { select: { serial: true, qrData: true } },
        show: {
          select: {
            id: true, title: true, date: true,
            venue: { select: { name: true, address: true, city: true, postcode: true } }
          }
        }
      }
    });

    if (!order) return res.status(404).json({ error: 'not_found' });

    await sendTicketsEmail({
      to: to || order.email,
      show: order.show as any,
      order: { id: order.id, quantity: order.quantity, amountPence: order.amountPence },
      tickets: order.tickets as any
    });

    res.json({ ok: true, resent: true, to: to || order.email });
  } catch (e: any) {
    console.error('Resend failed:', e?.message || e);
    res.status(500).json({ ok: false, error: 'resend_failed', detail: e?.message || String(e) });
  }
});

export default router;
