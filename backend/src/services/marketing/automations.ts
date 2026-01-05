import prisma from '../../lib/prisma.js';
import {
  MarketingAutomationStateStatus,
  MarketingAutomationTriggerType,
  MarketingAutomationStepStatus,
  MarketingAutomationStepType,
  MarketingConsentStatus,
  MarketingEmailEventType,
  MarketingRecipientStatus,
  MarketingPreferenceStatus,
  Prisma,
} from '@prisma/client';
import { getEmailProvider } from '../../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../../lib/email-marketing/preferences.js';
import { renderMarketingTemplate } from '../../lib/email-marketing/rendering.js';
import { shouldSuppressContact } from './campaigns.js';
import { buildRecommendedShowsHtml } from './recommendations.js';
import {
  fetchMarketingSettings,
  applyMarketingStreamToEmail,
  assertSenderVerified,
  buildListUnsubscribeMail,
  resolveRequireVerifiedFrom,
  resolveSenderDetails,
} from './settings.js';
import { matchesSegmentRules, SegmentRule } from './segments.js';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const AUTOMATION_LOCK_MINUTES = Number(process.env.MARKETING_AUTOMATION_LOCK_MINUTES || 5);
const REQUIRE_VERIFIED_FROM = String(process.env.MARKETING_REQUIRE_VERIFIED_FROM || 'true') === 'true';

function baseUrl() {
  return PUBLIC_BASE_URL.replace(/\/+$/, '');
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

function tenantSlugFrom(user: { storefrontSlug?: string | null; id: string }) {
  return user.storefrontSlug || user.id;
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

type TriggerPayload = {
  triggerKey?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function enqueueAutomationForContact(
  tenantId: string,
  contactId: string,
  trigger: MarketingAutomationTriggerType,
  payload: TriggerPayload = {}
) {
  const automations = await prisma.marketingAutomation.findMany({
    where: { tenantId, triggerType: trigger, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const triggerKey = String(payload.triggerKey || '');
    const existing = await prisma.marketingAutomationState.findUnique({
      where: { tenantId_contactId_automationId_triggerKey: { tenantId, contactId, automationId: automation.id, triggerKey } },
    });
    if (existing) continue;

    const firstStep = [...automation.steps].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    const delay = Math.max(0, firstStep?.delayMinutes || 0);
    const nextRunAt = new Date(Date.now() + delay * 60 * 1000);

    const run = await prisma.marketingAutomationRun.create({
      data: {
        tenantId,
        automationId: automation.id,
        contactId,
        triggerType: trigger,
        triggerKey,
        status: MarketingAutomationStateStatus.ACTIVE,
        metadata: payload.metadata || undefined,
      },
    });

    await prisma.marketingAutomationState.create({
      data: {
        tenantId,
        contactId,
        automationId: automation.id,
        runId: run.id,
        triggerKey,
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
        metadata: { contactId, trigger, triggerKey },
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

      await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.NO_PURCHASE_DAYS, {
        triggerKey: `no-purchase:${days}`,
        metadata: { days },
      });
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
        await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.ABANDONED_CHECKOUT, {
          triggerKey: `abandoned:${event.orderId || event.id}`,
          metadata: { orderId: event.orderId },
        });
      }

      await prisma.marketingCheckoutEvent.update({
        where: { id: event.id },
        data: { status: 'COMPLETED' },
      });
    }
  }
}

export async function processShowDateAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const config = (automation.triggerConfig || {}) as { daysBefore?: number };
    const daysBefore = Number(config.daysBefore || 3);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const target = new Date(start);
    target.setDate(target.getDate() + daysBefore);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const shows = await prisma.show.findMany({
      where: { organiserId: automation.tenantId, date: { gte: target, lte: end }, status: 'LIVE' },
      select: { id: true, title: true, date: true },
    });

    if (!shows.length) continue;

    const contacts = await prisma.marketingContact.findMany({
      where: { tenantId: automation.tenantId },
      select: { id: true },
    });

    for (const show of shows) {
      for (const contact of contacts) {
        await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.DAYS_BEFORE_SHOW, {
          triggerKey: `show:${show.id}:${daysBefore}`,
          metadata: { showId: show.id, showDate: show.date, daysBefore },
        });
      }
    }
  }
}

export async function processBirthdayAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.BIRTHDAY, isEnabled: true },
    include: { steps: true },
  });
  if (!automations.length) return;
  const today = new Date();
  const month = today.getUTCMonth();
  const date = today.getUTCDate();

  for (const automation of automations) {
    const contacts = await prisma.marketingContact.findMany({
      where: { tenantId: automation.tenantId, birthdayDate: { not: null } },
      select: { id: true, birthdayDate: true },
    });
    for (const contact of contacts) {
      const birthday = contact.birthdayDate;
      if (!birthday) continue;
      if (birthday.getUTCMonth() !== month || birthday.getUTCDate() !== date) continue;
      await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.BIRTHDAY, {
        triggerKey: `birthday:${month + 1}-${date}`,
      });
    }
  }
}

