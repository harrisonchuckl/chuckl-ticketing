import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/** Simple admin-key check used by the scan endpoints */
function requireAdmin(req: Request, res: Response): boolean {
  const got = (req.headers['x-admin-key'] as string | undefined)?.trim();
  const want = (process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '').trim();
  if (!got || !want || got !== want) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

/** Basic serial sanitiser */
function cleanSerial(raw?: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 32);
}

/**
 * POST /scan/check
 * Body: { serial: string }
 * Returns ticket + show info without mutating anything.
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;
    const serial = cleanSerial(req.body?.serial);
    if (!serial) return res.status(400).json({ error: 'invalid_serial' });

    const ticket = await prisma.ticket.findUnique({
      where: { serial },
      select: {
        id: true,
        serial: true,
        status: true,
        scannedAt: true,
        order: { select: { email: true, id: true } },
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { name: true, address: true, city: true, postcode: true } }
          }
        }
      }
    });

    if (!ticket) return res.status(404).json({ error: 'not_found' });

    return res.json({
      ok: true,
      ticket: {
        id: ticket.id,
        serial: ticket.serial,
        status: ticket.status,
        scannedAt: ticket.scannedAt,
        orderId: ticket.order?.id,
        purchaser: ticket.order?.email
      },
      show: ticket.show
    });
  } catch (err: any) {
    console.error('scan/check error', err?.stack || err);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /scan/mark
 * Body: { serial: string }
 * Marks VALID → USED (idempotent), returns current state.
 */
router.post('/mark', async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;
    const serial = cleanSerial(req.body?.serial);
    if (!serial) return res.status(400).json({ error: 'invalid_serial' });

    const t = await prisma.ticket.findUnique({
      where: { serial },
      select: { id: true, status: true, scannedAt: true }
    });
    if (!t) return res.status(404).json({ error: 'not_found' });

    // Idempotent: if already USED (or not VALID), just return current state.
    if (t.status !== 'VALID') {
      return res.json({
        ok: true,
        already: true,
        status: t.status,
        scannedAt: t.scannedAt
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: t.id },
      data: { status: 'USED', scannedAt: new Date() },
      select: { status: true, scannedAt: true }
    });

    return res.json({ ok: true, status: updated.status, scannedAt: updated.scannedAt });
  } catch (err: any) {
    console.error('scan/mark error', err?.stack || err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
