import prisma from '../../lib/prisma.js';
import {
  MarketingAutomationStateStatus,
  MarketingAutomationTriggerType,
  MarketingAutomationStepStatus,
  MarketingConsentStatus,
  MarketingEmailEventType,
  MarketingRecipientStatus,
  Prisma,
} from '@prisma/client';
import { getEmailProvider } from '../../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../../lib/email-marketing/preferences.js';
import { renderMarketingTemplate } from '../../lib/email-marketing/rendering.js';
import { shouldSuppressContact } from './campaigns.js';
import { buildRecommendedShowsHtml } from './recommendations.js';
import { fetchMarketingSettings, resolveRequireVerifiedFrom, resolveSenderDetails } from './settings.js';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const AUTOMATION_LOCK_MINUTES = Number(process.env.MARKETING_AUTOMATION_LOCK_MINUTES || 5);
const REQUIRE_VERIFIED_FROM = String(process.env.MARKETING_REQUIRE_VERIFIED_FROM || 'true') === 'true';
const VERIFIED_FROM_DOMAIN = String(process.env.MARKETING_FROM_DOMAIN || '').trim();

function baseUrl() {
  return PUBLIC_BASE_URL.replace(/\/+$/, '');
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

function tenantSlugFrom(user: { storefrontSlug?: string | null; id: string }) {
  return user.storefrontSlug || user.id;
}

function applyMarketingStream(fromEmail: string) {
  const streamDomain = String(process.env.MARKETING_STREAM_DOMAIN || '').trim();
  if (!streamDomain) return fromEmail;
  const at = fromEmail.indexOf('@');
  if (at === -1) return fromEmail;
  return `${fromEmail.slice(0, at)}@${streamDomain}`;
}

function isFromVerified(fromEmail: string, requireVerifiedFrom: boolean) {
  if (!requireVerifiedFrom || !VERIFIED_FROM_DOMAIN) return true;
  const effective = applyMarketingStream(fromEmail);
  return effective.toLowerCase().endsWith(`@${VERIFIED_FROM_DOMAIN.toLowerCase()}`);
}

async function buildUnsubscribeUrl(tenantId: string, email: string) {
  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { storefrontSlug: true, id: true },
  });
  if (!tenant) throw new Error('Tenant not found');
  const token = createUnsubscribeToken({ tenantId, email });
  const slug = tenantSlugFrom(tenant);
  return `${baseUrl()}/u/${encodeURIComponent(slug)}/${encodeURIComponent(token)}`;
}

async function buildPreferencesUrl(tenantId: string, email: string) {
  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { storefrontSlug: true, id: true },
  });
  if (!tenant) throw new Error('Tenant not found');
  const token = createPreferencesToken({ tenantId, email });
  const slug = tenantSlugFrom(tenant);
  return `${baseUrl()}/preferences/${encodeURIComponent(slug)}/${encodeURIComponent(token)}`;
}

