import crypto from 'crypto';
import {
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingConsentStatus,
  MarketingIntelligentCampaignKind,
  MarketingRecipientStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { renderMarketingTemplate } from '../../../lib/email-marketing/rendering.js';
import { createUnsubscribeToken } from '../../../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../../../lib/email-marketing/preferences.js';
import { buildDefaultMergeContext, renderMergeTags } from '../../../lib/email-marketing/merge-tags.js';
import { renderCompiledTemplate } from '../template-compiler.js';
import { buildRecommendedShowsHtml as buildIntelligentShowsHtml } from './blocks.js';
import { countIntelligentSendsLast30d, hasEmailedShowRecently } from './eligibility.js';
import { getTenantUpcomingShows, rankShowsForContact } from './recommendations.js';
import { hasPurchasedShow } from './suppression.js';
import { shouldSuppressContact } from '../campaigns.js';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const FULL_DAY_MINUTES = 24 * 60;

type IntelligentRunSample = { email: string; reasons: string[]; topShows: string[] };

type IntelligentRunFailure = {
  ok: false;
  runId: string;
  status: number;
  message: string;
};

type IntelligentRunSuccess = {
  ok: true;
  runId: string;
  campaignId: string | null;
  eligibleCount: number;
  suppressedCount: number;
  capBlockedCount: number;
  sampleRecipients: IntelligentRunSample[];
  skippedReason?: string;
};

export type IntelligentRunResult = IntelligentRunFailure | IntelligentRunSuccess;

export function resolveIntelligentConfig(configJson: Prisma.JsonValue | null | undefined) {
  const fallback = { horizonDays: 90, limit: 6, cooldownDays: 30, maxEmailsPer30DaysPerContact: 3 };
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return fallback;
  }
  const config = configJson as Record<string, any>;
  const horizonDaysRaw = config.recommendationHorizonDays ?? config.horizonDays ?? config.lookaheadDays;
  const limitRaw = config.recommendationLimit ?? config.limit ?? config.maxRecommendations;
  const cooldownDaysRaw = config.showCooldownDays ?? config.cooldownDays ?? config.recommendationCooldownDays;
  const maxEmailsRaw = config.maxEmailsPer30DaysPerContact;
  const horizonDays = Number.isFinite(Number(horizonDaysRaw)) ? Math.max(1, Number(horizonDaysRaw)) : fallback.horizonDays;
  const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Number(limitRaw)) : fallback.limit;
  const cooldownDays = Number.isFinite(Number(cooldownDaysRaw))
    ? Math.max(0, Number(cooldownDaysRaw))
    : fallback.cooldownDays;
  const maxEmailsPer30DaysPerContact = Number.isFinite(Number(maxEmailsRaw))
    ? Math.max(0, Number(maxEmailsRaw))
    : fallback.maxEmailsPer30DaysPerContact;
  return { horizonDays, limit, cooldownDays, maxEmailsPer30DaysPerContact };
}

export function isWithinIntelligentSendWindow(configJson: Prisma.JsonValue | null | undefined, now: Date) {
  const window = resolveSendWindow(configJson);
  if (!window) return true;
  if (window.startMinutes === window.endMinutes) return true;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (window.startMinutes < window.endMinutes) {
    return minutesNow >= window.startMinutes && minutesNow <= window.endMinutes;
  }
  return minutesNow >= window.startMinutes || minutesNow <= window.endMinutes;
}

