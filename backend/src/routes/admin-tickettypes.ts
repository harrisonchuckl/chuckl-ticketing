// backend/src/routes/admin-tickettypes.ts
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// List ticket types for a show
router.get('/shows/:showId/ticket-types', async (req: Request, res: Response) => {
  try {
    const { showId } = req.params;
    const types = await prisma.ticketType.findMany({
      where: { showId },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ ok: true, ticketTypes: types });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load ticket types' });
  }
});

// Create
router.post('/shows/:showId/ticket-types', async (req: Request, res: Response) => {
  try {
    const { showId } = req.params;
    const { name, pricePence, available } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: true, message: 'Name is required' });
    }

    const price = Number(pricePence);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: true, message: 'pricePence must be a non-negative number' });
    }

    const avail = available == null || available === '' ? null : Number(available);
    if (avail != null && (!Number.isFinite(avail) || avail < 0)) {
      return res.status(400).json({ error: true, message: 'available must be a non-negative number' });
    }

    const created = await prisma.ticketType.create({
      data: {
        showId,
        name: String(name).trim(),
        pricePence: price,
        available: avail
      }
    });

    res.json({ ok: true, ticketType: created });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to create ticket type' });
  }
});

// Update
router.put('/ticket-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, pricePence, available } = req.body || {};

    const data: any = {};
    if (name != null) data.name = String(name).trim();
    if (pricePence != null) {
      const price = Number(pricePence);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: true, message: 'pricePence must be a non-negative number' });
      }
      data.pricePence = price;
    }
    if (available !== undefined) {
      const avail = available === '' || available == null ? null : Number(available);
      if (avail != null && (!Number.isFinite(avail) || avail < 0)) {
        return res.status(400).json({ error: true, message: 'available must be a non-negative number' });
      }
      data.available = avail;
    }

    const updated = await prisma.ticketType.update({
      where: { id },
      data
    });

    res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to update ticket type' });
  }
});

// Delete
router.delete('/ticket-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.ticketType.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to delete ticket type' });
  }
});

export default router;
