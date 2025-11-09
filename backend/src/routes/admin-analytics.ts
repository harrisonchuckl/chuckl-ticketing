// backend/src/routes/admin-analytics.ts
import { Router } from 'express';
import { requireAdmin } from '../lib/authz.js';
import prisma from '../lib/prisma.js';

const router = Router();

/** helper: pence safe number */
const N = (v: unknown) => Number(v || 0);

/** GET /admin/analytics/summary — KPIs for Home */
router.get('/analytics/summary', requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Last 7 days
    const last7From = new Date(now);
    last7From.setDate(now.getDate() - 7);

    // Month-to-date
    const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    async function block(from: Date) {
      const items = await prisma.order.findMany({
        where: { createdAt: { gte: from } },
        select: {
          amountPence: true,
          platformFeePence: true,
          organiserSharePence: true,
          paymentFeePence: true,
        },
      });
      let orders = 0, gmv = 0, ourFees = 0, net = 0;
      for (const o of items) {
        orders += 1;
        const amount = N(o.amountPence);
        const platform = N(o.platformFeePence);
        const organiserShare = N(o.organiserSharePence);
        const payment = N(o.paymentFeePence);
        const ourShare = platform - organiserShare;
        const netPayout = amount - payment - ourShare;

        gmv += amount;
        ourFees += ourShare;
        net += netPayout;
      }
      return { orders, gmvPence: gmv, ourFeesPence: ourFees, netPayoutPence: net };
    }

    const [ last7, mtd ] = await Promise.all([ block(last7From), block(mtdFrom) ]);

    res.json({ ok: true, summary: { last7, mtd } });
  } catch (e) {
    console.error('GET /admin/analytics/summary failed', e);
    res.status(500).json({ ok: false, error: 'Failed to load summary' });
  }
});

export default router;