export async function processAnniversaryAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.ANNIVERSARY, isEnabled: true },
    include: { steps: true },
  });
  if (!automations.length) return;
  const today = new Date();
  const month = today.getUTCMonth();
  const date = today.getUTCDate();

  for (const automation of automations) {
    const contacts = await prisma.marketingContact.findMany({
      where: { tenantId: automation.tenantId, anniversaryDate: { not: null } },
      select: { id: true, anniversaryDate: true },
    });
    for (const contact of contacts) {
      const anniversary = contact.anniversaryDate;
      if (!anniversary) continue;
      if (anniversary.getUTCMonth() !== month || anniversary.getUTCDate() !== date) continue;
      await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.ANNIVERSARY, {
        triggerKey: `anniversary:${month + 1}-${date}`,
      });
    }
  }
}

export async function processViewedNoPurchaseAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { triggerType: MarketingAutomationTriggerType.VIEWED_NO_PURCHASE, isEnabled: true },
    include: { steps: true },
  });

  for (const automation of automations) {
    const config = (automation.triggerConfig || {}) as { days?: number };
    const days = Number(config.days || 7);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const views = await prisma.customerShowView.findMany({
      where: { createdAt: { gte: cutoff }, show: { organiserId: automation.tenantId } },
      select: {
        createdAt: true,
        customerAccount: { select: { email: true } },
      },
    });

    const viewsByEmail = new Map<string, Date>();
    for (const view of views) {
      const email = String(view.customerAccount?.email || '').toLowerCase();
      if (!email) continue;
      const prev = viewsByEmail.get(email);
      if (!prev || view.createdAt > prev) {
        viewsByEmail.set(email, view.createdAt);
      }
    }

    for (const [email, viewedAt] of viewsByEmail.entries()) {
      const contact = await prisma.marketingContact.findUnique({
        where: { tenantId_email: { tenantId: automation.tenantId, email } },
        select: { id: true },
      });
      if (!contact) continue;

      const order = await prisma.order.findFirst({
        where: { status: 'PAID', email, show: { organiserId: automation.tenantId }, createdAt: { gte: viewedAt } },
        select: { id: true },
      });
      if (order) continue;

      await enqueueAutomationForContact(automation.tenantId, contact.id, MarketingAutomationTriggerType.VIEWED_NO_PURCHASE, {
        triggerKey: `viewed:${viewedAt.toISOString().slice(0, 10)}`,
        metadata: { viewedAt },
      });
    }
  }
}

export async function processShowCreatedAutomation(tenantId: string, showId: string, trigger: MarketingAutomationTriggerType) {
  const automations = await prisma.marketingAutomation.findMany({
    where: { tenantId, triggerType: trigger, isEnabled: true },
  });
  if (!automations.length) return;
  const contacts = await prisma.marketingContact.findMany({
    where: { tenantId },
    select: { id: true },
  });
  for (const contact of contacts) {
    await enqueueAutomationForContact(tenantId, contact.id, trigger, {
      triggerKey: `show:${showId}`,
      metadata: { showId },
    });
  }
}

export async function triggerTagAppliedAutomation(tenantId: string, contactId: string, tagName: string) {
  await enqueueAutomationForContact(tenantId, contactId, MarketingAutomationTriggerType.TAG_APPLIED, {
    triggerKey: `tag:${tagName}`,
    metadata: { tag: tagName },
  });
}

type SegmentContext = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  consentStatus: string | null;
  tags: string[];
  preferences: Array<{ topicId: string; status: string }>;
};

