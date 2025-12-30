import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { applySuppression } from '../services/marketing/campaigns.js';
import { MarketingEmailEventType, MarketingSuppressionType } from '@prisma/client';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/sendgrid', webhookLimiter, async (req, res) => {
  const token = process.env.SENDGRID_WEBHOOK_TOKEN;
  if (token) {
    const provided = String(req.headers['x-webhook-token'] || '').trim();
    if (!provided || provided !== token) {
      return res.status(401).json({ ok: false, message: 'Invalid webhook token' });
    }
  }

  const events = Array.isArray(req.body) ? req.body : [];

  for (const event of events) {
    const email = String(event?.email || '').toLowerCase();
    const type = String(event?.event || '').toLowerCase();
    const customArgs = event?.custom_args || {};
    const tenantId = String(customArgs.tenantId || '').trim();
    const campaignId = String(customArgs.campaignId || '').trim();
    const contactId = customArgs.contactId ? String(customArgs.contactId) : null;

    if (!tenantId || !campaignId || !email) continue;

    let eventType: MarketingEmailEventType | null = null;
    if (type === 'delivered') eventType = MarketingEmailEventType.DELIVERED;
    if (type === 'bounce') eventType = MarketingEmailEventType.BOUNCE;
    if (type === 'spamreport') eventType = MarketingEmailEventType.COMPLAINT;
    if (type === 'open') eventType = MarketingEmailEventType.OPEN;
    if (type === 'click') eventType = MarketingEmailEventType.CLICK;
    if (type === 'unsubscribe') eventType = MarketingEmailEventType.UNSUBSCRIBE;

    if (eventType) {
      await prisma.marketingEmailEvent.create({
        data: {
          tenantId,
          campaignId,
          contactId,
          email,
          type: eventType,
          meta: event || {},
        },
      });
    }

    if (type === 'bounce') {
      await applySuppression(tenantId, email, MarketingSuppressionType.HARD_BOUNCE, 'SendGrid bounce');
    }
    if (type === 'spamreport') {
      await applySuppression(tenantId, email, MarketingSuppressionType.SPAM_COMPLAINT, 'SendGrid spam report');
    }
    if (type === 'unsubscribe') {
      await applySuppression(tenantId, email, MarketingSuppressionType.UNSUBSCRIBE, 'SendGrid unsubscribe');
    }
  }

  res.json({ ok: true });
});

export default router;