async function shouldSendAutomationEmail(tenantId: string, contactId: string, email: string) {
  const consent = await prisma.marketingConsent.findUnique({
    where: { tenantId_contactId: { tenantId, contactId } },
    select: { status: true },
  });
  const suppression = await prisma.marketingSuppression.findFirst({
    where: { tenantId, email },
    select: { type: true },
  });
  const decision = shouldSuppressContact(
    (consent?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY,
    suppression
  );
  return !decision.suppressed;
}

export async function enqueueAutomationForContact(tenantId: string, contactId: string, trigger: MarketingAutomationTriggerType) {
  const automations = await prisma.marketingAutomation.findMany({
    where: { tenantId, triggerType: trigger, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const existing = await prisma.marketingAutomationState.findUnique({
      where: { tenantId_contactId_automationId: { tenantId, contactId, automationId: automation.id } },
    });
    if (existing) continue;

    const firstStep = [...automation.steps].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    const delay = Math.max(0, firstStep?.delayMinutes || 0);
    const nextRunAt = new Date(Date.now() + delay * 60 * 1000);

    await prisma.marketingAutomationState.create({
      data: {
        tenantId,
        contactId,
        automationId: automation.id,
        nextRunAt,
        status: MarketingAutomationStateStatus.ACTIVE,
      },
    });

    await prisma.marketingAuditLog.create({
      data: {
        tenantId,
        action: 'automation.enqueued',
        entityType: 'MarketingAutomation',
        entityId: automation.id,
        metadata: { contactId, trigger },
      },
    });
  }
}

export async function processNoPurchaseAutomations() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.NO_PURCHASE_DAYS, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const scanned = await prisma.marketingAuditLog.findFirst({
      where: {
        tenantId: automation.tenantId,
        action: 'automation.no_purchase_scan',
        createdAt: { gte: start },
      },
    });
    if (scanned) continue;

    const firstStep = [...automation.steps].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    const days = Number((firstStep as any)?.conditionRules?.days || 30);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const contacts = await prisma.marketingContact.findMany({
      where: { tenantId: automation.tenantId },
      select: { id: true, email: true },
    });

    for (const contact of contacts) {
      const lastOrder = await prisma.order.findFirst({
        where: {
          status: 'PAID',
          email: contact.email,
          show: { organiserId: automation.tenantId },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (lastOrder && lastOrder.createdAt > cutoff) continue;

      await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.NO_PURCHASE_DAYS);
    }

    await prisma.marketingAuditLog.create({
      data: {
        tenantId: automation.tenantId,
        action: 'automation.no_purchase_scan',
        entityType: 'MarketingAutomation',
        entityId: automation.id,
        metadata: { cutoff: cutoff.toISOString() },
      },
    });
  }
}

export async function processAbandonedCheckoutAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.ABANDONED_CHECKOUT, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const firstStep = [...automation.steps].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    const delayMinutes = Number((firstStep as any)?.conditionRules?.minutesSinceStart || 60);
    const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000);

    const events = await prisma.marketingCheckoutEvent.findMany({
      where: {
        tenantId: automation.tenantId,
        status: 'STARTED',
        createdAt: { lte: cutoff },
      },
    });

    for (const event of events) {
      if (!event.email) {
        await prisma.marketingCheckoutEvent.update({
          where: { id: event.id },
          data: { status: 'COMPLETED' },
        });
        continue;
      }

      const contact = await prisma.marketingContact.findUnique({
        where: { tenantId_email: { tenantId: automation.tenantId, email: event.email } },
        select: { id: true },
      });
      if (contact) {
        await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.ABANDONED_CHECKOUT);
      }

      await prisma.marketingCheckoutEvent.update({
        where: { id: event.id },
        data: { status: 'COMPLETED' },
      });
    }
  }
}

