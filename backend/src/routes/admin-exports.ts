// backend/src/routes/admin-exports.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../lib/db.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/orders/export.csv?q=...
 * Exports orders with joined notes and refunds.
 */
router.get('/orders/export.csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = (String(req.query.q || '')).trim();

    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' as const } },
        { stripeId: { contains: q, mode: 'insensitive' as const } },
        { show: { title: { contains: q, mode: 'insensitive' as const } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        show: true,
        tickets: true,
        refunds: true,
        notes: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000, // sane cap
    });

    const headers = [
      'order_id',
      'created_at',
      'email',
      'status',
      'amount_pence',
      'quantity',
      'stripe_id',
      'show_title',
      'show_date',
      'refund_count',
      'refund_total_pence',
      'notes_concat',
      'ticket_serials',
    ];

    const safe = (v: any) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows: string[] = [];
    rows.push(headers.join(','));

    for (const o of orders) {
      const refundCount = o.refunds.length;
      const refundTotal = o.refunds.reduce((s, r) => s + (r.amount || 0), 0);
      const notesConcat = o.notes
        .map(n => {
          const who = n.user ? (n.user.name || n.user.email || 'User') : 'System';
          return `${n.createdAt.toISOString()} – ${who}: ${n.text}`;
        })
        .join(' | ');
      const ticketSerials = (o.tickets || []).map(t => t.serial).join(' ');

      const line = [
        safe(o.id),
        safe(o.createdAt.toISOString()),
        safe(o.email || ''),
        safe(o.status),
        safe(o.amountPence ?? ''),
        safe(o.quantity ?? ''),
        safe(o.stripeId ?? ''),
        safe(o.show?.title ?? ''),
        safe(o.show?.date ? o.show.date.toISOString() : ''),
        safe(refundCount),
        safe(refundTotal),
        safe(notesConcat),
        safe(ticketSerials),
      ].join(',');

      rows.push(line);
    }

    const csv = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
    res.send(csv);
  } catch (e: any) {
    res.status(500).send('Export failed: ' + (e?.message ?? 'Unknown error'));
  }
});

export default router;
