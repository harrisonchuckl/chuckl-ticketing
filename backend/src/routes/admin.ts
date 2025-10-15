import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

// Quick sanity: get order
router.get('/order/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: 'failed', detail: String(e?.message || e) });
  }
});

// Quick sanity: tickets for an order
router.get('/tickets/by-order/:id', async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(tickets);
  } catch (e: any) {
    res.status(500).json({ error: 'failed', detail: String(e?.message || e) });
  }
});

export default router;