export async function processAutomationSteps() {
  const now = new Date();
  const states = await prisma.marketingAutomationState.findMany({
    where: {
      status: MarketingAutomationStateStatus.ACTIVE,
      nextRunAt: { lte: now },
    },
    include: { automation: true, contact: true },
    take: 50,
  });

  for (const state of states) {
    const lockUntil = new Date(Date.now() + AUTOMATION_LOCK_MINUTES * 60 * 1000);
    const locked = await prisma.marketingAutomationState.updateMany({
      where: {
        id: state.id,
        status: MarketingAutomationStateStatus.ACTIVE,
        nextRunAt: { lte: now },
      },
      data: { nextRunAt: lockUntil },
    });
    if (locked.count === 0) continue;

    const steps = await prisma.marketingAutomationStep.findMany({
      where: { automationId: state.automationId, tenantId: state.tenantId },
      include: { template: true },
      orderBy: { stepOrder: 'asc' },
    });

    const nextStep = steps.find((step) => step.stepOrder > state.currentStep);
    if (!nextStep) {
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: { status: MarketingAutomationStateStatus.COMPLETED, nextRunAt: null },
      });
      continue;
    }

    const existingExecution = await prisma.marketingAutomationStepExecution.findUnique({
      where: { tenantId_contactId_stepId: { tenantId: state.tenantId, contactId: state.contactId, stepId: nextStep.id } },
    });

    if (existingExecution && existingExecution.status === MarketingAutomationStepStatus.SENT) {
      const nextRunAt = computeNextRunAt(steps, nextStep.stepOrder);
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: {
          currentStep: nextStep.stepOrder,
          nextRunAt,
          status: nextRunAt ? MarketingAutomationStateStatus.ACTIVE : MarketingAutomationStateStatus.COMPLETED,
        },
      });
      continue;
    }

    const canSend = await shouldSendAutomationEmail(state.tenantId, state.contactId, state.contact.email);
    if (!canSend) {
      await prisma.marketingAutomationStepExecution.upsert({
        where: { tenantId_contactId_stepId: { tenantId: state.tenantId, contactId: state.contactId, stepId: nextStep.id } },
        create: {
          tenantId: state.tenantId,
          automationId: state.automationId,
          stepId: nextStep.id,
          contactId: state.contactId,
          status: MarketingAutomationStepStatus.SKIPPED,
          sentAt: new Date(),
        },
        update: { status: MarketingAutomationStepStatus.SKIPPED, sentAt: new Date(), errorText: null },
      });

      const nextRunAt = computeNextRunAt(steps, nextStep.stepOrder);
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: {
          currentStep: nextStep.stepOrder,
          nextRunAt,
          status: nextRunAt ? MarketingAutomationStateStatus.ACTIVE : MarketingAutomationStateStatus.COMPLETED,
        },
      });
      continue;
    }

    try {
      const settings = await fetchMarketingSettings(state.tenantId);
      const tenant = await prisma.user.findUnique({
        where: { id: state.tenantId },
        select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
      });
      if (!tenant) throw new Error('Tenant not found');

      const sender = resolveSenderDetails({
        templateFromName: nextStep.template.fromName,
        templateFromEmail: nextStep.template.fromEmail,
        templateReplyTo: nextStep.template.replyTo,
        settings,
      });

      if (!sender.fromEmail) {
        throw new Error('From email required for marketing sends.');
      }

      if (!sender.fromName) {
        throw new Error('From name required for marketing sends.');
      }

      const requireVerifiedFrom = resolveRequireVerifiedFrom(settings, REQUIRE_VERIFIED_FROM);
      if (!isFromVerified(sender.fromEmail, requireVerifiedFrom)) {
        throw new Error('From email not verified for marketing sends.');
      }

      const unsubscribeUrl = await buildUnsubscribeUrl(state.tenantId, state.contact.email);
      const preferencesUrl = await buildPreferencesUrl(state.tenantId, state.contact.email);
      const recommendedShows = await buildRecommendedShowsHtml(state.tenantId, state.contact.email);

      const { html, errors } = renderMarketingTemplate(nextStep.template.mjmlBody, {
        firstName: state.contact.firstName || '',
        lastName: state.contact.lastName || '',
        email: state.contact.email,
        tenantName: tenantNameFrom(tenant),
        unsubscribeUrl,
        preferencesUrl,
        recommendedShows: recommendedShows || '',
      });

      if (errors.length) {
        throw new Error(errors.join('; '));
      }

      const provider = getEmailProvider();
      await provider.sendEmail({
        to: state.contact.email,
        subject: nextStep.template.subject,
        html,
        fromName: sender.fromName,
        fromEmail: applyMarketingStream(sender.fromEmail),
        replyTo: sender.replyTo,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        customArgs: {
          automationId: state.automationId,
          tenantId: state.tenantId,
          contactId: state.contactId,
        },
      });

      await prisma.marketingAutomationStepExecution.upsert({
        where: { tenantId_contactId_stepId: { tenantId: state.tenantId, contactId: state.contactId, stepId: nextStep.id } },
        create: {
          tenantId: state.tenantId,
          automationId: state.automationId,
          stepId: nextStep.id,
          contactId: state.contactId,
          status: MarketingAutomationStepStatus.SENT,
          sentAt: new Date(),
        },
        update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
      });

      await prisma.marketingAuditLog.create({
        data: {
          tenantId: state.tenantId,
          action: 'automation.step.sent',
          entityType: 'MarketingAutomationStep',
          entityId: nextStep.id,
          metadata: { contactId: state.contactId },
        },
      });
    } catch (error: any) {
      await prisma.marketingAutomationStepExecution.upsert({
        where: { tenantId_contactId_stepId: { tenantId: state.tenantId, contactId: state.contactId, stepId: nextStep.id } },
        create: {
          tenantId: state.tenantId,
          automationId: state.automationId,
          stepId: nextStep.id,
          contactId: state.contactId,
          status: MarketingAutomationStepStatus.FAILED,
          errorText: error?.message || 'Send failed',
          sentAt: new Date(),
        },
        update: { status: MarketingAutomationStepStatus.FAILED, errorText: error?.message || 'Send failed', sentAt: new Date() },
      });

      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: { status: MarketingAutomationStateStatus.STOPPED },
      });
      continue;
    }

    const nextRunAt = computeNextRunAt(steps, nextStep.stepOrder);
    await prisma.marketingAutomationState.update({
      where: { id: state.id },
      data: {
        currentStep: nextStep.stepOrder,
        nextRunAt,
        status: nextRunAt ? MarketingAutomationStateStatus.ACTIVE : MarketingAutomationStateStatus.COMPLETED,
      },
    });
  }
}

