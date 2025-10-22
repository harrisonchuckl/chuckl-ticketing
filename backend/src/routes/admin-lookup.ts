import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

function authed(req: Request, res: Response): boolean {
  const got = (req.headers['x-admin-key'] as string | undefined)?.trim();
  const want = (process.env.ADMIN_KEY || process.env.BOOTSTRAP_KEY || '').trim();
  if (!got || !want || got !== want) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

// GET /admin/ticket/:serial  → quick JSON lookup
router.get('/ticket/:serial', async (req, res) => {
  try {
    if (!authed(req, res)) return;
    const serial = String(req.params.serial || '').toUpperCase();
    const ticket = await prisma.ticket.findUnique({
      where: { serial },
      include: {
        order: { select: { id: true, email: true, status: true, createdAt: true } },
        show: { select: { id: true, title: true, date: true } }
      }
    });
    if (!ticket) return res.status(404).json({ error: 'not_found' });
    res.json(ticket);
  } catch (e: any) {
    console.error('admin/ticket error', e?.stack || e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
