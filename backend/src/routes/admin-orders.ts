// backend/src/routes/admin-orders.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

const router = Router();

// Simple admin guard via x-admin-key
router.use((req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }
  next();
});

/**
 * GET /admin/orders
 * Optional filters:
 *   - status=PENDING|PAID|CANCELLED
 *   - showId=<show id>
 *   - from=ISO date (filters orders createdAt >= from)
 *   - to=ISO date (filters orders createdAt <= to)
 *   - limit=number (default 50, max 200)
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const {
      status,
      showId,
      from,
      to,
      limit: limitStr
    } = req.query as {
      status?: string;
      showId?: string;
      from?: string;
      to?: string;
      limit?: string;
    };

    const where: any = {};
    if (status && ['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
      where.status = status;
    }
    if (showId) {
      where.showId = showId;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    let take = 50;
    if (limitStr) {
      const n = Number(limitStr);
      if (!Number.isNaN(n)) take = Math.min(Math.max(n, 1), 200);
    }

    const orders = await prisma.order.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: {
              select: {
                id: true,
                name: true,
                city: true,
                postcode: true
              }
            }
          }
        },
        tickets: {
          select: {
            id: true,
            serial: true,
            status: true,
            scannedAt: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Simple summary (useful for UI)
    const summary = {
      total: orders.length,
      byStatus: orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {}),
      totalAmountPence: orders.reduce((sum, o) => sum + (o.amountPence || 0), 0)
    };

    res.json({ ok: true, summary, orders });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('GET /admin/orders error:', err);
    res.status(500).json({ error: true, message: 'Server error' });
  }
});

/**
 * GET /admin/orders/:id
 * Fetch a single order with relations.
 */
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: {
              select: { id: true, name: true, city: true, postcode: true }
            }
          }
        },
        tickets: {
          select: { id: true, serial: true, status: true, scannedAt: true }
        },
        user: { select: { id: true, email: true, name: true } }
      }
    });

    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });
    res.json({ ok: true, order });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('GET /admin/orders/:id error:', err);
    res.status(500).json({ error: true, message: 'Server error' });
  }
});

export default router;