async function resolveSegmentContext(tenantId: string, contactId: string) {
  const contact = await prisma.marketingContact.findUnique({
    where: { id: contactId },
    include: { tags: { include: { tag: true } }, consents: true, preferences: true },
  });
  if (!contact) return null;
  const context: SegmentContext = {
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    consentStatus: contact.consents[0]?.status || null,
    tags: contact.tags.map((t) => t.tag.name),
    preferences: contact.preferences.map((pref) => ({
      topicId: pref.topicId,
      status: String(pref.status || ''),
    })),
  };

  return context;
}

async function resolveSegmentStats(tenantId: string, email: string, rules: SegmentRule[]) {
  const needsInsightData = rules.some((rule) =>
    [
      'LAST_PURCHASE_OLDER_THAN',
      'PURCHASE_COUNT_90D_AT_LEAST',
      'MONETARY_TIER',
      'AVG_TICKETS_PER_ORDER_AT_LEAST',
      'FAVOURITE_VENUE_ID',
      'FAVOURITE_CATEGORY_CONTAINS',
      'FAVOURITE_EVENT_TYPE_CONTAINS',
      'VIEWED_NO_PURCHASE_AFTER',
      'LIFECYCLE_STAGE',
    ].includes(rule.type)
  );

  const needsOrderData = rules.some((rule) =>
    [
      'LAST_PURCHASE_OLDER_THAN',
      'PURCHASED_CATEGORY_CONTAINS',
      'TOTAL_SPENT_AT_LEAST',
      'ATTENDED_VENUE',
      'PURCHASED_AT_VENUE',
      'VIEWED_NO_PURCHASE_AFTER',
    ].includes(rule.type)
  );

  const needsViewData = rules.some((rule) => rule.type === 'VIEWED_NO_PURCHASE_AFTER');

  const insight = needsInsightData
    ? await prisma.customerInsight.findFirst({ where: { tenantId, email: email.toLowerCase() } })
    : null;

  const orderStats = needsOrderData
    ? await prisma.order.findMany({
        where: { status: 'PAID', email, show: { organiserId: tenantId } },
        select: {
          email: true,
          amountPence: true,
          createdAt: true,
          show: { select: { eventCategory: true, eventType: true, tags: true, venueId: true } },
        },
      })
    : [];

  const viewStats = needsViewData
    ? await prisma.customerShowView.findMany({
        where: { show: { organiserId: tenantId }, customerAccount: { email } },
        select: { createdAt: true },
      })
    : [];

  const stats = {
    lastPurchase: null as Date | null,
    totalSpentPence: 0,
    totalSpent90dPence: 0,
    purchaseCount: 0,
    purchaseCount90d: 0,
    categories: new Set<string>(),
    venues: new Set<string>(),
    eventTypes: new Set<string>(),
  };

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const order of orderStats) {
    stats.purchaseCount += 1;
    stats.totalSpentPence += order.amountPence || 0;
    if (order.createdAt > ninetyDaysAgo) {
      stats.purchaseCount90d += 1;
      stats.totalSpent90dPence += order.amountPence || 0;
    }
    if (!stats.lastPurchase || order.createdAt > stats.lastPurchase) {
      stats.lastPurchase = order.createdAt;
    }
    if (order.show?.eventCategory) stats.categories.add(order.show.eventCategory);
    if (order.show?.eventType) stats.eventTypes.add(order.show.eventType);
    if (order.show?.venueId) stats.venues.add(order.show.venueId);
    (order.show?.tags || []).forEach((tag) => stats.categories.add(tag));
  }

  const insights = insight
    ? {
        firstPurchaseAt: insight.firstPurchaseAt,
        lastPurchaseAt: insight.lastPurchaseAt,
        purchaseCount: insight.purchaseCount,
        purchaseCount90d: insight.purchaseCount90d,
        avgTicketsPerOrder: insight.avgTicketsPerOrder,
        monetaryValueLifetimePence: insight.monetaryValueLifetimePence,
        monetaryValue90dPence: insight.monetaryValue90dPence,
        favouriteVenueId: insight.favouriteVenueId,
        topVenueIds: insight.topVenueIds,
        favouriteCategory: insight.favouriteCategory,
        favouriteEventType: insight.favouriteEventType,
      }
    : null;

  const viewInsight = viewStats.reduce((acc, view) => {
    if (!acc.lastViewAt || view.createdAt > acc.lastViewAt) {
      acc.lastViewAt = view.createdAt;
    }
    return acc;
  }, { lastViewAt: null as Date | null });

  return { stats, insight: insights, views: viewInsight };
}