function computeNextRunAt(steps: Array<{ stepOrder: number; delayMinutes: number }>, currentStep: number) {
  const next = steps.find((step) => step.stepOrder > currentStep);
  if (!next) return null;
  const delayMs = Math.max(0, next.delayMinutes) * 60 * 1000;
  return new Date(Date.now() + delayMs);
}

export async function recordAbandonedCheckoutEvent(options: {
  tenantId: string;
  orderId: string;
  showId?: string | null;
  email?: string | null;
}) {
  await prisma.marketingCheckoutEvent.upsert({
    where: { tenantId_orderId: { tenantId: options.tenantId, orderId: options.orderId } },
    create: {
      tenantId: options.tenantId,
      orderId: options.orderId,
      showId: options.showId || null,
      email: options.email || null,
      status: 'STARTED',
    },
    update: {
      email: options.email || undefined,
      showId: options.showId || undefined,
    },
  });
}

export async function markCheckoutCompleted(tenantId: string, orderId: string, email?: string | null) {
  await prisma.marketingCheckoutEvent.updateMany({
    where: { tenantId, orderId },
    data: { status: 'COMPLETED', email: email || undefined },
  });
}

export async function recordAutomationAudit(
  tenantId: string,
  action: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action,
      entityType: 'MarketingAutomation',
      entityId,
      metadata: metadata || undefined,
    },
  });
}

export async function recordPreferenceAudit(
  tenantId: string,
  action: string,
  entityId: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action,
      entityType: 'MarketingPreferences',
      entityId: entityId || undefined,
      metadata: metadata || undefined,
    },
  });
}

export async function recordDeliverabilityAudit(tenantId: string, metadata?: Prisma.InputJsonValue) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action: 'deliverability.viewed',
      entityType: 'MarketingDeliverability',
      entityId: null,
      metadata: metadata || undefined,
    },
  });
}

export async function ensureContactPreferenceDefaults(tenantId: string, contactId: string) {
  const topics = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });

  for (const topic of topics) {
    await prisma.marketingContactPreference.upsert({
      where: { tenantId_contactId_topicId: { tenantId, contactId, topicId: topic.id } },
      create: {
        tenantId,
        contactId,
        topicId: topic.id,
        status: 'SUBSCRIBED',
      },
      update: {},
    });
  }
}

