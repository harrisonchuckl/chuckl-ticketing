import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';
import { estimateCampaignRecipients } from '../services/marketing/campaigns.js';

const router = Router();

router.post('/segments/:id/estimate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = String(req.user?.id || '');
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const rulesOverride = req.body?.rules;
  const estimate = await estimateCampaignRecipients(tenantId, rulesOverride || segment.rules);
  res.json({ ok: true, estimate });
});

export default router;
