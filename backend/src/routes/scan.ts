import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

// --- Simple admin-key guard shared by endpoints ---
function requireAdminKey(req: Request, res: Response): string | null {
  const key = req.header('x-admin-key') || '';
  const expected = process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '';
  if (!expected || key !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return key;
}

// Normalize the serial from QR/text: allow "chuckl:<SERIAL>" or "<SERIAL>"
function normalizeSerial(s: string | undefined): string {
  const v = (s || '').trim();
  if (!v) return '';
  return v.toLowerCase().startsWith('chuckl:') ? v.slice(7).toUpperCase() : v.toUpperCase();
}

/**
 * POST /scan/check
 * Body: { serial }
 * Returns: ticket + show info (no mutation)
 */
router.post('/scan/check', async (req: Request, res: Response) => {
  if (!requireAdminKey(req, res)) return;
  const serial = normalizeSerial(req.body?.serial);
  if (!serial) return res.status(400).json({ error: 'missing_serial' });

  const ticket = await prisma.ticket.findUnique({
    where: { serial },
    select: {
      id: true, serial: true, status: true, scannedAt: true, orderId: true, showId: true,
      order: { select: { email: true } }
    }
  });

  if (!ticket) return res.status(404).json({ error: 'not_found' });

  const show = await prisma.show.findUnique({
    where: { id: ticket.showId },
    select: {
      id: true, title: true, date: true,
      venue: { select: { name: true, address: true, city: true, postcode: true } }
    }
  });

  return res.json({
    ok: true,
    ticket: {
      id: ticket.id,
      serial: ticket.serial,
      status: ticket.status,
      scannedAt: ticket.scannedAt,
      orderId: ticket.orderId,
      purchaser: ticket.order?.email ?? null
    },
    show
  });
});

/**
 * POST /scan/mark
 * Body: { serial }
 * Marks a ticket USED (if VALID).
 */
router.post('/scan/mark', async (req: Request, res: Response) => {
  if (!requireAdminKey(req, res)) return;
  const serial = normalizeSerial(req.body?.serial);
  if (!serial) return res.status(400).json({ error: 'missing_serial' });

  const ticket = await prisma.ticket.findUnique({
    where: { serial },
    select: { id: true, status: true, showId: true }
  });
  if (!ticket) return res.status(404).json({ error: 'not_found' });

  if (ticket.status !== 'VALID') {
    return res.status(409).json({ error: 'already_used', status: ticket.status });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'USED', scannedAt: new Date() },
    select: { id: true, status: true, scannedAt: true, showId: true }
  });

  return res.json({ ok: true, status: updated.status, scannedAt: updated.scannedAt });
});

/**
 * GET /scan/stats?showId=...
 * Returns counts for the show: total, used, remaining
 */
router.get('/scan/stats', async (req: Request, res: Response) => {
  if (!requireAdminKey(req, res)) return;
  const showId = String(req.query.showId || '');
  if (!showId) return res.status(400).json({ error: 'missing_showId' });

  const [total, used] = await Promise.all([
    prisma.ticket.count({ where: { showId } }),
    prisma.ticket.count({ where: { showId, status: 'USED' } }),
  ]);

  const remaining = Math.max(0, total - used);
  res.json({ ok: true, showId, total, used, remaining });
});

export default router;
