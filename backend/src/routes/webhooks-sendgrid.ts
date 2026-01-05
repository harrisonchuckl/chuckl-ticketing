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

const SENDGRID_WEBHOOK_MAX_AGE_HOURS = Number(process.env.SENDGRID_WEBHOOK_MAX_AGE_HOURS || 72);

function resolveEventTimestamp(event: any) {
  const timestamp = Number(event?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const parsed = new Date(timestamp * 1000);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function rollupDeltaForEvent(eventType: MarketingEmailEventType | null) {
  return {
    sent: eventType === MarketingEmailEventType.DELIVERED ? 1 : 0,
    opened: eventType === MarketingEmailEventType.OPEN ? 1 : 0,
    clicked: eventType === MarketingEmailEventType.CLICK ? 1 : 0,
    bounced: eventType === MarketingEmailEventType.BOUNCE ? 1 : 0,
    unsubscribed: eventType === MarketingEmailEventType.UNSUBSCRIBE ? 1 : 0,
  };
}

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
    const providerEventId = String(event?.sg_event_id || event?.event_id || '').trim() || null;
    const eventAt = resolveEventTimestamp(event);

    if (!tenantId || !campaignId || !email) continue;

    if (eventAt && SENDGRID_WEBHOOK_MAX_AGE_HOURS > 0) {
      const ageMs = Date.now() - eventAt.getTime();
      if (ageMs > SENDGRID_WEBHOOK_MAX_AGE_HOURS * 60 * 60 * 1000) {
        continue;
      }
    }

    if (providerEventId) {
      try {
        await prisma.marketingEmailEventReceipt.create({
          data: {
            tenantId,
            provider: 'sendgrid',
            providerEventId,
            eventAt: eventAt || null,
            meta: event || {},
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }

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

    const delta = rollupDeltaForEvent(eventType);
    if (delta.sent || delta.opened || delta.clicked || delta.bounced || delta.unsubscribed) {
      const rollupDay = toUtcDay(eventAt || new Date());
      await prisma.marketingDailyEventRollup.upsert({
        where: {
          tenantId_day: {
            tenantId,
            day: rollupDay,
          },
        },
        update: {
          sent: delta.sent ? { increment: delta.sent } : undefined,
          opened: delta.opened ? { increment: delta.opened } : undefined,
          clicked: delta.clicked ? { increment: delta.clicked } : undefined,
          bounced: delta.bounced ? { increment: delta.bounced } : undefined,
          unsubscribed: delta.unsubscribed ? { increment: delta.unsubscribed } : undefined,
        },
        create: {
          tenantId,
          day: rollupDay,
          sent: delta.sent,
          opened: delta.opened,
          clicked: delta.clicked,
          bounced: delta.bounced,
          unsubscribed: delta.unsubscribed,
        },
      });
    }

    const bounceClass = Number(event?.bounce_class ?? event?.bounceClass ?? event?.classification ?? NaN);
    const bounceType = String(event?.type || event?.bounce_type || event?.bounceType || '').toLowerCase();
    const isHardBounce =
      (Number.isFinite(bounceClass) && bounceClass >= 10) ||
      bounceType.includes('hard') ||
      bounceType.includes('invalid');

    if (type === 'bounce' && isHardBounce) {
      await applySuppression(tenantId, email, MarketingSuppressionType.HARD_BOUNCE, 'SendGrid hard bounce');
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
