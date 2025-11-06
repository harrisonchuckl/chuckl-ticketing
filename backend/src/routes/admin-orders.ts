// backend/src/routes/admin-orders.ts
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// List orders
router.get('/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        show: { select: { title: true, date: true } },
        user: { select: { email: true, name: true } },
        ticketType: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json({ ok: true, orders });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed to load orders' });
  }
});

export default router;
