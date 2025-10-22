import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const headerKey = req.header('x-admin-key');
  const envKey = process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '';
  if (!envKey || headerKey !== envKey) {
    res.status(401).json({ error: 'unauthorized', detail: 'Set ADMIN_KEY and pass x-admin-key header' });
    return false;
  }
  return true;
}

// Simple ping
router.get('/ping', (req, res) => res.json({ ok: true, router: 'scan', path: '/admin/scan/ping' }));

/**
 * Scan a ticket by serial (case-insensitive).
 * Body: { "serial": "XPTPMQM6TNX4" }
 *
 * Responses:
 *  - 200 { ok: true, status: 'OK'|'ALREADY_USED', ticket: {...}, show: {...}, scannedAt? }
 *  - 404 { error: 'not_found' }
 *  - 401 { error: 'unauthorized' }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const serialRaw = (req.body?.serial || req.body?.qrData || '').toString().trim();
    if (!serialRaw) return res.status(400).json({ error: 'invalid_body', detail: 'Provide serial' });

    // Accept qrData like "chuckl:SERIAL" or plain SERIAL
    const serial = serialRaw.toUpperCase().replace(/^chuckl:/i, '');

    const ticket = await prisma.ticket.findUnique({
      where: { serial },
      include: {
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: { select: { name: true, address: true, city: true, postcode: true } }
          }
        },
        order: { select: { id: true, email: true } }
      }
    });

    if (!ticket) return res.status(404).json({ error: 'not_found', serial });

    // If already used, return idempotent status (don’t update again)
    if (ticket.status === 'USED' && ticket.scannedAt) {
      return res.json({
        ok: true,
        status: 'ALREADY_USED',
        scannedAt: ticket.scannedAt,
        ticket: { id: ticket.id, serial: ticket.serial },
        show: ticket.show,
        order: ticket.order ? { id: ticket.order.id, email: ticket.order.email } : null
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'USED', scannedAt: new Date() }
    });

    return res.json({
      ok: true,
      status: 'OK',
      scannedAt: updated.scannedAt,
      ticket: { id: updated.id, serial: updated.serial },
      show: ticket.show,
      order: ticket.order ? { id: ticket.order.id, email: ticket.order.email } : null
    });
  } catch (e: any) {
    console.error('scan_error:', e?.stack || e);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * (Optional) Unscan a ticket for testing
 * POST /admin/scan/unscan { "serial": "XPTPMQM6TNX4" }
 */
router.post('/unscan', async (req: Request, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const serial = (req.body?.serial || '').toString().trim().toUpperCase();
    if (!serial) return res.status(400).json({ error: 'invalid_body' });

    const ticket = await prisma.ticket.findUnique({ where: { serial } });
    if (!ticket) return res.status(404).json({ error: 'not_found', serial });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'VALID', scannedAt: null }
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error('unscan_error:', e?.stack || e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