export async function updateContactPreferences(options: {
  tenantId: string;
  contactId: string;
  topicStates: Array<{ topicId: string; status: 'SUBSCRIBED' | 'UNSUBSCRIBED' }>;
}) {
  for (const topic of options.topicStates) {
    await prisma.marketingContactPreference.upsert({
      where: {
        tenantId_contactId_topicId: {
          tenantId: options.tenantId,
          contactId: options.contactId,
          topicId: topic.topicId,
        },
      },
      create: {
        tenantId: options.tenantId,
        contactId: options.contactId,
        topicId: topic.topicId,
        status: topic.status,
      },
      update: { status: topic.status },
    });
  }
}

export async function fetchDeliverabilitySummary(tenantId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await prisma.marketingEmailEvent.groupBy({
    by: ['type'],
    where: { tenantId, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const countByType = new Map(events.map((e) => [e.type, e._count._all]));
  const delivered = countByType.get(MarketingEmailEventType.DELIVERED) || 0;
  const bounce = countByType.get(MarketingEmailEventType.BOUNCE) || 0;
  const complaint = countByType.get(MarketingEmailEventType.COMPLAINT) || 0;
  const unsubscribe = countByType.get(MarketingEmailEventType.UNSUBSCRIBE) || 0;
  const click = countByType.get(MarketingEmailEventType.CLICK) || 0;

  const rate = (num: number) => (delivered ? Math.round((num / delivered) * 10000) / 100 : 0);

  return {
    delivered,
    bounce,
    complaint,
    unsubscribe,
    click,
    bounceRate: rate(bounce),
    complaintRate: rate(complaint),
    unsubscribeRate: rate(unsubscribe),
    clickRate: rate(click),
  };
}

export async function fetchTopSegmentsByEngagement(tenantId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { id: true, segmentId: true, segment: { select: { name: true } } },
  });
  if (!campaigns.length) return [];

  const recipientCounts = await prisma.marketingCampaignRecipient.groupBy({
    by: ['campaignId'],
    where: { campaignId: { in: campaigns.map((c) => c.id) }, status: MarketingRecipientStatus.SENT },
    _count: { _all: true },
  });

  const engagementCounts = await prisma.marketingEmailEvent.groupBy({
    by: ['campaignId'],
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      type: { in: [MarketingEmailEventType.OPEN, MarketingEmailEventType.CLICK] },
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  const recipientsByCampaign = new Map(recipientCounts.map((r) => [r.campaignId, r._count._all]));
  const engagementByCampaign = new Map(engagementCounts.map((r) => [r.campaignId, r._count._all]));

  const segmentMap = new Map<string, { name: string; sent: number; engagement: number }>();

  for (const campaign of campaigns) {
    const sent = recipientsByCampaign.get(campaign.id) || 0;
    const engagement = engagementByCampaign.get(campaign.id) || 0;
    const key = campaign.segmentId;
    if (!segmentMap.has(key)) {
      segmentMap.set(key, { name: campaign.segment?.name || 'Unknown', sent: 0, engagement: 0 });
    }
    const entry = segmentMap.get(key)!;
    entry.sent += sent;
    entry.engagement += engagement;
  }

  return Array.from(segmentMap.entries())
    .map(([segmentId, entry]) => ({
      segmentId,
      name: entry.name,
      sent: entry.sent,
      engagement: entry.engagement,
      engagementRate: entry.sent ? Math.round((entry.engagement / entry.sent) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5);
}

export function warmupPresets() {
  return {
    guidance: [
      'Start low and ramp sending volume over 2–4 weeks to establish reputation.',
      'Begin with highly engaged segments to maximize opens/clicks.',
      'Separate transactional and marketing streams to protect critical mail.',
    ],
    presets: [
      { label: 'Week 1', dailyLimit: 500, ratePerSecond: 5, batchSize: 20 },
      { label: 'Week 2', dailyLimit: 2000, ratePerSecond: 10, batchSize: 50 },
      { label: 'Week 3', dailyLimit: 5000, ratePerSecond: 20, batchSize: 75 },
      { label: 'Week 4+', dailyLimit: 10000, ratePerSecond: 50, batchSize: 100 },
    ],
  };
}