function parseSegmentRules(input: unknown): SegmentRule[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as SegmentRule[];
  if (typeof input === 'object') {
    const anyInput = input as { rules?: SegmentRule[]; all?: SegmentRule[] };
    if (Array.isArray(anyInput.rules)) return anyInput.rules as SegmentRule[];
    if (Array.isArray(anyInput.all)) return anyInput.all as SegmentRule[];
  }
  return [];
}

function resolveQuietHoursDelay(step: { quietHoursStart?: number | null; quietHoursEnd?: number | null }) {
  const start = step.quietHoursStart;
  const end = step.quietHoursEnd;
  if (start === null || start === undefined || end === null || end === undefined) return null;
  const now = new Date();
  const hour = now.getUTCHours();
  const isQuiet = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  if (!isQuiet) return null;
  const next = new Date(now);
  if (start < end) {
    next.setUTCHours(end, 0, 0, 0);
  } else {
    if (hour >= start) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(end, 0, 0, 0);
    } else {
      next.setUTCHours(end, 0, 0, 0);
    }
  }
  return next;
}

async function resolveStepThrottle(stepId: string, tenantId: string, throttleMinutes: number) {
  if (!throttleMinutes || throttleMinutes <= 0) return null;
  const last = await prisma.marketingAutomationStepExecution.findFirst({
    where: {
      tenantId,
      stepId,
      status: MarketingAutomationStepStatus.SENT,
    },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  });
  if (!last?.sentAt) return null;
  const nextAllowed = new Date(last.sentAt.getTime() + throttleMinutes * 60 * 1000);
  return nextAllowed > new Date() ? nextAllowed : null;
}

async function addTagToContact(tenantId: string, contactId: string, tagName: string) {
  const name = String(tagName || '').trim();
  if (!name) return;
  const tag = await prisma.marketingTag.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { tenantId, name },
  });
  await prisma.marketingContactTag.upsert({
    where: { contactId_tagId: { contactId, tagId: tag.id } },
    create: { tenantId, contactId, tagId: tag.id },
    update: {},
  });
  await triggerTagAppliedAutomation(tenantId, contactId, name);
}

async function updatePreferenceForContact(
  tenantId: string,
  contactId: string,
  topicId: string,
  status: MarketingPreferenceStatus
) {
  if (!topicId) return;
  await prisma.marketingContactPreference.upsert({
    where: { tenantId_contactId_topicId: { tenantId, contactId, topicId } },
    create: { tenantId, contactId, topicId, status },
    update: { status },
  });
}

