// backend/src/routes/admin-orders.ts
import { Router } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import * as EmailSvc from '../services/email.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * Utility: sum refunds for an order
 */
async function refundedTotalPence(orderId: string): Promise<number> {
  const agg = await prisma.refund.aggregate({
    _sum: { amountPence: true },
    where: { orderId },
  });
  return agg._sum.amountPence || 0;
}

/**
 * GET /admin/orders
 * Query params:
 *  - q: search (email, show title)
 *  - status: PAID|REFUNDED|CANCELLED (optional)
 *  - limit (default 25, max 100)
 *  - cursor (id) for pagination
 */
router.get('/orders', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '25'), 10) || 25, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

    const where: any = {};
    if (status && ['PAID', 'REFUNDED', 'CANCELLED'].includes(status)) {
      where.status = status as OrderStatus;
    }

    // Basic search on order email and show title
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { show: { title: { contains: q, mode: 'insensitive' } } },
        { id: { equals: q } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        show: { select: { id: true, title: true, date: true, venueId: true } },
      },
    });

    const hasMore = orders.length > limit;
    const page = hasMore ? orders.slice(0, limit) : orders;

    // Enrich with ticketsCount & refundedTotal
    const enriched = await Promise.all(
      page.map(async (o) => {
        const [ticketsCount, refundedPence] = await Promise.all([
          prisma.ticket.count({ where: { orderId: o.id } }),
          refundedTotalPence(o.id),
        ]);
        return {
          ...o,
          ticketsCount,
          refundedPence,
          netPence: Math.max(0, o.amountPence - refundedPence),
        };
      })
    );

    res.json({
      ok: true,
      orders: enriched,
      nextCursor: hasMore ? orders[limit].id : null,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load orders' });
  }
});

/**
 * GET /admin/orders/:id
 * Full order view with tickets & refunds
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        show: { include: { venue: true } },
        tickets: true,
        refunds: true,
      },
    });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    const refundedPence = await refundedTotalPence(id);

    res.json({
      ok: true,
      order: {
        ...order,
        refundedPence,
        netPence: Math.max(0, order.amountPence - refundedPence),
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to load order' });
  }
});

/**
 * POST /admin/orders/:id/resend
 * Triggers email with tickets. Uses EmailSvc.sendTicketsEmail(orderId)
 */
router.post('/orders/:id/resend', async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({ where: { id }, include: { tickets: true, show: true } });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Optional: block if no tickets
    if (!order.tickets || order.tickets.length === 0) {
      return res.status(400).json({ ok: false, message: 'No tickets on this order' });
    }

    if (typeof (EmailSvc as any).sendTicketsEmail !== 'function') {
      return res.status(501).json({ ok: false, message: 'Email not configured on server' });
    }

    await EmailSvc.sendTicketsEmail(order.id);
    res.json({ ok: true, message: 'Tickets resent' });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Failed to resend tickets' });
  }
});

/**
 * POST /admin/orders/:id/refund
 * Body: { amountPence?: number, reason?: string }
 * If amountPence omitted → full remaining (amount - already refunded).
 */
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { amountPence, reason } = req.body || {};

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.REFUNDED) {
      return res.status(400).json({ ok: false, message: `Cannot refund order in status ${order.status}` });
    }

    const alreadyRefunded = await refundedTotalPence(id);
    const maxRefundable = Math.max(0, order.amountPence - alreadyRefunded);

    let toRefund = typeof amountPence === 'number' ? Math.floor(amountPence) : maxRefundable;
    if (toRefund <= 0) return res.status(400).json({ ok: false, message: 'Nothing to refund' });
    if (toRefund > maxRefundable) toRefund = maxRefundable;

    // Create refund record
    await prisma.refund.create({
      data: {
        orderId: id,
        amountPence: toRefund,
        reason: reason ? String(reason) : null,
      },
    });

    // If fully refunded now → set status REFUNDED
    const newRefunded = alreadyRefunded + toRefund;
    if (newRefunded >= order.amountPence) {
      await prisma.order.update({ where: { id }, data: { status: OrderStatus.REFUNDED } });
    }

    res.json({
      ok: true,
      refundedPence: newRefunded,
      netPence: Math.max(0, order.amountPence - newRefunded),
      status: newRefunded >= order.amountPence ? OrderStatus.REFUNDED : order.status,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message ?? 'Refund failed' });
  }
});

export default router;
