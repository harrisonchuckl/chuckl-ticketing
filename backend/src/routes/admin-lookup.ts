// backend/src/routes/admin-lookup.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/lookup/ticket?serial=XXXX
 * Tickets do NOT have a direct `show` relation.
 * Include the order and the order’s show instead.
 */
router.get('/lookup/ticket', async (req, res) => {
  try {
    const serial = String(req.query.serial || '').trim();
    if (!serial) return res.status(400).json({ ok: false, message: 'serial required' });

    const ticket = await prisma.ticket.findUnique({
      where: { serial },
      include: {
        order: {
          include: {
            show: { include: { venue: true } }
          }
        },
        user: true
      }
    });

    if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
    res.json({ ok: true, ticket });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Lookup failed' });
  }
});

export default router;