async function sendOrganiserNotification(tenantId: string, subject: string, body: string) {
  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { email: true, tradingName: true, companyName: true, name: true },
  });
  if (!tenant?.email) return;
  const settings = await fetchMarketingSettings(tenantId);
  const provider = getEmailProvider(settings);
  await provider.sendEmail({
    to: tenant.email,
    subject: subject || `Automation alert from ${tenantNameFrom(tenant)}`,
    html: body || `<p>An automation step executed for ${tenantNameFrom(tenant)}.</p>`,
    fromName: tenantNameFrom(tenant),
    fromEmail: applyMarketingStreamToEmail(settings.fromEmail || tenant.email, settings),
  });
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
      if (state.runId) {
        await prisma.marketingAutomationRun.update({
          where: { id: state.runId },
          data: { status: MarketingAutomationStateStatus.COMPLETED, completedAt: new Date(), lastStep: state.currentStep },
        });
      }
      continue;
    }

    const existingExecution = await prisma.marketingAutomationStepExecution.findUnique({
      where: {
        tenantId_contactId_stepId_triggerKey: {
          tenantId: state.tenantId,
          contactId: state.contactId,
          stepId: nextStep.id,
          triggerKey: state.triggerKey,
        },
      },
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

    const throttleDelay = await resolveStepThrottle(nextStep.id, state.tenantId, nextStep.throttleMinutes || 0);
    if (throttleDelay) {
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: { nextRunAt: throttleDelay },
      });
      continue;
    }

    const quietDelay = resolveQuietHoursDelay(nextStep);
    if (quietDelay) {
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: { nextRunAt: quietDelay },
      });
      continue;
    }

    const rules = parseSegmentRules(nextStep.conditionRules);
    if (rules.length) {
      const context = await resolveSegmentContext(state.tenantId, state.contactId);
      if (!context) continue;
      const stats = await resolveSegmentStats(state.tenantId, context.email, rules);
      const matches = matchesSegmentRules(context, rules, stats.stats, stats.insight, stats.views);
      if (!matches) {
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
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
    }

    let stateOverride: { currentStep: number; nextRunAt: Date | null; status: MarketingAutomationStateStatus } | null =
      null;
    try {
      if (nextStep.stepType === MarketingAutomationStepType.WAIT) {
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
            status: MarketingAutomationStepStatus.SENT,
            sentAt: new Date(),
            metadata: { note: 'wait' },
          },
          update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
        });
        const waitUntil = new Date(Date.now() + Math.max(0, nextStep.delayMinutes || 0) * 60 * 1000);
        stateOverride = {
          currentStep: nextStep.stepOrder,
          nextRunAt: waitUntil,
          status: MarketingAutomationStateStatus.ACTIVE,
        };
      } else if (nextStep.stepType === MarketingAutomationStepType.BRANCH) {
        const config = (nextStep.stepConfig || {}) as {
          ifRules?: SegmentRule[];
          ifStepOrder?: number;
          elseStepOrder?: number;
        };
        const branchRules = parseSegmentRules(config.ifRules);
        let matched = false;
        if (branchRules.length) {
          const context = await resolveSegmentContext(state.tenantId, state.contactId);
          if (!context) throw new Error('Contact not found');
          const stats = await resolveSegmentStats(state.tenantId, context.email, branchRules);
          matched = matchesSegmentRules(context, branchRules, stats.stats, stats.insight, stats.views);
        }
        const nextOrder = matched ? Number(config.ifStepOrder) : Number(config.elseStepOrder);
        if (nextOrder && Number.isFinite(nextOrder)) {
          stateOverride = {
            currentStep: nextOrder - 1,
            nextRunAt: new Date(),
            status: MarketingAutomationStateStatus.ACTIVE,
          };
        }
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
            status: MarketingAutomationStepStatus.SENT,
            sentAt: new Date(),
            metadata: { matched, nextOrder },
          },
          update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
        });
      } else if (nextStep.stepType === MarketingAutomationStepType.ADD_TAG) {
        const config = (nextStep.stepConfig || {}) as { tag?: string };
        await addTagToContact(state.tenantId, state.contactId, config.tag || '');
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
            status: MarketingAutomationStepStatus.SENT,
            sentAt: new Date(),
            metadata: { tag: config.tag || '' },
          },
          update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
        });
      } else if (nextStep.stepType === MarketingAutomationStepType.UPDATE_PREFERENCE) {
        const config = (nextStep.stepConfig || {}) as { topicId?: string; status?: MarketingPreferenceStatus };
        await updatePreferenceForContact(
          state.tenantId,
          state.contactId,
          config.topicId || '',
          (config.status as MarketingPreferenceStatus) || MarketingPreferenceStatus.SUBSCRIBED
        );
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
            status: MarketingAutomationStepStatus.SENT,
            sentAt: new Date(),
            metadata: { topicId: config.topicId || '', status: config.status || 'SUBSCRIBED' },
          },
          update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
        });
      } else if (nextStep.stepType === MarketingAutomationStepType.NOTIFY_ORGANISER) {
        const config = (nextStep.stepConfig || {}) as { subject?: string; body?: string };
        await sendOrganiserNotification(state.tenantId, config.subject || '', config.body || '');
        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
            status: MarketingAutomationStepStatus.SENT,
            sentAt: new Date(),
            metadata: { notified: true },
          },
          update: { status: MarketingAutomationStepStatus.SENT, sentAt: new Date(), errorText: null },
        });
      } else {
        const canSend = await shouldSendAutomationEmail(state.tenantId, state.contactId, state.contact.email);
        if (!canSend) {
          await prisma.marketingAutomationStepExecution.upsert({
            where: {
              tenantId_contactId_stepId_triggerKey: {
                tenantId: state.tenantId,
                contactId: state.contactId,
                stepId: nextStep.id,
                triggerKey: state.triggerKey,
              },
            },
            create: {
              tenantId: state.tenantId,
              automationId: state.automationId,
              stepId: nextStep.id,
              contactId: state.contactId,
              triggerKey: state.triggerKey,
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

        if (!nextStep.template) {
          throw new Error('Template required for send email step.');
        }

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
        assertSenderVerified({ fromEmail: sender.fromEmail, settings, requireVerifiedFrom });

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

        const provider = getEmailProvider(settings);
        const listUnsubscribeMail = buildListUnsubscribeMail(sender.fromEmail) || undefined;
        const result = await provider.sendEmail({
          to: state.contact.email,
          subject: nextStep.template.subject,
          html,
          fromName: sender.fromName,
          fromEmail: applyMarketingStreamToEmail(sender.fromEmail, settings),
          replyTo: sender.replyTo,
          headers: {
            'List-Unsubscribe': [listUnsubscribeMail, `<${unsubscribeUrl}>`].filter(Boolean).join(', '),
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          customArgs: {
            automationId: state.automationId,
            tenantId: state.tenantId,
            contactId: state.contactId,
          },
        });

        console.info('[marketing:automation:send]', {
          automationId: state.automationId,
          stateId: state.id,
          providerId: result.id,
          providerStatus: result.status,
          providerResponse: result.response || null,
        });

        await prisma.marketingWorkerState.upsert({
          where: { id: 'global' },
          update: { lastSendAt: new Date() },
          create: { id: 'global', lastSendAt: new Date(), lastWorkerRunAt: null },
        });

        await prisma.marketingAutomationStepExecution.upsert({
          where: {
            tenantId_contactId_stepId_triggerKey: {
              tenantId: state.tenantId,
              contactId: state.contactId,
              stepId: nextStep.id,
              triggerKey: state.triggerKey,
            },
          },
          create: {
            tenantId: state.tenantId,
            automationId: state.automationId,
            stepId: nextStep.id,
            contactId: state.contactId,
            triggerKey: state.triggerKey,
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
      }
    } catch (error: any) {
      await prisma.marketingAutomationStepExecution.upsert({
        where: {
          tenantId_contactId_stepId_triggerKey: {
            tenantId: state.tenantId,
            contactId: state.contactId,
            stepId: nextStep.id,
            triggerKey: state.triggerKey,
          },
        },
        create: {
          tenantId: state.tenantId,
          automationId: state.automationId,
          stepId: nextStep.id,
          contactId: state.contactId,
          triggerKey: state.triggerKey,
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
      if (state.runId) {
        await prisma.marketingAutomationRun.update({
          where: { id: state.runId },
          data: { status: MarketingAutomationStateStatus.STOPPED, lastStep: state.currentStep },
        });
      }
      continue;
    }

    if (stateOverride) {
      await prisma.marketingAutomationState.update({
        where: { id: state.id },
        data: {
          currentStep: stateOverride.currentStep,
          nextRunAt: stateOverride.nextRunAt,
          status: stateOverride.status,
        },
      });
      if (state.runId) {
        await prisma.marketingAutomationRun.update({
          where: { id: state.runId },
          data: {
            lastStep: stateOverride.currentStep,
            status: stateOverride.status,
            completedAt: stateOverride.status === MarketingAutomationStateStatus.COMPLETED ? new Date() : null,
          },
        });
      }
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
    if (state.runId) {
      await prisma.marketingAutomationRun.update({
        where: { id: state.runId },
        data: {
          lastStep: nextStep.stepOrder,
          status: nextRunAt ? MarketingAutomationStateStatus.ACTIVE : MarketingAutomationStateStatus.COMPLETED,
          completedAt: nextRunAt ? null : new Date(),
        },
      });
    }
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
    const existing = await prisma.marketingContactPreference.findUnique({
      where: {
        tenantId_contactId_topicId: {
          tenantId: options.tenantId,
          contactId: options.contactId,
          topicId: topic.topicId,
        },
      },
    });
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
    if (!existing || existing.status !== topic.status) {
      await enqueueAutomationForContact(
        options.tenantId,
        options.contactId,
        MarketingAutomationTriggerType.PREFERENCE_TOPIC,
        {
          triggerKey: `pref:${topic.topicId}:${topic.status}`,
          metadata: { topicId: topic.topicId, status: topic.status },
        }
      );
    }
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
