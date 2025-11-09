// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import { requireAdmin } from '../lib/authz.js';
import prisma from '../lib/prisma.js';

const router = Router();

/** Build a Prisma where clause from q/from/to */
function buildWhere(q?: string | null, from?: string | null, to?: string | null) {
  const where: any = {};

  // Date window
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) {
      const d = new Date(to as string);
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }

  // Text search
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { email: { contains: term } },
      { stripeId: { contains: term } },
      { show: { title: { contains: term } } },
    ];
  }

  return where;
}

/** GET /admin/orders — supports ?q=&from=&to= */
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { q, from, to } = req.query as Record<string, string | undefined>;
    const where = buildWhere(q, from, to);

    const items = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        email: true,
        stripeId: true,
        status: true,
        amountPence: true,
        quantity: true,
        platformFeePence: true,
        organiserSharePence: true,
        paymentFeePence: true,
        show: { select: { id: true, title: true } },
      },
      take: 500,
    });

    const mapped = items.map((o) => {
      const amount = Number(o.amountPence || 0);
      const platform = Number(o.platformFeePence || 0);
      const organiserShare = Number(o.organiserSharePence || 0);
      const payment = Number(o.paymentFeePence || 0);
      const ourShare = platform - organiserShare;
      const net = amount - payment - ourShare;
      return { ...o, netPayoutPence: net };
    });

    res.json({ ok: true, items: mapped });
  } catch (err) {
    console.error('GET /admin/orders failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load orders' });
  }
});

/** GET /admin/orders/:id — order detail (+tickets, refunds, notes) */
router.get('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const o = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        email: true,
        stripeId: true,
        status: true,
        amountPence: true,
        quantity: true,
        platformFeePence: true,
        organiserSharePence: true,
        paymentFeePence: true,
        show: { select: { id: true, title: true, date: true } },
        tickets: {
          select: {
            id: true, serial: true, holderName: true, status: true, scannedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        refunds: {
          select: { id: true, amount: true, reason: true, stripeId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        notes: {
          select: {
            id: true, text: true, createdAt: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!o) return res.status(404).json({ ok: false, error: 'Not found' });

    const amount = Number(o.amountPence || 0);
    const platform = Number(o.platformFeePence || 0);
    const organiserShare = Number(o.organiserSharePence || 0);
    const payment = Number(o.paymentFeePence || 0);
    const ourShare = platform - organiserShare;
    const net = amount - payment - ourShare;

    res.json({ ok: true, item: { ...o, netPayoutPence: net } });
  } catch (err) {
    console.error('GET /admin/orders/:id failed', err);
    res.status(500).json({ ok: false, error: 'Failed to load order' });
  }
});

/** POST /admin/orders/:id/notes { text } — add an internal note */
router.post('/orders/:id/notes', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: 'Text required' });
    }

    // If you attach user identity to req (e.g. req.user.id), wire it here.
    const note = await prisma.orderNote.create({
      data: { orderId: id, text: String(text).trim() },
      select: { id: true, text: true, createdAt: true },
    });

    res.json({ ok: true, note });
  } catch (err) {
    console.error('POST /admin/orders/:id/notes failed', err);
    res.status(500).json({ ok: false, error: 'Failed to add note' });
  }
});

export default router;
