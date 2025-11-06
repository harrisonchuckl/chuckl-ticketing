import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { withAuth } from '../middleware/requireAuth.js';
import { readSession, userHasVenueAccess } from '../lib/auth.js';

const router = Router();
router.use(...withAuth());

// list ticket types for a show
router.get('/shows/:showId/tickets', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    const showId = Number(req.params.showId);
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

    if (s.role !== 'SUPERADMIN') {
      const ok = await userHasVenueAccess(s.uid, show.venueId);
      if (!ok) return res.status(403).json({ error: true, message: 'No access to venue' });
    }

    const types = await prisma.ticketType.findMany({
      where: { showId },
      orderBy: { id: 'asc' }
    });

    return res.json({ ticketTypes: types, show });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// create ticket type
router.post('/shows/:showId/tickets', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    const showId = Number(req.params.showId);
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

    if (s.role !== 'SUPERADMIN') {
      const ok = await userHasVenueAccess(s.uid, show.venueId);
      if (!ok) return res.status(403).json({ error: true, message: 'No access to venue' });
    }

    const { name, pricePence, available } = req.body || {};
    if (!name || pricePence == null || available == null) {
      return res.status(400).json({ error: true, message: 'name, pricePence, available required' });
    }

    const t = await prisma.ticketType.create({
      data: {
        showId,
        name: String(name),
        pricePence: Number(pricePence),
        available: Number(available)
      }
    });

    return res.json({ ticketType: t });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// update ticket type
router.put('/shows/:showId/tickets/:id', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    const showId = Number(req.params.showId);
    const id = Number(req.params.id);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

    if (s.role !== 'SUPERADMIN') {
      const ok = await userHasVenueAccess(s.uid, show.venueId);
      if (!ok) return res.status(403).json({ error: true, message: 'No access to venue' });
    }

    const { name, pricePence, available } = req.body || {};
    const t = await prisma.ticketType.update({
      where: { id },
      data: {
        name: name != null ? String(name) : undefined,
        pricePence: pricePence != null ? Number(pricePence) : undefined,
        available: available != null ? Number(available) : undefined
      }
    });

    return res.json({ ticketType: t });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// delete ticket type
router.delete('/shows/:showId/tickets/:id', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    const showId = Number(req.params.showId);
    const id = Number(req.params.id);
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: true, message: 'Show not found' });

    if (s.role !== 'SUPERADMIN') {
      const ok = await userHasVenueAccess(s.uid, show.venueId);
      if (!ok) return res.status(403).json({ error: true, message: 'No access to venue' });
    }

    await prisma.ticketType.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

export default router;
