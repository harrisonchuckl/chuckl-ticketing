// backend/src/routes/scan.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

function adminKey(req: Request) {
  return (req.headers['x-admin-key'] as string) || '';
}
function requireAdmin(req: Request, res: Response): string | undefined {
  const key = adminKey(req);
  const expected = process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '';
  if (!key || key !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  return key;
}

router.get('/stats', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  // naive totals across all tickets/orders (adapt later per-show)
  const total = await prisma.ticket.count();
  const used = await prisma.ticket.count({ where: { status: 'USED' } });
  res.json({ ok: true, total, checkedIn: used, remaining: Math.max(0, total - used) });
});

router.post('/check', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const serial = (req.body?.serial || '').trim().toUpperCase();
  if (!serial) return res.status(400).json({ error: 'bad_request' });

  const t = await prisma.ticket.findUnique({
    where: { serial },
    select: { id: true, serial: true, status: true, scannedAt: true, orderId: true, order: { select: { email: true } } }
  });
  if (!t) return res.status(404).json({ error: 'not_found' });

  res.json({
    ok: true,
    ticket: {
      id: t.id,
      serial: t.serial,
      status: t.status,
      scannedAt: t.scannedAt
    },
    orderId: t.orderId,
    purchaser: t.order?.email || null
  });
});

router.post('/mark', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const serial = (req.body?.serial || '').trim().toUpperCase();
  if (!serial) return res.status(400).json({ error: 'bad_request' });

  const t = await prisma.ticket.findUnique({ where: { serial } });
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (t.status === 'USED') {
    return res.json({ ok: true, status: 'USED', scannedAt: t.scannedAt });
  }
  const updated = await prisma.ticket.update({
    where: { id: t.id },
    data: { status: 'USED', scannedAt: new Date() },
    select: { status: true, scannedAt: true }
  });
  res.json({ ok: true, status: updated.status, scannedAt: updated.scannedAt });
});

export default router;
