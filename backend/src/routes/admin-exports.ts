// backend/src/routes/admin-exports.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/orders/export.csv
 * Optional query params:
 *   q     -> search email, stripeId, show title (case-insensitive)
 *   from  -> YYYY-MM-DD (inclusive)
 *   to    -> YYYY-MM-DD (inclusive)
 */
router.get('/orders/export.csv', requireAdmin, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;

  const where: any = {};
  if (from || to) where.createdAt = {};
  if (from) (where.createdAt as any).gte = from;
  if (to) (where.createdAt as any).lte = to;

  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' as const } },
      { stripeId: { contains: q, mode: 'insensitive' as const } },
      { show: { title: { contains: q, mode: 'insensitive' as const } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      email: true,
      stripeId: true,
      amountPence: true,
      quantity: true,
      platformFeePence: true,
      organiserSharePence: true,
      paymentFeePence: true,
      netPayoutPence: true,
      show: { select: { id: true, title: true } },
      user: { select: { id: true, email: true, organiserSplitBps: true } },
    },
  });

  const header = [
    'order_id',
    'created_at',
    'status',
    'buyer_email',
    'stripe_payment_intent',
    'show_id',
    'show_title',
    'quantity',
    'gross_amount_pence',
    'platform_fee_pence',
    'organiser_share_pence',
    'our_share_pence',
    'payment_fee_pence',
    'net_payout_pence',
    'organiser_id',
    'organiser_email',
    'organiser_split_bps',
  ];

  const rows = orders.map((o) => {
    const platform = o.platformFeePence ?? 0;
    const organiserShare = o.organiserSharePence ?? 0;
    const ourShare = platform - organiserShare;

    return [
      o.id,
      o.createdAt.toISOString(),
      o.status,
      o.email ?? '',
      o.stripeId ?? '',
      o.show?.id ?? '',
      (o.show?.title ?? '').replaceAll('\n', ' '),
      String(o.quantity ?? 0),
      String(o.amountPence ?? 0),
      String(platform),
      String(organiserShare),
      String(ourShare),
      String(o.paymentFeePence ?? 0),
      String(o.netPayoutPence ?? 0),
      o.user?.id ?? '',
      o.user?.email ?? '',
      String(o.user?.organiserSplitBps ?? ''),
    ];
  });

  const csv = [header, ...rows]
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
  res.send(csv);
});

export default router;