export async function runIntelligentCampaign(options: {
  tenantId: string;
  kind: MarketingIntelligentCampaignKind;
  dryRun?: boolean;
  actorUserId?: string | null;
  actorEmail?: string | null;
  runAt?: Date;
}): Promise<IntelligentRunResult> {
  const runId = crypto.randomUUID();
  const dryRun = options.dryRun ?? true;
  const runAt = options.runAt ?? new Date();
  const { tenantId, kind } = options;

  const config = await prisma.marketingIntelligentCampaign.findFirst({
    where: { tenantId, kind },
    include: { template: true },
  });
  if (!config || !config.template) {
    return { ok: false, runId, status: 404, message: 'Intelligent campaign not configured.' };
  }

  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) {
    return { ok: false, runId, status: 404, message: 'Tenant not found' };
  }

  const runDateLabel = runAt.toISOString().slice(0, 10);
  const runMonthLabel = runDateLabel.slice(0, 7);
  const campaignName = `IC: ${kind} ${runDateLabel}`;

  if (!dryRun && kind === MarketingIntelligentCampaignKind.MONTHLY_DIGEST) {
    const existing = await prisma.marketingCampaign.findFirst({
      where: {
        tenantId,
        name: {
          startsWith: `IC: ${kind} ${runMonthLabel}`,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: true,
        runId,
        campaignId: existing.id,
        eligibleCount: 0,
        suppressedCount: 0,
        capBlockedCount: 0,
        sampleRecipients: [],
        skippedReason: 'monthly_digest_exists',
      };
    }
  }

  const contacts = await prisma.marketingContact.findMany({
    where: { tenantId },
    include: { consents: { orderBy: { capturedAt: 'desc' } } },
  });
  const suppressions = await prisma.marketingSuppression.findMany({
    where: { tenantId },
    select: { email: true, type: true },
  });
  const suppressionMap = new Map(suppressions.map((suppression) => [normaliseEmail(suppression.email), suppression]));

  const configOptions = resolveIntelligentConfig(config.configJson);
  const maxEmailsPer30DaysPerContact = configOptions.maxEmailsPer30DaysPerContact;
  const upcomingShows = await getTenantUpcomingShows(tenantId, configOptions.horizonDays);

  let eligibleCount = 0;
  let suppressedCount = 0;
  let capBlockedCount = 0;
  const sampleRecipients: IntelligentRunSample[] = [];
  const recipientsToCreate: Array<{
    tenantId: string;
    campaignId: string;
    contactId: string;
    email: string;
    status: MarketingRecipientStatus;
  }> = [];
  const snapshotsToCreate: Array<{
    tenantId: string;
    campaignId: string;
    templateId: string;
    recipientEmail: string;
    renderedHtml: string;
    renderedText: string | null;
    mergeContext: Prisma.InputJsonValue;
  }> = [];

  let campaignId: string | null = null;

  if (!dryRun) {
    const existingAllContacts = await prisma.marketingSegment.findFirst({
      where: {
        tenantId,
        name: { equals: 'All contacts', mode: 'insensitive' },
      },
    });
    let segment = existingAllContacts;
    if (!segment) {
      segment = await prisma.marketingSegment.findFirst({
        where: { tenantId, name: 'System: Intelligent Campaigns' },
      });
    }
    if (!segment) {
      segment = await prisma.marketingSegment.create({
        data: {
          tenantId,
          name: 'System: Intelligent Campaigns',
          description: 'System segment for intelligent campaign runs.',
          rules: { rules: [] },
        },
      });
    }

    const created = await prisma.marketingCampaign.create({
      data: {
        tenantId,
        name: campaignName,
        templateId: config.templateId,
        segmentId: segment.id,
        type: MarketingCampaignType.ONE_OFF,
        status: MarketingCampaignStatus.SCHEDULED,
        scheduledFor: runAt,
        scheduledByUserId: options.actorUserId ?? null,
        createdByUserId: options.actorUserId || tenantId,
      },
    });
    campaignId = created.id;
  }

  for (const contact of contacts) {
    const email = normaliseEmail(contact.email || '');
    if (!email) continue;

    const reasons = new Set<string>();
    const suppression = suppressionMap.get(email) || null;
    const consentStatus = (contact.consents[0]?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
    const suppressionDecision = shouldSuppressContact(consentStatus, suppression);
    if (suppressionDecision.suppressed && suppressionDecision.reason) {
      reasons.add(suppressionDecision.reason);
    }

    if (suppressionDecision.suppressed) {
      suppressedCount += 1;
      if (sampleRecipients.length < 20) {
        sampleRecipients.push({ email, reasons: Array.from(reasons), topShows: [] });
      }
      continue;
    }

    let recommendedShows = await rankShowsForContact({ tenantId, email }, upcomingShows, { limit: configOptions.limit });
    if (recommendedShows.length) {
      const purchaseChecks = await Promise.all(
        recommendedShows.map(async (show) => ({
          show,
          purchased: await hasPurchasedShow(tenantId, email, show.showId),
        }))
      );
      recommendedShows = purchaseChecks.filter((entry) => !entry.purchased).map((entry) => entry.show);
    }

    if (!recommendedShows.length) {
      capBlockedCount += 1;
      reasons.add('no_recommendations');
      if (sampleRecipients.length < 20) {
        sampleRecipients.push({ email, reasons: Array.from(reasons), topShows: [] });
      }
      continue;
    }

    const sendCap = await countIntelligentSendsLast30d(tenantId, email, maxEmailsPer30DaysPerContact);
    sendCap.reasons.forEach((reason) => reasons.add(reason));

    const topShowId = recommendedShows[0]?.showId;
    if (topShowId) {
      const recentEligibility = await hasEmailedShowRecently(tenantId, email, topShowId, configOptions.cooldownDays);
      recentEligibility.reasons.forEach((reason) => reasons.add(reason));
    }

    if (!sendCap.eligible || reasons.size > 0) {
      capBlockedCount += 1;
      if (sampleRecipients.length < 20) {
        sampleRecipients.push({
          email,
          reasons: Array.from(reasons),
          topShows: recommendedShows.slice(0, 3).map((show) => show.title || show.showId),
        });
      }
      continue;
    }

    const token = createUnsubscribeToken({ tenantId, email });
    const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
      tenant.storefrontSlug || tenant.id
    )}/${encodeURIComponent(token)}`;
    const preferencesToken = createPreferencesToken({ tenantId, email });
    const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
      tenant.storefrontSlug || tenant.id
    )}/${encodeURIComponent(preferencesToken)}`;

    const recommendedShowsPayload = recommendedShows.map((show) => ({
      title: show.title,
      date: show.date,
      venueName: show.venueName,
      town: show.town,
      county: show.county,
      bookingUrl: show.bookingUrl,
      imageUrl: show.imageUrl,
      reason: show.reason,
      showId: show.showId,
    }));
    const showIds = recommendedShows.map((show) => show.showId).filter(Boolean);
    const recommendedShowsHtml = buildIntelligentShowsHtml(recommendedShowsPayload);

    const mergeContext = {
      ...buildTemplateMergeContext({
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email,
          town: contact.town,
        },
        links: {
          managePreferencesLink: preferencesUrl,
          unsubscribeLink: unsubscribeUrl,
        },
      }),
      recommendedShows: recommendedShowsPayload,
      recommendedShowsHtml,
      meta: {
        kind,
        reasons: Array.from(reasons),
        showIds,
      },
    };

    let renderedHtml = '';
    if (config.template.compiledHtml) {
      renderedHtml = renderCompiledTemplate({
        compiledHtml: config.template.compiledHtml,
        mergeContext,
        unsubscribeUrl,
        preferencesUrl,
        recommendedShows: recommendedShowsHtml,
      });
      if (config.template.compiledText) {
        renderMergeTags(config.template.compiledText, mergeContext);
      }
    } else {
      const rendered = renderMarketingTemplate(config.template.mjmlBody, {
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email,
        tenantName: tenantNameFrom(tenant),
        unsubscribeUrl,
        preferencesUrl,
        recommendedShows: recommendedShowsHtml,
      });
      renderedHtml = rendered.html;
    }

    eligibleCount += 1;
    if (sampleRecipients.length < 20) {
      sampleRecipients.push({
        email,
        reasons: Array.from(reasons),
        topShows: recommendedShows.slice(0, 3).map((show) => show.title || show.showId),
      });
    }

    if (!dryRun && campaignId) {
      recipientsToCreate.push({
        tenantId,
        campaignId,
        contactId: contact.id,
        email,
        status: MarketingRecipientStatus.PENDING,
      });
      snapshotsToCreate.push({
        tenantId,
        campaignId,
        templateId: config.templateId,
        recipientEmail: email,
        renderedHtml,
        renderedText: null,
        mergeContext: mergeContext as Prisma.InputJsonValue,
      });
    }
  }

  if (!dryRun && campaignId) {
    if (recipientsToCreate.length) {
      await prisma.marketingCampaignRecipient.createMany({
        data: recipientsToCreate,
        skipDuplicates: true,
      });
    }
    if (snapshotsToCreate.length) {
      await prisma.marketingSendSnapshot.createMany({
        data: snapshotsToCreate,
      });
    }
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { recipientsPreparedAt: runAt },
    });
  }

  return {
    ok: true,
    runId,
    campaignId,
    eligibleCount,
    suppressedCount,
    capBlockedCount,
    sampleRecipients,
  };
}

function normaliseEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function resolveSendWindow(configJson: Prisma.JsonValue | null | undefined) {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return null;
  }
  const config = configJson as Record<string, any>;
  const windowConfig = config.sendWindow ?? config.sendWindowLocal ?? config.window ?? {};
  const startValue =
    windowConfig.start ??
    windowConfig.startTime ??
    windowConfig.startHour ??
    config.sendWindowStart ??
    config.sendWindowStartTime ??
    config.sendWindowStartHour;
  const endValue =
    windowConfig.end ??
    windowConfig.endTime ??
    windowConfig.endHour ??
    config.sendWindowEnd ??
    config.sendWindowEndTime ??
    config.sendWindowEndHour;
  const startMinutes = parseWindowMinutes(startValue);
  const endMinutes = parseWindowMinutes(endValue);
  if (startMinutes === null || endMinutes === null) return null;
  return { startMinutes, endMinutes };
}

function parseWindowMinutes(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value <= 24) return Math.round(value * 60);
    if (value >= 0 && value < FULL_DAY_MINUTES) return Math.round(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatShowDate(date?: Date | string | null) {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildTemplateMergeContext(options: {
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    town?: string | null;
    county?: string | null;
    tags?: string[] | null;
  };
  show?: {
    title?: string | null;
    venue?: string | null;
    date?: Date | string | null;
    time?: string | null;
    priceFrom?: number | string | null;
    image?: string | null;
  };
  links?: { ticketLink?: string | null; managePreferencesLink?: string | null; unsubscribeLink?: string | null };
}) {
  const showDate =
    options.show?.date ? (typeof options.show.date === 'string' ? options.show.date : formatShowDate(options.show.date)) : null;
  return buildDefaultMergeContext({
    contact: options.contact,
    show: {
      title: options.show?.title || null,
      venue: options.show?.venue || null,
      date: showDate,
      time: options.show?.time || null,
      priceFrom: options.show?.priceFrom || null,
      image: options.show?.image || null,
    },
    links: options.links,
  });
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}
