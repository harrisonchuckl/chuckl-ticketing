import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { withAuth } from '../middleware/requireAuth.js';
import { readSession } from '../lib/auth.js';

const router = Router();
router.use(...withAuth());

// list recent orders (restricted to venues user can access)
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const s = await readSession(req);
    if (!s) return res.status(401).json({ error: true, message: 'Unauthenticated' });

    const limit = Math.min(Number(req.query.limit || 50), 200);

    const select = {
      id: true,
      email: true,
      name: true,
      totalPence: true,
      status: true,
      createdAt: true,
      show: { select: { id: true, title: true, venueId: true } },
      ticketType: { select: { id: true, name: true } }
    } as const;

    let orders;
    if (s.role === 'SUPERADMIN') {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select
      });
    } else {
      orders = await prisma.order.findMany({
        where: { show: { venue: { userLinks: { some: { userId: s.uid } } } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select
      });
    }

    return res.json({ orders });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

export default router;
