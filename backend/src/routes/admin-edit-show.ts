// backend/src/routes/admin-edit-show.ts
// (Kept minimal: show read/update, ticket-type listing/CRUD where needed by UI)
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/shows/:id/summary
 * (Used by UI side panels/drawers)
 */
router.get('/shows/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const show = await prisma.show.findUnique({
      where: { id: String(id) },
      include: {
        venue: true,
        ticketTypes: { orderBy: { createdAt: 'desc' } },
        _count: { select: { orders: true, ticketTypes: true } }
      }
    });
    if (!show) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load show summary' });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 * body: { name, pricePence, available? }
 */
router.post('/shows/:id/ticket-types', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, pricePence, available, onSaleAt, offSaleAt } = req.body || {};

    if (!name || pricePence == null) {
      return res.status(400).json({ ok: false, message: 'name and pricePence required' });
    }

    const tt = await prisma.ticketType.create({
      data: {
        name: String(name),
        pricePence: Number(pricePence),
        available: available === '' || available === undefined ? null : Number(available),
        onSaleAt: onSaleAt ? new Date(onSaleAt) : null,
        offSaleAt: offSaleAt ? new Date(offSaleAt) : null,
        showId: String(id)
      }
    });
    res.json({ ok: true, ticketType: tt });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to create ticket type' });
  }
});

/**
 * PATCH /admin/ticket-types/:ttId
 */
router.patch('/ticket-types/:ttId', async (req, res) => {
  try {
    const { ttId } = req.params;
    const { name, pricePence, available, onSaleAt, offSaleAt } = req.body || {};

    const updated = await prisma.ticketType.update({
      where: { id: String(ttId) },
      data: {
        ...(name !== undefined ? { name: String(name) } : {}),
        ...(pricePence !== undefined ? { pricePence: Number(pricePence) } : {}),
        ...(available !== undefined
          ? { available: available === '' || available === undefined ? null : Number(available) }
          : {}),
        ...(onSaleAt !== undefined ? { onSaleAt: onSaleAt ? new Date(onSaleAt) : null } : {}),
        ...(offSaleAt !== undefined ? { offSaleAt: offSaleAt ? new Date(offSaleAt) : null } : {})
      }
    });
    res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to update ticket type' });
  }
});

/**
 * DELETE /admin/ticket-types/:ttId
 */
router.delete('/ticket-types/:ttId', async (req, res) => {
  try {
    const { ttId } = req.params;
    await prisma.ticketType.delete({ where: { id: String(ttId) } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to delete ticket type' });
  }
});

export default router;
