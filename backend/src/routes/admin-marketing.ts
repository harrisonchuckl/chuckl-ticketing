import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';
import { isOwnerEmail } from '../lib/owner-authz.js';
import { requireMarketingStepUp, setMarketingStepUpCookie } from '../lib/marketing-stepup.js';
import { requireAuth } from '../middleware/requireAuth.js';
import * as bcryptNS from 'bcryptjs';
import { renderMarketingTemplate } from '../lib/email-marketing/rendering.js';
import { getEmailProvider } from '../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../lib/email-marketing/preferences.js';
import { encryptToken } from '../lib/token-crypto.js';
import { buildDefaultMergeContext, renderMergeTags } from '../lib/email-marketing/merge-tags.js';
import {
  MarketingAutomationStepType,
  MarketingAutomationTriggerType,
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingConsentSource,
  MarketingConsentStatus,
  MarketingLawfulBasis,
  MarketingPreferenceStatus,
  MarketingSuppressionType,
  MarketingImportJobStatus,
  MarketingIntelligentCampaignKind,
  MarketingCampaignRecipient,
  MarketingRecipientStatus,
  MarketingSenderMode,
  MarketingGovernanceRole,
  MarketingTemplateChangeStatus,
  MarketingVerifiedStatus,
  OrderStatus,
  MarketingEmailEventType,
  Prisma,
  ShowStatus,
} from '@prisma/client';
import { evaluateSegmentContacts, SegmentRule } from '../services/marketing/segments.js';
import {
  applySuppression,
  clearSuppression,
  ensureDailyLimit,
  estimateCampaignRecipients,
  shouldSuppressContact,
} from '../services/marketing/campaigns.js';
import {
  fetchMarketingSettings,
  applyMarketingStreamToEmail,
  assertSenderVerified,
  buildListUnsubscribeMail,
  resolveRequireVerifiedFrom,
  resolveSenderDetails,
} from '../services/marketing/settings.js';
import { queryCustomerInsights } from '../services/customer-insights.js';
import {
  fetchCampaignDeliverability,
  fetchDeliverabilitySummary,
  fetchTopSegmentsByEngagement,
  recordAutomationAudit,
  recordDeliverabilityAudit,
  recordPreferenceAudit,
  warmupPresets,
} from '../services/marketing/automations.js';
import { triggerTagAppliedAutomation } from '../services/marketing/automations.js';
import { ensureDefaultPreferenceTopics } from '../services/marketing/preferences.js';
import { recordConsentAudit, recordSuppressionAudit } from '../services/marketing/audit.js';
import { renderEmailDocument } from '../lib/email-builder/rendering.js';
import { buildPreviewPersonalisationContext } from '../services/marketing/personalisation.js';
import { compileEditorHtml, renderCompiledTemplate } from '../services/marketing/template-compiler.js';
import { buildStepsFromFlow, validateFlow } from '../services/marketing/flow.js';
import { sendMarketingSuiteShell } from '../lib/marketing-suite-shell.js';
import { buildRecommendedShowsHtml as buildIntelligentShowsHtml } from '../services/marketing/intelligent/blocks.js';
import { countIntelligentSendsLast30d, hasEmailedShowRecently } from '../services/marketing/intelligent/eligibility.js';
import { getTenantUpcomingShows, rankShowsForContact } from '../services/marketing/intelligent/recommendations.js';
import { hasPurchasedShow } from '../services/marketing/intelligent/suppression.js';
import { resolveIntelligentConfig, runIntelligentCampaign } from '../services/marketing/intelligent/runner.js';
const router = Router();
const bcrypt: any = (bcryptNS as any).default ?? bcryptNS;

function tenantIdFrom(req: any) {
  return String(req.user?.id || '');
}

function actorFrom(req: any) {
  return { id: req.user?.id || null, email: req.user?.email || null };
}

function resolveFlowState(flowJson: Prisma.JsonValue | null | undefined) {
  if (flowJson && typeof flowJson === 'object' && !Array.isArray(flowJson)) {
    const record = flowJson as Record<string, unknown>;
    return {
      nodes: Array.isArray(record.nodes) ? record.nodes : [],
      edges: Array.isArray(record.edges) ? record.edges : [],
    };
  }
  return { nodes: [], edges: [] };
}

function renderMarketingShell(_req: any, res: any) {
  sendMarketingSuiteShell(res);
}

function logMarketingApi(req: any, resultSummary: unknown) {
  console.log(`[marketing api] ${req.originalUrl || req.url}`, {
    tenantId: tenantIdFrom(req),
    actor: actorFrom(req),
    resultSummary,
  });
}

function forwardToLegacy(
  req: any,
  res: any,
  next: any,
  legacyPath: string,
  methodOverride?: string,
  bodyOverride?: Record<string, unknown>
) {
  if (bodyOverride && typeof bodyOverride === 'object') {
    req.body = { ...(req.body || {}), ...bodyOverride };
  }
  const originalUrl = req.url;
  const originalMethod = req.method;
  const originalJson = res.json.bind(res);
  res.json = (payload: any) => {
    logMarketingApi(req, payload);
    res.json = originalJson;
    return originalJson(payload);
  };
  req.url = legacyPath;
  if (methodOverride) req.method = methodOverride;
  (router as any).handle(req, res, (err: any) => {
    req.url = originalUrl;
    req.method = originalMethod;
    res.json = originalJson;
    if (err) next(err);
  });
}

const marketingRoleRank: Record<MarketingGovernanceRole, number> = {
  [MarketingGovernanceRole.VIEWER]: 0,
  [MarketingGovernanceRole.CAMPAIGN_CREATOR]: 1,
  [MarketingGovernanceRole.APPROVER]: 2,
};

function normalizeMarketingRole(role?: string | null): MarketingGovernanceRole | null {
  const value = String(role || '').trim().toUpperCase();
  if (!value) return null;
  switch (value) {
    case 'VIEWER':
      return MarketingGovernanceRole.VIEWER;
    case 'CAMPAIGN_CREATOR':
    case 'CREATOR':
    case 'EDITOR':
      return MarketingGovernanceRole.CAMPAIGN_CREATOR;
    case 'APPROVER':
    case 'ADMIN':
      return MarketingGovernanceRole.APPROVER;
    default:
      return null;
  }
}

async function resolveMarketingRole(tenantId: string, req: any): Promise<MarketingGovernanceRole> {
  const platformRole = String(req.user?.platformRole || '').toUpperCase();
  const userRole = String(req.user?.role || '').toUpperCase();
  if (platformRole === 'PLATFORM_ADMIN' || userRole === 'ADMIN') {
    return MarketingGovernanceRole.APPROVER;
  }
  const userId = String(req.user?.id || '');
  if (!tenantId || !userId) return MarketingGovernanceRole.VIEWER;
  try {
    const assignment = await prisma.marketingRoleAssignment.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return assignment?.role ?? MarketingGovernanceRole.APPROVER;
  } catch (error) {
    console.error('[marketing] role lookup failed', error);
    try {
      const rows = await prisma.$queryRaw<{ role: string }[]>(
        Prisma.sql`SELECT "role"::text AS role FROM "MarketingRoleAssignment" WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} LIMIT 1`
      );
      const normalized = normalizeMarketingRole(rows[0]?.role);
      return normalized ?? MarketingGovernanceRole.APPROVER;
    } catch (fallbackError) {
      console.error('[marketing] role fallback lookup failed', fallbackError);
      return MarketingGovernanceRole.APPROVER;
    }
  }
}

async function assertMarketingRole(req: any, res: any, required: MarketingGovernanceRole) {
  const tenantId = tenantIdFrom(req);
  const role = await resolveMarketingRole(tenantId, req);
  if (marketingRoleRank[role] < marketingRoleRank[required]) {
    res.status(403).json({ ok: false, message: 'Insufficient marketing role.' });
    return null;
  }
  return role;
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

function formatShowDate(date?: Date | string | null) {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatLocalDateTime(value: Date) {
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hour = pad(value.getHours());
  const minute = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function injectPreviewText(mjmlBody: string, previewText?: string | null) {
  const preview = String(previewText || '').trim();
  if (!preview) return mjmlBody;
  if (/<mj-preview[\s>]/i.test(mjmlBody)) return mjmlBody;
  const previewTag = `<mj-preview>${preview}</mj-preview>`;
  if (/<mj-head[\s>]/i.test(mjmlBody)) {
    return mjmlBody.replace(/<mj-head[\s>]/i, (match) => `${match}\n${previewTag}`);
  }
  if (/<mjml[\s>]/i.test(mjmlBody)) {
    return mjmlBody.replace(/<mjml[\s>]/i, (match) => `${match}\n${previewTag}`);
  }
  return `${previewTag}\n${mjmlBody}`;
}

async function createTemplateVersion(
  template: {
    id: string;
    name: string;
    subject: string;
    previewText?: string | null;
    fromName: string;
    fromEmail: string;
    replyTo?: string | null;
    mjmlBody: string;
  },
  userId?: string | null
) {
  const latest = await prisma.marketingTemplateVersion.findFirst({
    where: { templateId: template.id },
    orderBy: { version: 'desc' },
  });
  const nextVersion = (latest?.version || 0) + 1;
  return prisma.marketingTemplateVersion.create({
    data: {
      templateId: template.id,
      version: nextVersion,
      name: template.name,
      subject: template.subject,
      previewText: template.previewText || null,
      fromName: template.fromName,
      fromEmail: template.fromEmail,
      replyTo: template.replyTo || null,
      mjmlBody: template.mjmlBody,
      createdByUserId: userId || null,
    },
  });
}

function resolveShowUrl(show: {
  id: string;
  usesExternalTicketing?: boolean | null;
  externalTicketUrl?: string | null;
}) {
  if (show.usesExternalTicketing && show.externalTicketUrl) return show.externalTicketUrl;
  return `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/public/event/${encodeURIComponent(show.id)}`;
}

function buildTemplateMergeContext(options: {
  contact?: { firstName?: string | null; lastName?: string | null; email?: string | null; town?: string | null; county?: string | null; tags?: string[] | null };
  show?: { title?: string | null; venue?: string | null; date?: Date | string | null; time?: string | null; priceFrom?: number | string | null; image?: string | null };
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

async function logMarketingAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue,
  actor?: { id?: string | null; email?: string | null }
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      actorUserId: actor?.id || null,
      actorEmail: actor?.email || null,
      action,
      entityType,
      entityId: entityId || null,
      metadata: metadata || undefined,
    },
  });
}

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';
const REQUIRE_VERIFIED_FROM_DEFAULT = String(process.env.MARKETING_REQUIRE_VERIFIED_FROM || 'true') === 'true';
const TEST_SEND_RATE_LIMIT_SECONDS = Number(process.env.MARKETING_TEST_SEND_RATE_LIMIT_SEC || 60);
const APPROVAL_THRESHOLD_DEFAULT = Number(process.env.MARKETING_APPROVAL_THRESHOLD || 5000);
const MARKETING_ANALYTICS_CACHE_TTL_MS = Number(process.env.MARKETING_ANALYTICS_CACHE_TTL_MS || 5 * 60 * 1000);
const MARKETING_ANALYTICS_RATE_LIMIT_PER_MIN = Number(process.env.MARKETING_ANALYTICS_RATE_LIMIT_PER_MIN || 60);
const MARKETING_ESTIMATE_RATE_LIMIT_PER_MIN = Number(process.env.MARKETING_ESTIMATE_RATE_LIMIT_PER_MIN || 30);

const marketingAnalyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: MARKETING_ANALYTICS_RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
});

const marketingEstimateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: MARKETING_ESTIMATE_RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsCache = new Map<string, { expiresAt: number; value: any }>();

function parseDateInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseDateRange(req: any) {
  const now = new Date();
  const toInput = parseDateInput(String(req.query?.to || '')) || now;
  const fromInput =
    parseDateInput(String(req.query?.from || '')) ||
    new Date(Date.UTC(toInput.getUTCFullYear(), toInput.getUTCMonth(), toInput.getUTCDate() - 30));

  const from = new Date(Date.UTC(fromInput.getUTCFullYear(), fromInput.getUTCMonth(), fromInput.getUTCDate(), 0, 0, 0));
  const to = new Date(Date.UTC(toInput.getUTCFullYear(), toInput.getUTCMonth(), toInput.getUTCDate(), 23, 59, 59, 999));

  return {
    from,
    to,
    fromLabel: from.toISOString().slice(0, 10),
    toLabel: to.toISOString().slice(0, 10),
  };
}

function cacheKey(parts: Array<string | number | undefined | null>) {
  return parts.filter((part) => part != null).join(':');
}

function getCachedAnalytics<T>(key: string): T | null {
  const cached = analyticsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    analyticsCache.delete(key);
    return null;
  }
  return cached.value as T;
}

function setCachedAnalytics(key: string, value: any) {
  analyticsCache.set(key, { value, expiresAt: Date.now() + MARKETING_ANALYTICS_CACHE_TTL_MS });
}

function parseUtmFromUrl(urlValue?: string | null) {
  if (!urlValue) return null;
  try {
    const url = new URL(urlValue);
    const params = url.searchParams;
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');
    const utmTerm = params.get('utm_term');
    if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !utmTerm) return null;
    return { utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
  } catch (err) {
    return null;
  }
}

type AutomationPresetDefinition = {
  id: string;
  label: string;
  description: string;
  triggerType: MarketingAutomationTriggerType;
  daysBefore?: number;
  templateHint: string;
};

function automationPresets(): AutomationPresetDefinition[] {
  return [
    {
      id: 'save-the-date-30',
      label: 'Save the Date',
      description: 'Send a heads-up 30 days before the show.',
      triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW,
      daysBefore: 30,
      templateHint: 'save the date',
    },
    {
      id: 'reminder-14',
      label: 'Reminder',
      description: 'Keep momentum 14 days before the show.',
      triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW,
      daysBefore: 14,
      templateHint: 'reminder',
    },
    {
      id: 'last-chance-5',
      label: 'Last Chance (5 days)',
      description: 'Urgent push 5 days before show day.',
      triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW,
      daysBefore: 5,
      templateHint: 'last chance',
    },
    {
      id: 'last-chance-3',
      label: 'Last Chance (3 days)',
      description: 'Final nudge 3 days before show day.',
      triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW,
      daysBefore: 3,
      templateHint: 'last chance',
    },
    {
      id: 'thank-you-next-day',
      label: 'Thank You',
      description: 'Follow up the day after the show.',
      triggerType: MarketingAutomationTriggerType.DAYS_BEFORE_SHOW,
      daysBefore: -1,
      templateHint: 'thank you',
    },
    {
      id: 'monthly-roundup-county',
      label: 'Monthly Roundup by County',
      description: 'Monthly digest for buyers in a county.',
      triggerType: MarketingAutomationTriggerType.MONTHLY_ROUNDUP,
      templateHint: 'roundup',
    },
    {
      id: 'low-sales-velocity',
      label: 'Low Sales Velocity Booster',
      description: 'Only sends when ticket velocity is weak.',
      triggerType: MarketingAutomationTriggerType.LOW_SALES_VELOCITY,
      templateHint: 'booster',
    },
  ];
}

type AiSuggestionPayload = Record<string, any>;

function nextOccurrenceOfDayHour(now: Date, dayIndex: number, hour: number) {
  const candidate = new Date(now);
  candidate.setHours(hour, 0, 0, 0);
  const currentDay = candidate.getDay();
  let delta = (dayIndex - currentDay + 7) % 7;
  if (delta === 0 && candidate <= now) delta = 7;
  candidate.setDate(candidate.getDate() + delta);
  return candidate;
}

async function storeAiSuggestion(
  organiserId: string,
  showId: string | null,
  suggestionType: string,
  suggestionPayload: AiSuggestionPayload,
  sourceData?: Prisma.InputJsonValue
) {
  return prisma.marketingAiSuggestion.create({
    data: {
      organiserId,
      showId,
      suggestionType,
      suggestionPayload,
      sourceData: sourceData || undefined,
    },
  });
}

async function recommendBestSegment(tenantId: string, showId: string) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { tenantId, showId },
    select: { id: true, segmentId: true, segment: { select: { name: true } } },
  });
  const segments = await prisma.marketingSegment.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!campaigns.length) {
    const fallback = segments[0];
    if (!fallback) return null;
    return {
      segmentId: fallback.id,
      segmentName: fallback.name,
      reason: 'No prior campaign history for this show yet.',
      metrics: null,
    };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const sentCounts = await prisma.marketingCampaignRecipient.groupBy({
    by: ['campaignId'],
    where: { tenantId, campaignId: { in: campaignIds }, status: MarketingRecipientStatus.SENT },
    _count: { _all: true },
  });
  const clickCounts = await prisma.marketingEmailEvent.groupBy({
    by: ['campaignId'],
    where: { tenantId, campaignId: { in: campaignIds }, type: 'CLICK' },
    _count: { _all: true },
  });

  const sentByCampaign = new Map(sentCounts.map((row) => [row.campaignId, row._count._all]));
  const clicksByCampaign = new Map(clickCounts.map((row) => [row.campaignId, row._count._all]));
  const performance = new Map<string, { segmentName: string; sent: number; clicks: number }>();

  campaigns.forEach((campaign) => {
    const sent = sentByCampaign.get(campaign.id) || 0;
    const clicks = clicksByCampaign.get(campaign.id) || 0;
    const existing = performance.get(campaign.segmentId) || {
      segmentName: campaign.segment?.name || 'Segment',
      sent: 0,
      clicks: 0,
    };
    performance.set(campaign.segmentId, {
      segmentName: existing.segmentName,
      sent: existing.sent + sent,
      clicks: existing.clicks + clicks,
    });
  });

  let best: { segmentId: string; segmentName: string; sent: number; clicks: number; clickRate: number } | null = null;
  for (const [segmentId, stats] of performance.entries()) {
    const clickRate = stats.sent ? stats.clicks / stats.sent : 0;
    if (!best || clickRate > best.clickRate || (clickRate === best.clickRate && stats.sent > best.sent)) {
      best = { segmentId, segmentName: stats.segmentName, sent: stats.sent, clicks: stats.clicks, clickRate };
    }
  }

  if (!best) return null;
  return {
    segmentId: best.segmentId,
    segmentName: best.segmentName,
    reason: 'Highest click rate from prior show campaigns.',
    metrics: {
      sent: best.sent,
      clicks: best.clicks,
      clickRate: Number((best.clickRate * 100).toFixed(1)),
    },
  };
}

function buildSubjectVariations(show: any, tenantName: string) {
  const title = show.title || 'the show';
  const venueName = show.venue?.name || '';
  const showDate = formatShowDate(show.date);
  const venueLine = venueName ? ` at ${venueName}` : '';
  const dateLine = showDate ? ` · ${showDate}` : '';
  return [
    {
      subject: `${title}${venueLine} tickets now available`,
      previewText: `Reserve your seats${dateLine}.`,
      reason: 'Availability-focused headline.',
    },
    {
      subject: `Don’t miss ${title}${venueLine}`,
      previewText: `Join ${tenantName} for ${title}${dateLine}.`,
      reason: 'FOMO-style reminder.',
    },
    {
      subject: `${title}${dateLine} — final spots`,
      previewText: `Secure tickets for ${title}${venueLine}.`,
      reason: 'Urgency for late-stage pushes.',
    },
  ];
}

async function recommendSendTime(tenantId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const events = await prisma.marketingEmailEvent.findMany({
    where: { tenantId, type: { in: ['OPEN', 'CLICK'] }, createdAt: { gte: since } },
    select: { createdAt: true, type: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const hourScores = new Array(24).fill(0);
  const dayScores = new Array(7).fill(0);
  events.forEach((event) => {
    const weight = event.type === 'CLICK' ? 2 : 1;
    const date = event.createdAt;
    hourScores[date.getHours()] += weight;
    dayScores[date.getDay()] += weight;
  });

  let bestHour = 10;
  let bestDay = 2;
  if (events.length) {
    bestHour = hourScores.reduce((best, score, hour) => (score > hourScores[best] ? hour : best), 0);
    bestDay = dayScores.reduce((best, score, day) => (score > dayScores[best] ? day : best), 0);
  }

  const recommendedDate = nextOccurrenceOfDayHour(new Date(), bestDay, bestHour);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    recommendedLocal: formatLocalDateTime(recommendedDate),
    bestHour,
    bestDay,
    timezone: 'Europe/London',
    reason: events.length
      ? `Highest engagement around ${bestHour}:00 on ${dayNames[bestDay]}.`
      : 'Defaulted to mid-morning due to limited engagement history.',
  };
}

function recommendAutomationPreset(show: any) {
  const presets = automationPresets().filter((preset) => preset.triggerType === MarketingAutomationTriggerType.DAYS_BEFORE_SHOW);
  const daysUntil = Math.ceil((new Date(show.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let bestPreset = presets[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  presets.forEach((preset) => {
    const delta = Math.abs((preset.daysBefore ?? 0) - daysUntil);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestPreset = preset;
    }
  });
  const reason =
    daysUntil >= 0
      ? `Show is in ${daysUntil} days; ${bestPreset.label} aligns closest.`
      : 'Show date passed; follow-up automation recommended.';
  return {
    presetId: bestPreset.id,
    label: bestPreset.label,
    description: bestPreset.description,
    reason,
  };
}

async function fetchTemplateShow(tenantId: string, showId?: string | null) {
  if (!showId) return null;
  return prisma.show.findFirst({
    where: { id: showId, organiserId: tenantId },
    select: {
      id: true,
      title: true,
      date: true,
      imageUrl: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      slug: true,
      tags: true,
      eventCategory: true,
      showCapacity: true,
      venue: { select: { name: true, city: true, county: true } },
    },
  });
}

async function fetchUpcomingShows(tenantId: string, excludeId?: string | null) {
  return prisma.show.findMany({
    where: {
      organiserId: tenantId,
      id: excludeId ? { not: excludeId } : undefined,
      date: { gte: new Date() },
      status: ShowStatus.LIVE,
    },
    orderBy: { date: 'asc' },
    take: 4,
    select: {
      id: true,
      title: true,
      date: true,
      imageUrl: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      slug: true,
      eventCategory: true,
      venue: { select: { name: true } },
    },
  });
}

async function withShowAvailability(show: Awaited<ReturnType<typeof fetchTemplateShow>> | null) {
  if (!show || show.showCapacity === null || show.showCapacity === undefined) return show;
  const soldAgg = await prisma.ticket.aggregate({
    where: {
      showId: show.id,
      order: { status: OrderStatus.PAID },
    },
    _sum: { quantity: true },
  });
  const soldCount = Number(soldAgg._sum.quantity || 0);
  const remaining = Math.max(0, Number(show.showCapacity) - soldCount);
  return {
    ...show,
    ticketsRemaining: Number.isFinite(remaining) ? remaining : null,
  };
}

function requireAdminOrOwner(req: any, res: any, next: any) {
  return requireAuth(req, res, () => {
    const role = String(req.user?.role || '').trim().toUpperCase();
    if (role === 'ADMIN' || isOwnerEmail(req.user?.email)) return next();
    return res.status(403).json({ error: true, message: 'Forbidden' });
  });
}

function isValidPublicBaseUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

function hasOwn(obj: Record<string, any>, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normaliseEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email: string) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function canOverrideTenant(req: any) {
  const role = String(req.user?.role || '').trim().toUpperCase();
  return role === 'ADMIN' || isOwnerEmail(req.user?.email);
}

function resolveTenantId(req: any) {
  const override = String(req.query?.tenantId || req.body?.tenantId || '').trim();
  if (override && canOverrideTenant(req)) return override;
  return tenantIdFrom(req);
}

const SENDGRID_API_KEY = String(process.env.SENDGRID_API_KEY || '').trim();
const SENDGRID_BASE_URL = 'https://api.sendgrid.com/v3';

type SendgridDnsRecord = { type: string; host: string; data: string };

function normalizeDomain(value: string) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

function sendgridHeaders() {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid not configured. Set SENDGRID_API_KEY.');
  }
  return {
    Authorization: `Bearer ${SENDGRID_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sendgridRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${SENDGRID_BASE_URL}${path}`, {
    method: options?.method || 'GET',
    headers: { ...sendgridHeaders(), ...(options?.headers || {}) },
    body: options?.body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SendGrid error: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function extractSendgridDnsRecords(payload: any): SendgridDnsRecord[] {
  const dns = payload?.dns || {};
  const records = [dns.mail_cname, dns.dkim1, dns.dkim2]
    .filter(Boolean)
    .map((record: any) => ({
      type: String(record.type || '').toUpperCase(),
      host: String(record.host || ''),
      data: String(record.data || ''),
    }))
    .filter((record: SendgridDnsRecord) => record.type && record.host && record.data);
  return records;
}

function isSendgridVerified(payload: any) {
  if (payload?.valid === true) return true;
  const dns = payload?.dns || {};
  const records = [dns.mail_cname, dns.dkim1, dns.dkim2].filter(Boolean);
  if (!records.length) return false;
  return records.every((record: any) => record.valid === true);
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const input = String(text || '');

  while (i < input.length) {
    const char = input[i];
    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    if (!inQuotes && char === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normaliseHeader(value: string) {
  return String(value || '').trim().toLowerCase();
}

function resolveColumnIndex(
  headerRow: string[],
  mappingValue: unknown,
  fallbackIndex: number
): number {
  if (typeof mappingValue === 'number' && Number.isFinite(mappingValue)) {
    return mappingValue;
  }
  if (typeof mappingValue === 'string') {
    const trimmed = mappingValue.trim();
    if (!trimmed) return fallbackIndex;
    const target = normaliseHeader(trimmed);
    const index = headerRow.findIndex((value) => normaliseHeader(value) === target);
    return index >= 0 ? index : fallbackIndex;
  }
  return fallbackIndex;
}

function parseDelimitedList(value: string | null) {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function escapeCsvValue(value: unknown) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}


router.get('/api/marketing/health', requireAdminOrOwner, async (_req, res) => {
  const workerEnabled = String(process.env.MARKETING_WORKER_ENABLED || 'true') === 'true';
  const intervalMs = Number(process.env.MARKETING_WORKER_INTERVAL_MS || 30000);
  const sendRate = Number(process.env.MARKETING_SEND_RATE_PER_SEC || 50);
  const dailyLimit = Number(process.env.MARKETING_DAILY_LIMIT || 50000);
  const providerConfigured = Boolean(String(process.env.SENDGRID_API_KEY || '').trim());
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || '';
  const unsubscribeBaseUrlOk = isValidPublicBaseUrl(publicBaseUrl);
  const workerState = await prisma.marketingWorkerState.findUnique({ where: { id: 'global' } });
  const sendQueueDepth = await prisma.marketingCampaignRecipient.count({
    where: {
      status: { in: [MarketingRecipientStatus.PENDING, MarketingRecipientStatus.RETRYABLE] },
      campaign: { status: { in: [MarketingCampaignStatus.SCHEDULED, MarketingCampaignStatus.SENDING, MarketingCampaignStatus.PAUSED_LIMIT] } },
    },
  });

  console.info('[marketing:health]', {
    workerEnabled,
    intervalMs,
    sendRate,
    dailyLimit,
    providerConfigured,
    unsubscribeBaseUrlOk,
    publicBaseUrlConfigured: Boolean(publicBaseUrl),
    lastWorkerRunAt: workerState?.lastWorkerRunAt || null,
    lastSendAt: workerState?.lastSendAt || null,
    sendQueueDepth,
  });

  res.json({
    workerEnabled,
    intervalMs,
    sendRate,
    dailyLimit,
    providerConfigured,
    unsubscribeBaseUrlOk,
    lastWorkerRunAt: workerState?.lastWorkerRunAt || null,
    lastSendAt: workerState?.lastSendAt || null,
    sendQueueDepth,
  });
});

router.get('/api/marketing/insights/health', requireAdminOrOwner, async (_req, res) => {
  const workerEnabled = String(process.env.CUSTOMER_INSIGHTS_WORKER_ENABLED || 'true') === 'true';
  const intervalMs = Number(process.env.CUSTOMER_INSIGHTS_WORKER_INTERVAL_MS || 24 * 60 * 60 * 1000);
  const workerState = await prisma.customerInsightsWorkerState.findUnique({ where: { id: 'global' } });
  const totalInsights = await prisma.customerInsight.count();

  res.json({
    workerEnabled,
    intervalMs,
    lastRunAt: workerState?.lastRunAt || null,
    lastRunCompletedAt: workerState?.lastRunCompletedAt || null,
    lastProcessedCount: workerState?.lastProcessedCount || 0,
    lastError: workerState?.lastError || null,
    totalInsights,
  });
});

router.get('/api/marketing/insights', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const email = String(req.query.email || '').trim().toLowerCase();
  const customerAccountId = String(req.query.customerAccountId || '').trim();
  const limit = Number(req.query.limit || 50);

  if (email) {
    const insight = await prisma.customerInsight.findFirst({
      where: {
        tenantId,
        email,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });
    return res.json({ ok: true, insight });
  }

  const items = await prisma.customerInsight.findMany({
    where: { tenantId },
    orderBy: { lastPurchaseAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
  });

  return res.json({ ok: true, items });
});

router.post('/api/marketing/insights/query', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const payload = req.body || {};
  const limit = Number(payload.limit || 100);
  const results = await queryCustomerInsights(tenantId, payload.rules, limit);
  res.json({ ok: true, ...results });
});

router.get('/api/marketing/settings', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
    },
    update: {},
  });
  console.info('[marketing:settings:get]', settings);
  res.json({ ok: true, settings });
});

router.get('/api/marketing/status', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const settings = await prisma.marketingSettings.findUnique({ where: { tenantId } });
  const senderConfigured = Boolean(settings?.defaultFromEmail && settings?.defaultFromName);
  res.json({
    ok: true,
    senderConfigured,
    verifiedStatus: settings?.verifiedStatus || MarketingVerifiedStatus.UNVERIFIED,
    sendingMode: settings?.sendingMode || MarketingSenderMode.SENDGRID,
  });
});

router.get('/api/marketing/intelligent', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const items = await prisma.marketingIntelligentCampaign.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: { kind: true, configJson: true, enabled: true, templateId: true, lastRunAt: true },
  });
  const response = { ok: true, items };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/api/marketing/intelligent/report', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const daysRaw = Number(req.query?.days || 30);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(365, Math.floor(daysRaw)) : 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.marketingEmailEvent.findMany({
    where: {
      tenantId,
      createdAt: { gte: from },
      type: {
        in: [
          MarketingEmailEventType.DELIVERED,
          MarketingEmailEventType.OPEN,
          MarketingEmailEventType.CLICK,
          MarketingEmailEventType.BOUNCE,
          MarketingEmailEventType.UNSUBSCRIBE,
        ],
      },
      campaign: { name: { startsWith: 'IC:' } },
    },
    select: {
      type: true,
      email: true,
      campaignId: true,
    },
  });

  const campaignIds = Array.from(new Set(events.map((event) => event.campaignId)));
  const snapshots = campaignIds.length
    ? await prisma.marketingSendSnapshot.findMany({
        where: {
          tenantId,
          campaignId: { in: campaignIds },
        },
        select: {
          campaignId: true,
          recipientEmail: true,
          mergeContext: true,
        },
      })
    : [];

  const snapshotKindMap = new Map<string, string>();
  for (const snapshot of snapshots) {
    const mergeContext = snapshot.mergeContext;
    if (!mergeContext || typeof mergeContext !== 'object' || Array.isArray(mergeContext)) continue;
    const meta = (mergeContext as Record<string, any>).meta;
    const kind = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta.kind : null;
    if (typeof kind !== 'string' || !kind) continue;
    const key = `${snapshot.campaignId}:${normaliseEmail(snapshot.recipientEmail)}`;
    if (!snapshotKindMap.has(key)) {
      snapshotKindMap.set(key, kind);
    }
  }

  const totals = new Map<
    string,
    { sent: number; opened: number; clicked: number; bounced: number; unsubscribed: number }
  >();
  for (const event of events) {
    const key = `${event.campaignId}:${normaliseEmail(event.email)}`;
    const kind = snapshotKindMap.get(key);
    if (!kind) continue;
    const stats =
      totals.get(kind) || { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    if (event.type === MarketingEmailEventType.DELIVERED) stats.sent += 1;
    if (event.type === MarketingEmailEventType.OPEN) stats.opened += 1;
    if (event.type === MarketingEmailEventType.CLICK) stats.clicked += 1;
    if (event.type === MarketingEmailEventType.BOUNCE) stats.bounced += 1;
    if (event.type === MarketingEmailEventType.UNSUBSCRIBE) stats.unsubscribed += 1;
    totals.set(kind, stats);
  }

  const response = {
    ok: true,
    days,
    items: Array.from(totals.entries()).map(([kind, stats]) => ({
      kind,
      ...stats,
    })),
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.put('/api/marketing/intelligent/:kind', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const rawKind = String(req.params.kind || '').trim().toUpperCase();
  const kind = Object.values(MarketingIntelligentCampaignKind).includes(rawKind as MarketingIntelligentCampaignKind)
    ? (rawKind as MarketingIntelligentCampaignKind)
    : null;
  if (!kind) {
    const response = { ok: false, message: 'Invalid intelligent campaign kind.' };
    logMarketingApi(req, response);
    return res.status(400).json(response);
  }

  const payload = req.body || {};
  const templateId = hasOwn(payload, 'templateId') ? String(payload.templateId || '').trim() : undefined;
  const enabled = hasOwn(payload, 'enabled') ? Boolean(payload.enabled) : undefined;
  const configJson = hasOwn(payload, 'configJson') ? payload.configJson : undefined;
  const configJsonInput: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined =
    configJson === undefined ? undefined : configJson === null ? Prisma.JsonNull : (configJson as Prisma.InputJsonValue);
  const lastRunAtRaw = hasOwn(payload, 'lastRunAt') ? payload.lastRunAt : undefined;
  const lastRunAt =
    lastRunAtRaw === undefined || lastRunAtRaw === null || lastRunAtRaw === ''
      ? lastRunAtRaw === undefined
        ? undefined
        : null
      : new Date(lastRunAtRaw);

  if (lastRunAt instanceof Date && Number.isNaN(lastRunAt.getTime())) {
    const response = { ok: false, message: 'Invalid lastRunAt timestamp.' };
    logMarketingApi(req, response);
    return res.status(400).json(response);
  }

  const existing = await prisma.marketingIntelligentCampaign.findFirst({
    where: { tenantId, kind },
    select: { id: true, kind: true, configJson: true, enabled: true, templateId: true, lastRunAt: true },
  });

  if (!existing && (!templateId || configJson === undefined)) {
    const response = { ok: false, message: 'templateId and configJson are required to create config.' };
    logMarketingApi(req, response);
    return res.status(400).json(response);
  }

  const updateData: Prisma.MarketingIntelligentCampaignUncheckedUpdateInput = {};
  if (templateId !== undefined) updateData.templateId = templateId;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (configJsonInput !== undefined) updateData.configJson = configJsonInput;
  if (lastRunAt !== undefined) updateData.lastRunAt = lastRunAt;

  let record = existing;
  if (!existing) {
    record = await prisma.marketingIntelligentCampaign.create({
      data: {
        tenantId,
        kind,
        templateId: templateId as string,
        configJson: configJsonInput as Prisma.InputJsonValue | Prisma.NullTypes.JsonNull,
        enabled: enabled ?? true,
        lastRunAt: lastRunAt ?? null,
      },
      select: { id: true, kind: true, configJson: true, enabled: true, templateId: true, lastRunAt: true },
    });
  } else if (Object.keys(updateData).length) {
    record = await prisma.marketingIntelligentCampaign.update({
      where: { id: existing.id },
      data: updateData,
      select: { id: true, kind: true, configJson: true, enabled: true, templateId: true, lastRunAt: true },
    });
  } else {
    record = existing;
  }

  const response = {
    ok: true,
    config: {
      kind: record?.kind ?? kind,
      configJson: record?.configJson ?? existing?.configJson ?? null,
      enabled: record?.enabled ?? existing?.enabled ?? true,
      templateId: record?.templateId ?? existing?.templateId ?? '',
      lastRunAt: record?.lastRunAt ?? existing?.lastRunAt ?? null,
    },
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/api/marketing/intelligent/:kind/run', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const rawKind = String(req.params.kind || '').trim().toUpperCase();
  const kind = Object.values(MarketingIntelligentCampaignKind).includes(rawKind as MarketingIntelligentCampaignKind)
    ? (rawKind as MarketingIntelligentCampaignKind)
    : null;
  if (!kind) {
    return res.status(400).json({ ok: false, message: 'Invalid intelligent campaign kind.' });
  }
  const dryRunProvided = typeof req.body?.dryRun !== 'undefined';
  if (dryRunProvided && typeof req.body?.dryRun !== 'boolean') {
    return res.status(400).json({ ok: false, message: 'dryRun must be a boolean.' });
  }
  const dryRun = req.body?.dryRun !== false;

  const runResult = await runIntelligentCampaign({
    tenantId,
    kind,
    dryRun,
    actorUserId: req.user?.id || null,
    actorEmail: req.user?.email || null,
  });
  if (!runResult.ok) {
    return res.status(runResult.status).json({ ok: false, message: runResult.message });
  }

  const response = {
    ok: true,
    runId: runResult.runId,
    campaignId: runResult.campaignId,
    eligibleCount: runResult.eligibleCount,
    suppressedCount: runResult.suppressedCount,
    capBlockedCount: runResult.capBlockedCount,
    sampleRecipients: runResult.sampleRecipients,
    skippedReason: runResult.skippedReason,
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/api/marketing/intelligent/:kind/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const rawKind = String(req.params.kind || '').trim().toUpperCase();
  const kind = Object.values(MarketingIntelligentCampaignKind).includes(rawKind as MarketingIntelligentCampaignKind)
    ? (rawKind as MarketingIntelligentCampaignKind)
    : null;
  if (!kind) {
    return res.status(400).json({ ok: false, message: 'Invalid intelligent campaign kind.' });
  }

  const config = await prisma.marketingIntelligentCampaign.findFirst({
    where: { tenantId, kind },
    include: { template: true },
  });
  if (!config || !config.template) {
    return res.status(404).json({ ok: false, message: 'Intelligent campaign not configured.' });
  }

  const contactId = String(req.body?.contactId || '').trim();
  const emailInput = normaliseEmail(req.body?.email || '');
  if (!contactId && !emailInput) {
    return res.status(400).json({ ok: false, message: 'contactId or email required' });
  }
  if (emailInput && !isValidEmail(emailInput)) {
    return res.status(400).json({ ok: false, message: 'Valid email required' });
  }

  const contact = await prisma.marketingContact.findFirst({
    where: contactId
      ? { id: contactId, tenantId }
      : {
          tenantId,
          email: { equals: emailInput, mode: 'insensitive' },
        },
    include: { consents: { orderBy: { createdAt: 'desc' } } },
  });
  if (!contact) return res.status(404).json({ ok: false, message: 'Contact not found' });

  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) return res.status(404).json({ ok: false, message: 'Tenant not found' });

  const email = contact.email;
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(preferencesToken)}`;

  const configOptions = resolveIntelligentConfig(config.configJson);
  const upcomingShows = await getTenantUpcomingShows(tenantId, configOptions.horizonDays);
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

  const recommendedShowsPayload = recommendedShows.map((show) => ({
    title: show.title,
    date: show.date,
    venueName: show.venueName,
    town: show.town,
    county: show.county,
    bookingUrl: show.bookingUrl,
    imageUrl: show.imageUrl,
    reason: show.reason,
  }));
  const recommendedShowsHtml = buildIntelligentShowsHtml(recommendedShowsPayload);

  const suppression = await prisma.marketingSuppression.findFirst({
    where: {
      tenantId,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { type: true },
  });
  const consentStatus = (contact.consents[0]?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
  const suppressionDecision = shouldSuppressContact(consentStatus, suppression);

  const reasons = new Set<string>();
  if (suppressionDecision.suppressed && suppressionDecision.reason) {
    reasons.add(suppressionDecision.reason);
  }

  const sendCap = await countIntelligentSendsLast30d(
    tenantId,
    email,
    configOptions.maxEmailsPer30DaysPerContact
  );
  sendCap.reasons.forEach((reason) => reasons.add(reason));

  const topShowId = recommendedShows[0]?.showId;
  if (topShowId) {
    const recentEligibility = await hasEmailedShowRecently(tenantId, email, topShowId, configOptions.cooldownDays);
    recentEligibility.reasons.forEach((reason) => reasons.add(reason));
  }

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
    },
  };

  let html = '';
  let text: string | null = null;
  if (config.template.compiledHtml) {
    html = renderCompiledTemplate({
      compiledHtml: config.template.compiledHtml,
      mergeContext,
      unsubscribeUrl,
      preferencesUrl,
      recommendedShows: recommendedShowsHtml,
    });
    if (config.template.compiledText) {
      text = renderMergeTags(config.template.compiledText, mergeContext);
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
    html = rendered.html;
  }

  res.json({
    ok: true,
    html,
    ...(text ? { text } : {}),
    meta: {
      kind,
      reasons: Array.from(reasons),
    },
  });
});

router.post('/api/marketing/settings', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const payload = req.body || {};

  const existing = await prisma.marketingSettings.findUnique({
    where: { tenantId },
    select: { defaultFromEmail: true },
  });

  const defaultFromName = hasOwn(payload, 'defaultFromName') ? String(payload.defaultFromName || '').trim() : undefined;
  const defaultFromEmail = hasOwn(payload, 'defaultFromEmail') ? String(payload.defaultFromEmail || '').trim() : undefined;
  const defaultReplyTo = hasOwn(payload, 'defaultReplyTo') ? String(payload.defaultReplyTo || '').trim() : undefined;
  const brandLogoUrl = hasOwn(payload, 'brandLogoUrl') ? String(payload.brandLogoUrl || '').trim() : undefined;
  const brandDefaultFont = hasOwn(payload, 'brandDefaultFont') ? String(payload.brandDefaultFont || '').trim() : undefined;
  const brandPrimaryColor = hasOwn(payload, 'brandPrimaryColor') ? String(payload.brandPrimaryColor || '').trim() : undefined;
  const brandButtonRadius = hasOwn(payload, 'brandButtonRadius')
    ? Number(payload.brandButtonRadius || 0)
    : undefined;
  const requireVerifiedFrom = hasOwn(payload, 'requireVerifiedFrom') ? Boolean(payload.requireVerifiedFrom) : undefined;
  const dailyLimitOverride = hasOwn(payload, 'dailyLimitOverride') ? Number(payload.dailyLimitOverride) : undefined;
  const sendRatePerSecOverride = hasOwn(payload, 'sendRatePerSecOverride') ? Number(payload.sendRatePerSecOverride) : undefined;
  const resetVerifiedStatus =
    defaultFromEmail !== undefined &&
    normaliseEmail(defaultFromEmail || '') !== normaliseEmail(existing?.defaultFromEmail || '');

  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      defaultFromName: defaultFromName ? defaultFromName : null,
      defaultFromEmail: defaultFromEmail ? defaultFromEmail : null,
      defaultReplyTo: defaultReplyTo ? defaultReplyTo : null,
      requireVerifiedFrom: requireVerifiedFrom ?? REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
      brandLogoUrl: brandLogoUrl ? brandLogoUrl : null,
      brandDefaultFont: brandDefaultFont ? brandDefaultFont : null,
      brandPrimaryColor: brandPrimaryColor ? brandPrimaryColor : null,
      brandButtonRadius: Number.isFinite(brandButtonRadius) ? brandButtonRadius : null,
      dailyLimitOverride: Number.isFinite(dailyLimitOverride) ? dailyLimitOverride : null,
      sendRatePerSecOverride: Number.isFinite(sendRatePerSecOverride) ? sendRatePerSecOverride : null,
    },
    update: {
      defaultFromName: defaultFromName !== undefined ? (defaultFromName ? defaultFromName : null) : undefined,
      defaultFromEmail: defaultFromEmail !== undefined ? (defaultFromEmail ? defaultFromEmail : null) : undefined,
      defaultReplyTo: defaultReplyTo !== undefined ? (defaultReplyTo ? defaultReplyTo : null) : undefined,
      brandLogoUrl: brandLogoUrl !== undefined ? (brandLogoUrl ? brandLogoUrl : null) : undefined,
      brandDefaultFont: brandDefaultFont !== undefined ? (brandDefaultFont ? brandDefaultFont : null) : undefined,
      brandPrimaryColor: brandPrimaryColor !== undefined ? (brandPrimaryColor ? brandPrimaryColor : null) : undefined,
      brandButtonRadius:
        brandButtonRadius !== undefined ? (Number.isFinite(brandButtonRadius) ? brandButtonRadius : null) : undefined,
      requireVerifiedFrom: requireVerifiedFrom ?? undefined,
      verifiedStatus: resetVerifiedStatus ? MarketingVerifiedStatus.UNVERIFIED : undefined,
      dailyLimitOverride:
        dailyLimitOverride !== undefined ? (Number.isFinite(dailyLimitOverride) ? dailyLimitOverride : null) : undefined,
      sendRatePerSecOverride:
        sendRatePerSecOverride !== undefined
          ? (Number.isFinite(sendRatePerSecOverride) ? sendRatePerSecOverride : null)
          : undefined,
    },
  });

  console.info('[marketing:settings:upsert]', settings);
  res.json({ ok: true, settings });
});

router.get('/api/marketing/brand-settings', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
    },
    update: {},
  });
  res.json({
    ok: true,
    brand: {
      logoUrl: settings.brandLogoUrl || null,
      defaultFont: settings.brandDefaultFont || null,
      primaryColor: settings.brandPrimaryColor || null,
      buttonRadius: settings.brandButtonRadius || null,
    },
  });
});

router.post('/api/marketing/brand-settings', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const payload = req.body || {};
  const logoUrl = String(payload.logoUrl || '').trim();
  const defaultFont = String(payload.defaultFont || '').trim();
  const primaryColor = String(payload.primaryColor || '').trim();
  const buttonRadius = Number(payload.buttonRadius || 0);

  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
      brandLogoUrl: logoUrl || null,
      brandDefaultFont: defaultFont || null,
      brandPrimaryColor: primaryColor || null,
      brandButtonRadius: Number.isFinite(buttonRadius) ? buttonRadius : null,
    },
    update: {
      brandLogoUrl: logoUrl || null,
      brandDefaultFont: defaultFont || null,
      brandPrimaryColor: primaryColor || null,
      brandButtonRadius: Number.isFinite(buttonRadius) ? buttonRadius : null,
    },
  });

  res.json({
    ok: true,
    brand: {
      logoUrl: settings.brandLogoUrl || null,
      defaultFont: settings.brandDefaultFont || null,
      primaryColor: settings.brandPrimaryColor || null,
      buttonRadius: settings.brandButtonRadius || null,
    },
  });
});

router.get('/api/marketing/sender-identity', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
    },
    update: {},
  });

  const smtpConfigured = Boolean(settings.smtpHost && settings.smtpUserEncrypted && settings.smtpPassEncrypted);
  const safeSettings = {
    ...settings,
    smtpUserEncrypted: null,
    smtpPassEncrypted: null,
    smtpConfigured,
  };

  res.json({
    ok: true,
    tenantId,
    canOverride: canOverrideTenant(req),
    sendgridConfigured: Boolean(SENDGRID_API_KEY),
    settings: safeSettings,
  });
});

router.post('/api/marketing/sender-identity', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const payload = req.body || {};
  const existing = await prisma.marketingSettings.findUnique({ where: { tenantId } });
  const updates: Prisma.MarketingSettingsUpdateInput = {};

  const sendingMode = hasOwn(payload, 'sendingMode') ? String(payload.sendingMode || '').trim().toUpperCase() : undefined;
  const smtpHost = hasOwn(payload, 'smtpHost') ? String(payload.smtpHost || '').trim() : undefined;
  const smtpPort = hasOwn(payload, 'smtpPort') ? Number(payload.smtpPort || 0) : undefined;
  const smtpUser = hasOwn(payload, 'smtpUser') ? String(payload.smtpUser || '').trim() : undefined;
  const smtpPass = hasOwn(payload, 'smtpPass') ? String(payload.smtpPass || '').trim() : undefined;
  const smtpSecure = hasOwn(payload, 'smtpSecure') ? Boolean(payload.smtpSecure) : undefined;

  if (sendingMode === MarketingSenderMode.SMTP || sendingMode === MarketingSenderMode.SENDGRID) {
    updates.sendingMode = sendingMode as MarketingSenderMode;
  }

  if (smtpHost !== undefined) updates.smtpHost = smtpHost ? smtpHost : null;
  if (smtpPort !== undefined && Number.isFinite(smtpPort)) updates.smtpPort = smtpPort || null;
  if (smtpSecure !== undefined) updates.smtpSecure = smtpSecure;
  if (smtpUser !== undefined) updates.smtpUserEncrypted = smtpUser ? encryptToken(smtpUser) : null;
  if (smtpPass !== undefined) updates.smtpPassEncrypted = smtpPass ? encryptToken(smtpPass) : null;

  const smtpTouched = smtpHost !== undefined || smtpPort !== undefined || smtpUser !== undefined || smtpPass !== undefined || smtpSecure !== undefined;
  const modeChanged = sendingMode && sendingMode !== existing?.sendingMode;
  if (smtpTouched) updates.smtpLastTestAt = null;
  if (modeChanged || (sendingMode === MarketingSenderMode.SMTP && smtpTouched)) {
    updates.verifiedStatus = MarketingVerifiedStatus.UNVERIFIED;
  }

  if (canOverrideTenant(req) && hasOwn(payload, 'verifiedStatus')) {
    const status = String(payload.verifiedStatus || '').trim().toUpperCase();
    if (Object.values(MarketingVerifiedStatus).includes(status as MarketingVerifiedStatus)) {
      updates.verifiedStatus = status as MarketingVerifiedStatus;
    }
  }

  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: (updates.sendingMode as MarketingSenderMode) || MarketingSenderMode.SENDGRID,
      verifiedStatus: (updates.verifiedStatus as MarketingVerifiedStatus) || MarketingVerifiedStatus.UNVERIFIED,
      smtpHost: updates.smtpHost as string | null,
      smtpPort: updates.smtpPort as number | null,
      smtpUserEncrypted: updates.smtpUserEncrypted as string | null,
      smtpPassEncrypted: updates.smtpPassEncrypted as string | null,
      smtpSecure: updates.smtpSecure as boolean | null,
      smtpLastTestAt: updates.smtpLastTestAt as Date | null,
    },
    update: updates,
  });

  const smtpConfigured = Boolean(settings.smtpHost && settings.smtpUserEncrypted && settings.smtpPassEncrypted);
  const safeSettings = { ...settings, smtpUserEncrypted: null, smtpPassEncrypted: null, smtpConfigured };
  res.json({ ok: true, settings: safeSettings });
});

router.post('/api/marketing/sender-identity/sendgrid/start', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const payload = req.body || {};

  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
    },
    update: {},
  });

  const defaultDomain = normalizeDomain(settings.defaultFromEmail?.split('@')[1] || '');
  const domain = normalizeDomain(payload.domain || defaultDomain);
  const subdomain = normalizeDomain(payload.subdomain || 'mail');

  if (!domain) {
    return res.status(400).json({ ok: false, message: 'Domain is required for verification.' });
  }

  const response = await sendgridRequest('/whitelabel/domains', {
    method: 'POST',
    body: JSON.stringify({
      domain,
      subdomain,
      automatic_security: true,
      custom_spf: true,
    }),
  });

  const dnsRecords = extractSendgridDnsRecords(response);
  const verifiedStatus = isSendgridVerified(response)
    ? MarketingVerifiedStatus.VERIFIED
    : MarketingVerifiedStatus.PENDING;

  const updated = await prisma.marketingSettings.update({
    where: { tenantId },
    data: {
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus,
      sendgridDomainId: String(response.id || ''),
      sendgridDomain: domain,
      sendgridSubdomain: subdomain,
      sendgridDnsRecords: dnsRecords as Prisma.InputJsonValue,
    },
  });

  const smtpConfigured = Boolean(updated.smtpHost && updated.smtpUserEncrypted && updated.smtpPassEncrypted);
  res.json({
    ok: true,
    settings: { ...updated, smtpUserEncrypted: null, smtpPassEncrypted: null, smtpConfigured },
    dnsRecords,
  });
});

router.post('/api/marketing/sender-identity/sendgrid/refresh', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const settings = await prisma.marketingSettings.findUnique({ where: { tenantId } });
  if (!settings?.sendgridDomainId) {
    return res.status(400).json({ ok: false, message: 'SendGrid domain verification not started yet.' });
  }

  const response = await sendgridRequest(`/whitelabel/domains/${encodeURIComponent(settings.sendgridDomainId)}`);
  const dnsRecords = extractSendgridDnsRecords(response);
  const verifiedStatus = isSendgridVerified(response)
    ? MarketingVerifiedStatus.VERIFIED
    : MarketingVerifiedStatus.PENDING;

  const updated = await prisma.marketingSettings.update({
    where: { tenantId },
    data: {
      verifiedStatus,
      sendgridDnsRecords: dnsRecords as Prisma.InputJsonValue,
    },
  });

  const smtpConfigured = Boolean(updated.smtpHost && updated.smtpUserEncrypted && updated.smtpPassEncrypted);
  res.json({
    ok: true,
    settings: { ...updated, smtpUserEncrypted: null, smtpPassEncrypted: null, smtpConfigured },
    dnsRecords,
  });
});

router.post('/api/marketing/sender-identity/test-send', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const email = normaliseEmail(req.body?.email);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Valid email required' });
  }

  const settings = await prisma.marketingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireVerifiedFrom: REQUIRE_VERIFIED_FROM_DEFAULT,
      sendingMode: MarketingSenderMode.SENDGRID,
      verifiedStatus: MarketingVerifiedStatus.UNVERIFIED,
    },
    update: {},
  });

  const sender = resolveSenderDetails({ settings });
  if (!sender.fromEmail || !sender.fromName) {
    return res.status(400).json({ ok: false, message: 'From name/email required' });
  }

  const requireVerifiedFrom = resolveRequireVerifiedFrom(settings, REQUIRE_VERIFIED_FROM_DEFAULT);
  try {
    assertSenderVerified({ fromEmail: sender.fromEmail, settings, requireVerifiedFrom, allowUnverified: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || 'From email not verified for marketing sends.' });
  }

  try {
    const provider = getEmailProvider(settings);
    const listUnsubscribeMail = buildListUnsubscribeMail(sender.fromEmail);
    await provider.sendEmail({
      to: email,
      subject: `Sender identity test for ${sender.fromName}`,
      html: `<p>This is a test send to confirm your sender identity for ${sender.fromName}.</p>`,
      fromName: sender.fromName,
      fromEmail: applyMarketingStreamToEmail(sender.fromEmail, settings),
      replyTo: sender.replyTo || undefined,
      headers: listUnsubscribeMail ? { 'List-Unsubscribe': listUnsubscribeMail } : undefined,
    });

    let verifiedStatusUpdate: MarketingVerifiedStatus | undefined;
    if (settings.sendingMode === MarketingSenderMode.SMTP) {
      verifiedStatusUpdate = MarketingVerifiedStatus.VERIFIED;
    }

    await prisma.marketingSettings.update({
      where: { tenantId },
      data: {
        smtpLastTestAt: new Date(),
        verifiedStatus: verifiedStatusUpdate ?? undefined,
      },
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('[marketing:sender-identity:test-send]', error);
    res.status(500).json({ ok: false, message: 'Test send failed' });
  }
});

router.get('/api/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const q = String(req.query.q || '').trim().toLowerCase();

  const contacts = await prisma.marketingContact.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { consents: true, tags: { include: { tag: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const items = contacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    status: contact.consents[0]?.status || MarketingConsentStatus.TRANSACTIONAL_ONLY,
    tags: contact.tags.map((t) => t.tag.name),
    createdAt: contact.createdAt,
  }));

  res.json({ ok: true, items });
});

router.post('/api/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const contact = await prisma.marketingContact.upsert({
    where: { tenantId_email: { tenantId, email } },
    create: {
      tenantId,
      email,
      firstName: req.body?.firstName || null,
      lastName: req.body?.lastName || null,
      phone: req.body?.phone || null,
      town: req.body?.town || null,
      birthdayDate: req.body?.birthdayDate ? new Date(req.body.birthdayDate) : null,
      anniversaryDate: req.body?.anniversaryDate ? new Date(req.body.anniversaryDate) : null,
    },
    update: {
      firstName: req.body?.firstName || undefined,
      lastName: req.body?.lastName || undefined,
      phone: req.body?.phone || undefined,
      town: req.body?.town || undefined,
      birthdayDate: req.body?.birthdayDate ? new Date(req.body.birthdayDate) : undefined,
      anniversaryDate: req.body?.anniversaryDate ? new Date(req.body.anniversaryDate) : undefined,
    },
  });

  const status = req.body?.status || MarketingConsentStatus.TRANSACTIONAL_ONLY;
  const lawfulBasis = req.body?.lawfulBasis || MarketingLawfulBasis.UNKNOWN;

  if (status === MarketingConsentStatus.UNSUBSCRIBED) {
    await applySuppression(tenantId, email, MarketingSuppressionType.UNSUBSCRIBE, 'Admin unsubscribe', MarketingConsentSource.ADMIN_EDIT);
  } else {
    await clearSuppression(tenantId, email);
    await prisma.marketingConsent.upsert({
      where: { tenantId_contactId: { tenantId, contactId: contact.id } },
      create: {
        tenantId,
        contactId: contact.id,
        status,
        lawfulBasis,
        source: MarketingConsentSource.ADMIN_EDIT,
        capturedAt: new Date(),
      },
      update: {
        status,
        lawfulBasis,
        source: MarketingConsentSource.ADMIN_EDIT,
        capturedAt: new Date(),
      },
    });
    await recordConsentAudit(tenantId, 'consent.updated', contact.id, { status, source: MarketingConsentSource.ADMIN_EDIT });
  }

  await logMarketingAudit(tenantId, 'contact.saved', 'MarketingContact', contact.id, { email }, actorFrom(req));

  res.json({ ok: true, contactId: contact.id });
});

router.post('/api/marketing/contacts/:id/tags', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const contactId = String(req.params.id);
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  if (!tags.length) return res.status(400).json({ ok: false, message: 'Tags required' });

  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, tenantId } });
  if (!contact) return res.status(404).json({ ok: false, message: 'Contact not found' });

  for (const tagName of tags) {
    const name = String(tagName || '').trim();
    if (!name) continue;
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

  await logMarketingAudit(tenantId, 'contact.tags.updated', 'MarketingContact', contactId, { tags }, actorFrom(req));
  res.json({ ok: true });
});

router.post('/api/marketing/imports', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const csvText = String(req.body?.csv || req.body?.csvText || req.body?.text || '').trim();
  if (!csvText) return res.status(400).json({ ok: false, message: 'CSV required' });

  const filename = String(req.body?.filename || '').trim() || null;
  const requestedLawfulBasis = String(req.body?.lawfulBasis || '').trim();
  const mapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : {};
  const source = String(req.body?.source || 'MANUAL_CSV').trim() || 'MANUAL_CSV';
  const lawfulBasis =
    requestedLawfulBasis === MarketingLawfulBasis.LEGITIMATE_INTEREST
      ? MarketingLawfulBasis.LEGITIMATE_INTEREST
      : MarketingLawfulBasis.CONSENT;

  const jobMetadata = { source, mapping, lawfulBasis };

  const job = await prisma.marketingImportJob.create({
    data: {
      tenantId,
      filename,
      status: MarketingImportJobStatus.PROCESSING,
      errorsJson: jobMetadata,
    },
  });

  await logMarketingAudit(tenantId, 'import.started', 'MarketingImportJob', job.id, {
    filename,
    ...jobMetadata,
  }, actorFrom(req));

  try {
    const rows = parseCsvRows(csvText).filter((row) =>
      row.some((cell) => String(cell || '').trim())
    );

    if (!rows.length) {
      await prisma.marketingImportJob.update({
        where: { id: job.id },
        data: {
          status: MarketingImportJobStatus.FAILED,
          finishedAt: new Date(),
          errorsJson: { ...jobMetadata, message: 'No rows found' },
        },
      });
      await logMarketingAudit(tenantId, 'import.failed', 'MarketingImportJob', job.id, { reason: 'no_rows' }, actorFrom(req));
      return res.status(400).json({ ok: false, message: 'No rows found' });
    }

    const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const mappingValues = Object.values(mapping || {});
    const mappingUsesHeader = mappingValues.some((value) => typeof value === 'string' && value.trim());
    const emailHeaderIndex = headerRow.findIndex((value) => value === 'email' || value === 'e-mail');
    const hasHeader = mappingUsesHeader || emailHeaderIndex >= 0;
    const firstNameHeaderIndex = headerRow.findIndex((value) => value === 'first_name' || value === 'firstname');
    const lastNameHeaderIndex = headerRow.findIndex((value) => value === 'last_name' || value === 'lastname');
    const phoneHeaderIndex = headerRow.findIndex((value) => value === 'phone' || value === 'phone_number');
    const townHeaderIndex = headerRow.findIndex((value) => value === 'town' || value === 'city');
    const tagsHeaderIndex = headerRow.findIndex((value) => value === 'tags' || value === 'tag');
    const topicsHeaderIndex = headerRow.findIndex((value) => value === 'topics' || value === 'topic' || value === 'preferences');

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const emailIndex = resolveColumnIndex(headerRow, mapping.email, hasHeader ? emailHeaderIndex : 0);
    const firstNameIndex = resolveColumnIndex(headerRow, mapping.firstName, firstNameHeaderIndex);
    const lastNameIndex = resolveColumnIndex(headerRow, mapping.lastName, lastNameHeaderIndex);
    const phoneIndex = resolveColumnIndex(headerRow, mapping.phone, phoneHeaderIndex);
    const townIndex = resolveColumnIndex(headerRow, mapping.town, townHeaderIndex);
    const tagsIndex = resolveColumnIndex(headerRow, mapping.tags, tagsHeaderIndex);
    const topicsIndex = resolveColumnIndex(headerRow, mapping.topics, topicsHeaderIndex);

    if (emailIndex < 0) {
      await prisma.marketingImportJob.update({
        where: { id: job.id },
        data: {
          status: MarketingImportJobStatus.FAILED,
          finishedAt: new Date(),
          errorsJson: { ...jobMetadata, message: 'Email column not mapped' },
        },
      });
      await logMarketingAudit(tenantId, 'import.failed', 'MarketingImportJob', job.id, { reason: 'email_missing' }, actorFrom(req));
      return res.status(400).json({ ok: false, message: 'Email column not mapped' });
    }

    const uniqueEmails = new Set<string>();
    dataRows.forEach((row) => {
      const email = normaliseEmail(String(row[emailIndex] || ''));
      if (email) uniqueEmails.add(email);
    });

    const suppressionRecords = await prisma.marketingSuppression.findMany({
      where: { tenantId, email: { in: Array.from(uniqueEmails) } },
      select: { email: true, type: true },
    });
    const suppressionMap = new Map(
      suppressionRecords.map((record) => [record.email.toLowerCase(), record.type])
    );

    const existingContacts = await prisma.marketingContact.findMany({
      where: { tenantId, email: { in: Array.from(uniqueEmails) } },
      include: { consents: true },
    });
    const contactMap = new Map(
      existingContacts.map((contact) => [
        contact.email.toLowerCase(),
        {
          id: contact.id,
          consentStatus: contact.consents[0]?.status || null,
        },
      ])
    );

    const [existingTags, existingTopics] = await Promise.all([
      prisma.marketingTag.findMany({ where: { tenantId } }),
      prisma.marketingPreferenceTopic.findMany({ where: { tenantId } }),
    ]);
    const tagCache = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag.id]));
    const topicCache = new Map(existingTopics.map((topic) => [topic.name.toLowerCase(), topic.id]));

    const rowErrors: Array<{ jobId: string; rowNumber: number; email: string | null; error: string }> = [];
    let imported = 0;
    let skipped = 0;
    const seenEmails = new Set<string>();

    function cellValue(row: string[], index: number) {
      if (index < 0) return null;
      const value = String(row[index] || '').trim();
      return value ? value : null;
    }

    for (let i = 0; i < dataRows.length; i += 1) {
      const row = dataRows[i];
      const rowNumber = hasHeader ? i + 2 : i + 1;
      const email = normaliseEmail(String(row[emailIndex] || ''));

      if (!email) {
        skipped += 1;
        rowErrors.push({ jobId: job.id, rowNumber, email: null, error: 'Missing email' });
        continue;
      }
      if (!isValidEmail(email)) {
        skipped += 1;
        rowErrors.push({ jobId: job.id, rowNumber, email, error: 'Invalid email' });
        continue;
      }
      if (seenEmails.has(email)) {
        skipped += 1;
        rowErrors.push({ jobId: job.id, rowNumber, email, error: 'Duplicate email in import' });
        continue;
      }
      seenEmails.add(email);

      const suppression = suppressionMap.get(email) || null;
      const existingConsentStatus =
        contactMap.get(email)?.consentStatus || MarketingConsentStatus.TRANSACTIONAL_ONLY;
      const decision = shouldSuppressContact(existingConsentStatus as MarketingConsentStatus, suppression ? { type: suppression } : null);

      if (decision.suppressed) {
        skipped += 1;
        rowErrors.push({ jobId: job.id, rowNumber, email, error: 'Suppressed email' });
        continue;
      }

      const firstName = cellValue(row, firstNameIndex);
      const lastName = cellValue(row, lastNameIndex);
      const phone = cellValue(row, phoneIndex);
      const town = cellValue(row, townIndex);
      const tagValues = parseDelimitedList(cellValue(row, tagsIndex));
      const topicValues = parseDelimitedList(cellValue(row, topicsIndex));

      try {
        const contact = await prisma.marketingContact.upsert({
          where: { tenantId_email: { tenantId, email } },
          create: {
            tenantId,
            email,
            firstName,
            lastName,
            phone,
            town,
          },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            phone: phone || undefined,
            town: town || undefined,
          },
        });

        await prisma.marketingConsent.upsert({
          where: { tenantId_contactId: { tenantId, contactId: contact.id } },
          create: {
            tenantId,
            contactId: contact.id,
            status: MarketingConsentStatus.SUBSCRIBED,
            lawfulBasis,
            source: MarketingConsentSource.IMPORT_CSV,
            capturedAt: new Date(),
          },
          update: {
            status: MarketingConsentStatus.SUBSCRIBED,
            lawfulBasis,
            source: MarketingConsentSource.IMPORT_CSV,
            capturedAt: new Date(),
          },
        });

        for (const rawTag of tagValues) {
          const tagName = String(rawTag || '').trim();
          if (!tagName) continue;
          const tagKey = tagName.toLowerCase();
          let tagId = tagCache.get(tagKey);
          if (!tagId) {
            const tag = await prisma.marketingTag.create({
              data: { tenantId, name: tagName },
            });
            tagId = tag.id;
            tagCache.set(tagKey, tagId);
          }
          await prisma.marketingContactTag.upsert({
            where: { contactId_tagId: { contactId: contact.id, tagId } },
            create: { tenantId, contactId: contact.id, tagId },
            update: {},
          });
        }

        for (const rawTopic of topicValues) {
          const topicName = String(rawTopic || '').trim();
          if (!topicName) continue;
          const topicKey = topicName.toLowerCase();
          let topicId = topicCache.get(topicKey);
          if (!topicId) {
            const topic = await prisma.marketingPreferenceTopic.create({
              data: { tenantId, name: topicName },
            });
            topicId = topic.id;
            topicCache.set(topicKey, topicId);
          }
          await prisma.marketingContactPreference.upsert({
            where: { tenantId_contactId_topicId: { tenantId, contactId: contact.id, topicId } },
            create: { tenantId, contactId: contact.id, topicId, status: MarketingPreferenceStatus.SUBSCRIBED },
            update: { status: MarketingPreferenceStatus.SUBSCRIBED },
          });
        }

        imported += 1;
      } catch (_err) {
        skipped += 1;
        rowErrors.push({ jobId: job.id, rowNumber, email, error: 'Failed to import row' });
      }
    }

    if (rowErrors.length) {
      await prisma.marketingImportRowError.createMany({
        data: rowErrors.map((row) => ({
          jobId: row.jobId,
          rowNumber: row.rowNumber,
          email: row.email,
          error: row.error,
        })),
      });
    }

    const totalRows = dataRows.length;
    await prisma.marketingImportJob.update({
      where: { id: job.id },
      data: {
        status: MarketingImportJobStatus.COMPLETED,
        finishedAt: new Date(),
        totalRows,
        imported,
        skipped,
        errorsJson: { ...jobMetadata, total: rowErrors.length },
      },
    });

    await logMarketingAudit(tenantId, 'import.completed', 'MarketingImportJob', job.id, {
      totalRows,
      imported,
      skipped,
      errors: rowErrors.length,
    }, actorFrom(req));

    return res.json({
      ok: true,
      jobId: job.id,
      totalRows,
      imported,
      skipped,
      errors: rowErrors.length,
    });
  } catch (_err) {
    await prisma.marketingImportJob.update({
      where: { id: job.id },
      data: {
        status: MarketingImportJobStatus.FAILED,
        finishedAt: new Date(),
        errorsJson: { ...jobMetadata, message: 'Import failed' },
      },
    });
    await logMarketingAudit(tenantId, 'import.failed', 'MarketingImportJob', job.id, { reason: 'exception' }, actorFrom(req));
    return res.status(500).json({ ok: false, message: 'Import failed' });
  }
});

router.get('/api/marketing/imports', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const items = await prisma.marketingImportJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/imports/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id || '');
  const job = await prisma.marketingImportJob.findFirst({
    where: { id, tenantId },
  });
  if (!job) return res.status(404).json({ ok: false, message: 'Import not found' });

  const errors = await prisma.marketingImportRowError.findMany({
    where: { jobId: job.id },
    orderBy: { rowNumber: 'asc' },
  });

  res.json({ ok: true, job, errors });
});

router.get('/api/marketing/imports/:id/errors.csv', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id || '');
  const job = await prisma.marketingImportJob.findFirst({
    where: { id, tenantId },
  });
  if (!job) return res.status(404).json({ ok: false, message: 'Import not found' });

  const errors = await prisma.marketingImportRowError.findMany({
    where: { jobId: job.id },
    orderBy: { rowNumber: 'asc' },
  });

  const header = ['rowNumber', 'email', 'error'];
  const escapeCsv = (value: string | number | null) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };
  const csv = [header.join(','), ...errors.map((row) => [
    escapeCsv(row.rowNumber),
    escapeCsv(row.email || ''),
    escapeCsv(row.error || ''),
  ].join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="marketing-import-${job.id}-errors.csv"`);
  res.send(csv);
});

router.get('/api/marketing/imports/:id/audit', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id || '');
  const job = await prisma.marketingImportJob.findFirst({
    where: { id, tenantId },
  });
  if (!job) return res.status(404).json({ ok: false, message: 'Import not found' });

  const logs = await prisma.marketingAuditLog.findMany({
    where: { tenantId, entityType: 'MarketingImportJob', entityId: job.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ ok: true, logs });
});

router.get('/api/marketing/exports/contacts.csv', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const segmentId = String(req.query.segmentId || '').trim();
  const segment = segmentId
    ? await prisma.marketingSegment.findFirst({ where: { id: segmentId, tenantId } })
    : null;
  if (segmentId && !segment) {
    return res.status(404).json({ ok: false, message: 'Segment not found' });
  }

  const contacts = segment
    ? await evaluateSegmentContacts(tenantId, segment.rules)
    : (await prisma.marketingContact.findMany({
        where: { tenantId },
        include: {
          tags: { include: { tag: true } },
          consents: true,
          preferences: true,
        },
      })).map((contact) => ({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        town: contact.town,
        consentStatus: contact.consents[0]?.status || null,
        tags: contact.tags.map((tag) => tag.tag.name),
        preferences: contact.preferences.map((pref) => ({
          topicId: pref.topicId,
          status: String(pref.status || ''),
        })),
      }));

  const topicIds = Array.from(
    new Set(contacts.flatMap((contact) => contact.preferences.map((pref) => pref.topicId)))
  );
  const topics = topicIds.length
    ? await prisma.marketingPreferenceTopic.findMany({
        where: { tenantId, id: { in: topicIds } },
      })
    : [];
  const topicMap = new Map(topics.map((topic) => [topic.id, topic.name]));

  const emails = contacts.map((contact) => contact.email);
  const suppressions = emails.length
    ? await prisma.marketingSuppression.findMany({
        where: { tenantId, email: { in: emails } },
        select: { email: true, type: true },
      })
    : [];
  const suppressionMap = new Map(
    suppressions.map((record) => [record.email.toLowerCase(), record])
  );

  const rows = contacts
    .map((contact) => {
      const suppression = suppressionMap.get(contact.email.toLowerCase()) || null;
      const consentStatus =
        (contact.consentStatus as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
      const decision = shouldSuppressContact(consentStatus, suppression);
      return decision.suppressed ? null : contact;
    })
    .filter(Boolean) as typeof contacts;

  const header = [
    'email',
    'first_name',
    'last_name',
    'town',
    'tags',
    'topics',
    'consent_status',
  ];

  const csv = [header.join(','), ...rows.map((contact) => {
    const topicsLabel = contact.preferences
      .filter((pref) => String(pref.status || '').toUpperCase() === MarketingPreferenceStatus.SUBSCRIBED)
      .map((pref) => topicMap.get(pref.topicId) || pref.topicId)
      .filter(Boolean)
      .join('; ');
    return [
      escapeCsvValue(contact.email),
      escapeCsvValue(contact.firstName || ''),
      escapeCsvValue(contact.lastName || ''),
      escapeCsvValue(contact.town || ''),
      escapeCsvValue((contact.tags || []).join('; ')),
      escapeCsvValue(topicsLabel),
      escapeCsvValue(contact.consentStatus || ''),
    ].join(',');
  })].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="marketing-contacts${segment ? `-${segment.id}` : ''}.csv"`
  );
  res.send(csv);
});

router.get('/api/marketing/exports/segments.csv', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;

  const segments = await prisma.marketingSegment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  const header = ['segment_id', 'name', 'description', 'created_at', 'rules_json'];
  const csv = [header.join(','), ...segments.map((segment) => {
    return [
      escapeCsvValue(segment.id),
      escapeCsvValue(segment.name),
      escapeCsvValue(segment.description || ''),
      escapeCsvValue(segment.createdAt.toISOString()),
      escapeCsvValue(JSON.stringify(segment.rules || {})),
    ].join(',');
  })].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="marketing-segments.csv"');
  res.send(csv);
});

router.get('/api/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const items = await prisma.marketingSegment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/api/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const { name, description, rules } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

  const finalRules = rules || { rules: [] };
  const segment = await prisma.marketingSegment.create({
    data: {
      tenantId,
      name,
      description: description || null,
      rules: finalRules,
    },
  });
  await logMarketingAudit(tenantId, 'segment.created', 'MarketingSegment', segment.id, {
    name,
    description: description || null,
    rules: finalRules,
  }, actorFrom(req));
  res.json({ ok: true, segment });
});

router.put('/api/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const { name, description, rules } = req.body || {};

  const existing = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const segment = await prisma.marketingSegment.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description ?? undefined,
      rules: rules || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'segment.updated', 'MarketingSegment', segment.id, {
    name,
    description: description ?? null,
    rules: rules || null,
  }, actorFrom(req));
  res.json({ ok: true, segment });
});

router.delete('/api/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const existing = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Segment not found' });
  await prisma.marketingSegment.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'segment.deleted', 'MarketingSegment', id, undefined, actorFrom(req));
  res.json({ ok: true });
});

router.get('/api/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });
  const response = { ok: true, segment };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/api/marketing/segments/:id/estimate', marketingEstimateLimiter, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const estimate = await estimateCampaignRecipients(tenantId, segment.rules);
  res.json({ ok: true, estimate });
});

router.post('/api/marketing/segments/:id/evaluate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });
  const estimate = await estimateCampaignRecipients(tenantId, segment.rules);
  const contacts = await evaluateSegmentContacts(tenantId, segment.rules);
  const response = { ok: true, estimate, sample: contacts.slice(0, 25) };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/api/marketing/segments/estimate', marketingEstimateLimiter, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const { rules } = req.body || {};
  const estimate = await estimateCampaignRecipients(tenantId, rules || { rules: [] });
  res.json({ ok: true, estimate });
});

router.get('/api/email-templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingEmailTemplate.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { versions: true } } },
  });
  res.json({
    ok: true,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      subject: item.subject,
      updatedAt: item.updatedAt,
      versionCount: item._count.versions,
    })),
  });
});

router.post('/api/email-templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, subject, document, showId } = req.body || {};
  if (!name || !subject || !document) {
    return res.status(400).json({ ok: false, message: 'Name, subject, and document are required' });
  }

  const show = await withShowAvailability(await fetchTemplateShow(tenantId, showId));
  const upcoming = await fetchUpcomingShows(tenantId, show?.id || null);
  const { html } = renderEmailDocument(document, {
    show: show || undefined,
    upcomingShows: upcoming,
    baseUrl: PUBLIC_BASE_URL,
    personalisation: buildPreviewPersonalisationContext({
      showTitle: show?.title || null,
      venueName: show?.venue?.name || null,
      topCategory: show?.eventCategory || null,
    }),
  });

  const template = await prisma.marketingEmailTemplate.create({
    data: {
      tenantId,
      name: String(name),
      subject: String(subject),
      showId: show?.id || null,
    },
  });

  const version = await prisma.marketingEmailTemplateVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      document,
      html,
    },
  });

  await prisma.marketingEmailTemplate.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  res.json({ ok: true, template: { ...template, currentVersionId: version.id } });
});

router.get('/api/email-templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const template = await prisma.marketingEmailTemplate.findFirst({
    where: { id, tenantId },
    include: { versions: { orderBy: { createdAt: 'desc' } } },
  });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const currentVersion =
    template.versions.find((version) => version.id === template.currentVersionId) || template.versions[0];

  res.json({
    ok: true,
    template: {
      id: template.id,
      name: template.name,
      subject: template.subject,
      showId: template.showId,
      currentVersionId: template.currentVersionId,
    },
    versions: template.versions.map((version) => ({
      id: version.id,
      version: version.version,
      createdAt: version.createdAt,
    })),
    document: currentVersion?.document || null,
  });
});

router.post('/api/email-templates/:id/versions', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, subject, document, showId } = req.body || {};
  const template = await prisma.marketingEmailTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });
  if (!document) return res.status(400).json({ ok: false, message: 'Document is required' });

  const lastVersion = await prisma.marketingEmailTemplateVersion.findFirst({
    where: { templateId: id },
    orderBy: { version: 'desc' },
  });
  const nextVersion = (lastVersion?.version || 0) + 1;

  const show = await withShowAvailability(await fetchTemplateShow(tenantId, showId || template.showId || undefined));
  const upcoming = await fetchUpcomingShows(tenantId, show?.id || null);
  const { html } = renderEmailDocument(document, {
    show: show || undefined,
    upcomingShows: upcoming,
    baseUrl: PUBLIC_BASE_URL,
    personalisation: buildPreviewPersonalisationContext({
      showTitle: show?.title || null,
      venueName: show?.venue?.name || null,
      topCategory: show?.eventCategory || null,
    }),
  });

  const version = await prisma.marketingEmailTemplateVersion.create({
    data: {
      templateId: id,
      version: nextVersion,
      document,
      html,
    },
  });

  const updated = await prisma.marketingEmailTemplate.update({
    where: { id },
    data: {
      name: name ? String(name) : template.name,
      subject: subject ? String(subject) : template.subject,
      showId: show?.id || null,
      currentVersionId: version.id,
    },
  });

  res.json({ ok: true, template: updated, version });
});

router.post('/api/email-templates/:id/rollback', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { versionId } = req.body || {};
  if (!versionId) return res.status(400).json({ ok: false, message: 'Version ID required' });

  const template = await prisma.marketingEmailTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const version = await prisma.marketingEmailTemplateVersion.findFirst({
    where: { id: String(versionId), templateId: id },
  });
  if (!version) return res.status(404).json({ ok: false, message: 'Version not found' });

  const updated = await prisma.marketingEmailTemplate.update({
    where: { id },
    data: { currentVersionId: version.id },
  });

  res.json({ ok: true, template: updated });
});

router.post('/api/email-templates/render', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { document, showId } = req.body || {};
  if (!document) return res.status(400).json({ ok: false, message: 'Document is required' });

  const show = await withShowAvailability(await fetchTemplateShow(tenantId, showId));
  const upcoming = await fetchUpcomingShows(tenantId, show?.id || null);
  const { html } = renderEmailDocument(document, {
    show: show || undefined,
    upcomingShows: upcoming,
    baseUrl: PUBLIC_BASE_URL,
    personalisation: buildPreviewPersonalisationContext({
      showTitle: show?.title || null,
      venueName: show?.venue?.name || null,
      topCategory: show?.eventCategory || null,
    }),
  });

  res.json({ ok: true, html });
});

router.post('/api/marketing/segments/:id/estimate', marketingEstimateLimiter, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const rulesOverride = req.body?.rules;
  const estimate = await estimateCampaignRecipients(tenantId, rulesOverride || segment.rules);
  res.json({ ok: true, estimate });
});

router.get('/api/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const items = await prisma.marketingTemplate.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      changeRequests: {
        where: { status: MarketingTemplateChangeStatus.PENDING },
        select: { id: true, requestedAt: true, requestedByUserId: true, message: true },
      },
      versions: {
        select: { version: true, createdAt: true },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
  res.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      latestVersion: item.versions[0]?.version || 0,
      pendingChangeRequests: item.changeRequests,
    })),
  });
});

router.get('/api/marketing/automations/presets', requireAdminOrOrganiser, async (_req, res) => {
  res.json({ ok: true, presets: automationPresets() });
});

router.post('/api/marketing/automations/presets/enable', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const {
    presetId,
    showId,
    templateId,
    automationName,
    audienceMode,
    audienceValue,
    category,
    isEnabled,
  } = req.body || {};

  const preset = automationPresets().find((item) => item.id === presetId);
  if (!preset) return res.status(404).json({ ok: false, message: 'Preset not found' });
  if (!showId || !templateId) {
    return res.status(400).json({ ok: false, message: 'Show and template required' });
  }

  const show = await prisma.show.findFirst({
    where: { id: showId, organiserId: tenantId },
    select: {
      id: true,
      title: true,
      date: true,
      eventCategory: true,
      eventType: true,
      tags: true,
      venue: { select: { city: true, county: true } },
    },
  });
  if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

  const template = await prisma.marketingTemplate.findFirst({ where: { id: templateId, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const normalizedMode = String(audienceMode || 'county').toLowerCase() === 'town' ? 'town' : 'county';
  const defaultLocation =
    normalizedMode === 'town' ? show.venue?.city || '' : show.venue?.county || '';
  const locationValue = String(audienceValue || defaultLocation || '').trim();
  const defaultCategory =
    category ||
    show.eventCategory ||
    (Array.isArray(show.tags) && show.tags.length ? show.tags[0] : '') ||
    show.eventType ||
    '';
  const categoryValue = String(defaultCategory || '').trim();

  const rules: SegmentRule[] = [];
  if (locationValue) {
    if (normalizedMode === 'town') {
      rules.push({ type: 'PURCHASED_TOWN_IS', value: locationValue });
    } else {
      rules.push({ type: 'PURCHASED_COUNTY_IS', value: locationValue });
    }
  }
  if (categoryValue) {
    rules.push({ type: 'PURCHASED_CATEGORY_CONTAINS', value: categoryValue });
  }

  const triggerConfig = (() => {
    if (preset.triggerType === MarketingAutomationTriggerType.DAYS_BEFORE_SHOW) {
      return { daysBefore: preset.daysBefore ?? 3, showId: show.id };
    }
    if (preset.triggerType === MarketingAutomationTriggerType.MONTHLY_ROUNDUP) {
      return { showId: show.id, county: normalizedMode === 'county' ? locationValue || null : null };
    }
    if (preset.triggerType === MarketingAutomationTriggerType.LOW_SALES_VELOCITY) {
      return { showId: show.id };
    }
    return { showId: show.id };
  })();

  const automation = await prisma.marketingAutomation.create({
    data: {
      tenantId,
      name: automationName || `${preset.label}: ${show.title || 'Show'}`,
      triggerType: preset.triggerType,
      triggerConfig: triggerConfig || undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    },
  });

  const step = await prisma.marketingAutomationStep.create({
    data: {
      tenantId,
      automationId: automation.id,
      stepType: MarketingAutomationStepType.SEND_EMAIL,
      templateId: template.id,
      stepOrder: 1,
      conditionRules: rules.length ? { rules } : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.created', automation.id, { presetId });
  await recordAutomationAudit(tenantId, 'automation.step.created', automation.id, { stepId: step.id, presetId });

  res.json({ ok: true, automation, step });
});

router.get('/api/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingAutomation.findMany({
    where: { tenantId },
    include: { steps: { include: { template: true }, orderBy: { stepOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const automation = await prisma.marketingAutomation.findFirst({
    where: { id, tenantId },
    include: { steps: { include: { template: true }, orderBy: { stepOrder: 'asc' } } },
  });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });
  res.json({ ok: true, automation });
});

router.post('/api/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, triggerType, triggerConfig, isEnabled, flowJson } = req.body || {};
  if (!name || !triggerType) return res.status(400).json({ ok: false, message: 'Name + trigger required' });

  const automation = await prisma.marketingAutomation.create({
    data: {
      tenantId,
      name,
      triggerType: triggerType as MarketingAutomationTriggerType,
      triggerConfig: triggerConfig || undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
      flowJson: flowJson || null,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.created', automation.id, { triggerType });

  res.json({ ok: true, automation });
});

router.put('/api/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, triggerType, triggerConfig, isEnabled, flowJson } = req.body || {};

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const automation = await prisma.marketingAutomation.update({
    where: { id },
    data: {
      name: name || undefined,
      triggerType: triggerType || undefined,
      triggerConfig: triggerConfig || undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
      flowJson: flowJson !== undefined ? flowJson : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.updated', automation.id, { triggerType, isEnabled });

  res.json({ ok: true, automation });
});

router.put('/api/marketing/automations/:id/flow', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { flowJson } = req.body || {};
  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const updated = await prisma.marketingAutomation.update({
    where: { id },
    data: { flowJson: flowJson || null, version: { increment: 1 } },
  });
  await recordAutomationAudit(tenantId, 'automation.flow.updated', updated.id, {});
  console.info('[marketing:automation:flow]', { automationId: id, tenantId });
  res.json({ ok: true, automation: updated });
});

router.post('/api/marketing/automations/:id/validate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const automation = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const flow = resolveFlowState(automation.flowJson);
  const nodes = req.body?.nodes || flow.nodes;
  const edges = req.body?.edges || flow.edges;
  const errors = validateFlow(nodes, edges);
  res.json({ ok: errors.length === 0, errors });
});

router.post('/api/marketing/automations/:id/flow/steps', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const automation = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const flow = resolveFlowState(automation.flowJson);
  const nodes = req.body?.nodes || flow.nodes;
  const edges = req.body?.edges || flow.edges;
  const errors = validateFlow(nodes, edges);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const steps = buildStepsFromFlow(nodes, edges);
  await prisma.marketingAutomationStep.deleteMany({ where: { automationId: id, tenantId } });
  const created = await prisma.marketingAutomationStep.createMany({
    data: steps.map((step) => ({ ...step, tenantId, automationId: id })),
  });
  await recordAutomationAudit(tenantId, 'automation.steps.generated', id, { count: created.count });
  res.json({ ok: true, count: created.count });
});

router.post('/api/marketing/automations/:id/simulate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const automation = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const contacts = await prisma.marketingContact.findMany({
    where: { tenantId },
    select: { id: true, email: true, firstName: true, lastName: true },
    take: 25,
  });
  const count = await prisma.marketingContact.count({ where: { tenantId } });

  res.json({
    ok: true,
    total: count,
    sample: contacts,
    note: 'Simulation uses current marketing contacts as an estimate.',
  });
});

router.delete('/api/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  await prisma.marketingAutomation.delete({ where: { id } });
  await recordAutomationAudit(tenantId, 'automation.deleted', id);
  res.json({ ok: true });
});

router.post('/api/marketing/automations/:id/steps', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const { delayMinutes, templateId, conditionRules, stepOrder, stepType, stepConfig, throttleMinutes, quietHoursStart, quietHoursEnd } = req.body || {};
  if (stepOrder === undefined) {
    return res.status(400).json({ ok: false, message: 'Step order required' });
  }
  const resolvedStepType = (stepType || MarketingAutomationStepType.SEND_EMAIL) as MarketingAutomationStepType;
  if (resolvedStepType === MarketingAutomationStepType.SEND_EMAIL && !templateId) {
    return res.status(400).json({ ok: false, message: 'Template required for send email step' });
  }

  const automation = await prisma.marketingAutomation.findFirst({ where: { id: automationId, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const step = await prisma.marketingAutomationStep.create({
    data: {
      tenantId,
      automationId,
      delayMinutes: Number(delayMinutes || 0),
      templateId: templateId || null,
      conditionRules: conditionRules || undefined,
      stepType: resolvedStepType,
      stepConfig: stepConfig || undefined,
      throttleMinutes: Number(throttleMinutes || 0),
      quietHoursStart: quietHoursStart !== undefined && quietHoursStart !== null ? Number(quietHoursStart) : null,
      quietHoursEnd: quietHoursEnd !== undefined && quietHoursEnd !== null ? Number(quietHoursEnd) : null,
      stepOrder: Number(stepOrder),
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.created', automationId, { stepId: step.id });
  res.json({ ok: true, step });
});

router.put('/api/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const stepId = String(req.params.stepId);
  const { delayMinutes, templateId, conditionRules, stepOrder, stepType, stepConfig, throttleMinutes, quietHoursStart, quietHoursEnd } = req.body || {};

  const existing = await prisma.marketingAutomationStep.findFirst({
    where: { id: stepId, tenantId, automationId },
  });
  if (!existing) return res.status(404).json({ ok: false, message: 'Step not found' });

  const step = await prisma.marketingAutomationStep.update({
    where: { id: stepId },
    data: {
      delayMinutes: delayMinutes !== undefined ? Number(delayMinutes) : undefined,
      templateId: templateId !== undefined ? templateId : undefined,
      conditionRules: conditionRules || undefined,
      stepType: stepType || undefined,
      stepConfig: stepConfig || undefined,
      throttleMinutes: throttleMinutes !== undefined ? Number(throttleMinutes) : undefined,
      quietHoursStart: quietHoursStart !== undefined ? (quietHoursStart !== null ? Number(quietHoursStart) : null) : undefined,
      quietHoursEnd: quietHoursEnd !== undefined ? (quietHoursEnd !== null ? Number(quietHoursEnd) : null) : undefined,
      stepOrder: stepOrder !== undefined ? Number(stepOrder) : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.updated', automationId, { stepId });
  res.json({ ok: true, step });
});

router.delete('/api/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const stepId = String(req.params.stepId);

  const existing = await prisma.marketingAutomationStep.findFirst({
    where: { id: stepId, tenantId, automationId },
  });
  if (!existing) return res.status(404).json({ ok: false, message: 'Step not found' });

  await prisma.marketingAutomationStep.delete({ where: { id: stepId } });
  await recordAutomationAudit(tenantId, 'automation.step.deleted', automationId, { stepId });
  res.json({ ok: true });
});

router.get('/api/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  await ensureDefaultPreferenceTopics(tenantId);
  const items = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/tags', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingTag.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/automations/runs', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.query?.automationId || '').trim();
  const items = await prisma.marketingAutomationRun.findMany({
    where: { tenantId, ...(automationId ? { automationId } : {}) },
    orderBy: { startedAt: 'desc' },
    take: 200,
    include: { contact: true, automation: true },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/automations/runs/:runId/steps', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const runId = String(req.params.runId);
  const run = await prisma.marketingAutomationRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return res.status(404).json({ ok: false, message: 'Run not found' });
  const items = await prisma.marketingAutomationStepExecution.findMany({
    where: {
      tenantId,
      automationId: run.automationId,
      contactId: run.contactId,
      triggerKey: run.triggerKey,
    },
    include: { step: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/consent/summary', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const consentGroups = await prisma.marketingConsent.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { _all: true },
  });
  const suppressionGroups = await prisma.marketingSuppression.groupBy({
    by: ['type'],
    where: { tenantId },
    _count: { _all: true },
  });
  const contactCount = await prisma.marketingContact.count({ where: { tenantId } });

  const consentCounts = consentGroups.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});
  const suppressionCounts = suppressionGroups.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = item._count._all;
    return acc;
  }, {});

  res.json({
    ok: true,
    summary: {
      contacts: contactCount,
      consents: consentCounts,
      suppressions: suppressionCounts,
    },
  });
});

router.get('/api/marketing/consent/check', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const contact = await prisma.marketingContact.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true },
  });
  const consent = contact
    ? await prisma.marketingConsent.findUnique({
        where: { tenantId_contactId: { tenantId, contactId: contact.id } },
        select: { status: true },
      })
    : null;
  const suppression = await prisma.marketingSuppression.findFirst({
    where: { tenantId, email },
    select: { type: true },
  });
  const decision = shouldSuppressContact(
    (consent?.status as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY,
    suppression
  );

  res.json({
    ok: true,
    result: {
      email,
      consentStatus: consent?.status || MarketingConsentStatus.TRANSACTIONAL_ONLY,
      suppressionType: suppression?.type || null,
      suppressed: decision.suppressed,
      reason: decision.reason,
    },
  });
});

router.post('/api/marketing/step-up', requireAdminOrOrganiser, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) {
    return res.status(400).json({ ok: false, message: 'Password required' });
  }

  const actorId = req.user?.id || null;
  try {
    const user = await prisma.user.findUnique({ where: { id: actorId || '' } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ ok: false, message: 'Invalid user' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    setMarketingStepUpCookie(req, res, user.id);
    await logMarketingAudit(
      tenantIdFrom(req),
      'deliverability.step_up',
      'MarketingDeliverability',
      null,
      { status: 'success' },
      actorFrom(req)
    );
    return res.json({ ok: true });
  } catch (error) {
    await logMarketingAudit(
      tenantIdFrom(req),
      'deliverability.step_up',
      'MarketingDeliverability',
      null,
      { status: 'error' },
      actorFrom(req)
    );
    return res.status(500).json({ ok: false, message: 'Failed to confirm step-up' });
  }
});

router.post('/api/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, description, isDefault } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

  const topic = await prisma.marketingPreferenceTopic.create({
    data: {
      tenantId,
      name,
      description: description || null,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : true,
    },
  });

  await recordPreferenceAudit(tenantId, 'preferences.topic.created', topic.id, { name });
  res.json({ ok: true, topic });
});

router.put('/api/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, description, isDefault } = req.body || {};

  const existing = await prisma.marketingPreferenceTopic.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Topic not found' });

  const topic = await prisma.marketingPreferenceTopic.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description ?? undefined,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
    },
  });

  await recordPreferenceAudit(tenantId, 'preferences.topic.updated', topic.id, { name, isDefault });
  res.json({ ok: true, topic });
});

router.delete('/api/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingPreferenceTopic.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Topic not found' });

  await prisma.marketingPreferenceTopic.delete({ where: { id } });
  await recordPreferenceAudit(tenantId, 'preferences.topic.deleted', id);
  res.json({ ok: true });
});

router.get('/api/marketing/deliverability/summary', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const summary = await fetchDeliverabilitySummary(tenantId, days);
  await recordDeliverabilityAudit(tenantId, { days });
  res.json({ ok: true, summary });
});

router.get('/api/marketing/deliverability/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const items = await fetchCampaignDeliverability(tenantId, days);
  res.json({ ok: true, items });
});

router.get('/api/marketing/deliverability/top-segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const items = await fetchTopSegmentsByEngagement(tenantId, days);
  res.json({ ok: true, items });
});

router.get('/api/marketing/deliverability/warmup', requireAdminOrOrganiser, async (_req, res) => {
  res.json({ ok: true, data: warmupPresets() });
});

router.get('/api/marketing/suppressions', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 25) || 25));
  const where: Prisma.MarketingSuppressionWhereInput = {
    tenantId,
    ...(search ? { email: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.marketingSuppression.count({ where }),
    prisma.marketingSuppression.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    ok: true,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map((item) => ({
      id: item.id,
      email: item.email,
      type: item.type,
      reason: item.reason,
      createdAt: item.createdAt,
    })),
  });
});

router.delete('/api/marketing/suppressions/:id', requireAdminOrOrganiser, requireMarketingStepUp, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const suppression = await prisma.marketingSuppression.findFirst({ where: { id, tenantId } });
  if (!suppression) return res.status(404).json({ ok: false, message: 'Suppression not found' });

  await prisma.marketingSuppression.delete({ where: { id: suppression.id } });
  await recordSuppressionAudit(tenantId, 'suppression.removed', suppression.id, {
    email: suppression.email,
    type: suppression.type,
    reason: suppression.reason || null,
  });
  res.json({ ok: true });
});

router.get('/api/marketing/approvals', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;

  const [campaigns, templateChanges] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where: { tenantId, status: MarketingCampaignStatus.APPROVAL_REQUIRED },
      orderBy: { updatedAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, subject: true } },
        segment: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.marketingTemplateChangeRequest.findMany({
      where: { tenantId, status: MarketingTemplateChangeStatus.PENDING },
      orderBy: { requestedAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, subject: true } },
        requestedBy: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  res.json({ ok: true, campaigns, templateChanges });
});

router.get('/api/marketing/roles', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;

  const assignments = await prisma.marketingRoleAssignment.findMany({
    where: { tenantId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    ok: true,
    currentRole: role,
    assignments,
  });
});

router.post('/api/marketing/roles', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;

  const requestedRole = String(req.body?.role || '').toUpperCase();
  if (!Object.values(MarketingGovernanceRole).includes(requestedRole as MarketingGovernanceRole)) {
    return res.status(400).json({ ok: false, message: 'Invalid role' });
  }

  const userId = String(req.body?.userId || '');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const assignment = await prisma.marketingRoleAssignment.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: { role: requestedRole as MarketingGovernanceRole },
    create: { tenantId, userId: user.id, role: requestedRole as MarketingGovernanceRole },
  });

  await logMarketingAudit(
    tenantId,
    'role.assignment.updated',
    'MarketingRoleAssignment',
    assignment.id,
    { userId: user.id, role: assignment.role },
    actorFrom(req)
  );

  res.json({ ok: true, assignment });
});

router.get('/api/marketing/audit-logs', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;

  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 25) || 25));
  const [total, logs] = await Promise.all([
    prisma.marketingAuditLog.count({ where: { tenantId } }),
    prisma.marketingAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, email: true, name: true } } },
    }),
  ]);

  res.json({
    ok: true,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    logs,
  });
});

router.post('/api/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody, previewText, editorType, editorStateJson, compiledHtml, compiledText } =
    req.body || {};
  if (!name || !subject) {
    return res.status(400).json({ ok: false, message: 'Missing template fields' });
  }

  const safeMjml = mjmlBody ? injectPreviewText(mjmlBody, previewText) : '<mjml><mj-body></mj-body></mjml>';

  const template = await prisma.marketingTemplate.create({
    data: {
      tenantId,
      name,
      subject,
      previewText: previewText ? String(previewText).trim() : null,
      fromName: String(fromName || '').trim(),
      fromEmail: String(fromEmail || '').trim(),
      replyTo: replyTo ? String(replyTo).trim() : null,
      mjmlBody: safeMjml,
      editorType: editorType ? String(editorType) : 'GRAPESJS',
      editorStateJson: editorStateJson || null,
      compiledHtml: compiledHtml || null,
      compiledText: compiledText || null,
    },
  });
  await createTemplateVersion(template, req.user?.id);
  await logMarketingAudit(tenantId, 'template.created', 'MarketingTemplate', template.id, { name }, actorFrom(req));
  res.json({ ok: true, template });
});

router.get('/api/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });
  res.json({ ok: true, template });
});

router.put('/api/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody, previewText, editorType, editorStateJson, compiledHtml, compiledText } =
    req.body || {};

  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });

  const nextTemplate = {
    name: name !== undefined ? String(name).trim() : existing.name,
    subject: subject !== undefined ? String(subject).trim() : existing.subject,
    previewText: previewText !== undefined ? String(previewText || '').trim() || null : existing.previewText,
    fromName: fromName !== undefined ? String(fromName || '').trim() : existing.fromName,
    fromEmail: fromEmail !== undefined ? String(fromEmail || '').trim() : existing.fromEmail,
    replyTo: replyTo !== undefined ? (replyTo ? String(replyTo).trim() : null) : existing.replyTo,
    mjmlBody: mjmlBody ? injectPreviewText(mjmlBody, previewText) : existing.mjmlBody,
    editorType: editorType !== undefined ? String(editorType) : existing.editorType,
    editorStateJson: editorStateJson !== undefined ? editorStateJson : existing.editorStateJson,
    compiledHtml: compiledHtml !== undefined ? compiledHtml : existing.compiledHtml,
    compiledText: compiledText !== undefined ? compiledText : existing.compiledText,
  };

  if (existing.isLocked) {
    const changeRequest = await prisma.marketingTemplateChangeRequest.create({
      data: {
        tenantId,
        templateId: existing.id,
        payload: nextTemplate,
        message: String(req.body?.message || '').trim() || null,
        requestedByUserId: req.user?.id || null,
      },
    });
    await logMarketingAudit(
      tenantId,
      'template.change.requested',
      'MarketingTemplate',
      existing.id,
      { changeRequestId: changeRequest.id },
      actorFrom(req)
    );
    return res.json({ ok: true, approvalRequired: true, changeRequest });
  }

  const template = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      ...nextTemplate,
    },
  });
  await createTemplateVersion(template, req.user?.id);
  await logMarketingAudit(tenantId, 'template.updated', 'MarketingTemplate', template.id, { name }, actorFrom(req));
  res.json({ ok: true, template });
});

router.delete('/api/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);
  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });
  await prisma.marketingTemplate.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'template.deleted', 'MarketingTemplate', id, undefined, actorFrom(req));
  res.json({ ok: true });
});

router.post('/api/marketing/templates/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) return res.status(404).json({ ok: false, message: 'Tenant not found' });

  const email = String(req.body?.sample?.email || 'sample@example.com');
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(preferencesToken)}`;
  const show = await fetchTemplateShow(tenantId, req.body?.showId || req.body?.sample?.showId);
  const showUrl = show ? resolveShowUrl(show) : '';

  const sampleContact = {
    firstName: req.body?.sample?.firstName || 'Sample',
    lastName: req.body?.sample?.lastName || 'User',
    email,
    town: show?.venue?.city || '',
    county: show?.venue?.county || '',
  };

  if (template.compiledHtml) {
    const mergeContext = buildTemplateMergeContext({
      contact: sampleContact,
      show: {
        title: show?.title || '',
        venue: show?.venue?.name || '',
        date: show?.date || null,
      },
      links: {
        ticketLink: showUrl || '',
        managePreferencesLink: preferencesUrl,
        unsubscribeLink: unsubscribeUrl,
      },
    });
    const compiledHtml = renderCompiledTemplate({
      compiledHtml: template.compiledHtml,
      mergeContext,
      unsubscribeUrl,
      preferencesUrl,
      showContext: {
        showTitle: show?.title || '',
        showDate: formatShowDate(show?.date),
        showVenue: show?.venue?.name || '',
        showTown: show?.venue?.city || '',
        showCounty: show?.venue?.county || '',
        showUrl,
      },
    });
    return res.json({ ok: true, html: compiledHtml, errors: [] });
  }

  const { html, errors } = renderMarketingTemplate(template.mjmlBody, {
    firstName: sampleContact.firstName,
    lastName: sampleContact.lastName,
    email,
    tenantName: tenantNameFrom(tenant),
    unsubscribeUrl,
    preferencesUrl,
    showTitle: show?.title || '',
    showDate: formatShowDate(show?.date),
    showVenue: show?.venue?.name || '',
    showTown: show?.venue?.city || '',
    showCounty: show?.venue?.county || '',
    showUrl,
  });

  res.json({ ok: true, html, errors });
});

router.post('/api/marketing/templates/:id/compile', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const editorStateJson = req.body?.editorStateJson ?? template.editorStateJson;
  const compiled = compileEditorHtml(editorStateJson || null);

  const updated = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      editorStateJson: editorStateJson || null,
      compiledHtml: compiled.compiledHtml,
      lastCompiledAt: new Date(),
      version: { increment: 1 },
    },
  });

  console.info('[marketing:template:compile]', { templateId: id, tenantId, htmlBytes: compiled.compiledHtml.length });
  res.json({ ok: true, compiledHtml: compiled.compiledHtml, template: updated });
});

router.post('/api/marketing/templates/:id/test-send', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const recipientEmail = String(req.body?.email || '').trim();
  if (!recipientEmail) {
    return res.status(400).json({ ok: false, message: 'Recipient email required.' });
  }
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const settings = await fetchMarketingSettings(tenantId);
  const sender = resolveSenderDetails({
    templateFromName: template.fromName,
    templateFromEmail: template.fromEmail,
    templateReplyTo: template.replyTo,
    settings,
  });
  if (!sender.fromEmail) {
    return res.status(400).json({ ok: false, message: 'From email required for marketing sends.' });
  }
  if (!sender.fromName) {
    return res.status(400).json({ ok: false, message: 'From name required for marketing sends.' });
  }
  const provider = getEmailProvider(settings);

  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(tenantId)}/${encodeURIComponent(
    createUnsubscribeToken({ tenantId, email: recipientEmail })
  )}`;
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    tenantId
  )}/${encodeURIComponent(createPreferencesToken({ tenantId, email: recipientEmail }))}`;

  const mergeContext = buildTemplateMergeContext({
    contact: { firstName: 'Test', lastName: 'Recipient', email: recipientEmail },
    links: {
      managePreferencesLink: preferencesUrl,
      unsubscribeLink: unsubscribeUrl,
    },
  });

  let html = '';
  let errors: string[] = [];
  if (template.compiledHtml) {
    html = renderCompiledTemplate({
      compiledHtml: template.compiledHtml,
      mergeContext,
      unsubscribeUrl,
      preferencesUrl,
    });
  } else {
    const rendered = renderMarketingTemplate(template.mjmlBody, {
      firstName: 'Test',
      lastName: 'Recipient',
      email: recipientEmail,
      tenantName: 'TixAll',
      unsubscribeUrl,
      preferencesUrl,
    });
    html = rendered.html;
    errors = rendered.errors;
  }

  if (errors.length) {
    return res.status(400).json({ ok: false, message: errors.join('; ') });
  }

  const result = await provider.sendEmail({
    to: recipientEmail,
    subject: `[Test] ${template.subject}`,
    html,
    fromName: sender.fromName,
    fromEmail: applyMarketingStreamToEmail(sender.fromEmail, settings),
    replyTo: sender.replyTo,
  });

  console.info('[marketing:template:test-send]', {
    templateId: template.id,
    tenantId,
    providerId: result.id,
    providerStatus: result.status,
    providerResponse: result.response || null,
  });

  res.json({ ok: true, result });
});

router.post('/api/marketing/templates/:id/lock', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);
  const isLocked = Boolean(req.body?.isLocked);
  const reason = String(req.body?.reason || '').trim() || null;
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const updated = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      isLocked,
      lockedAt: isLocked ? new Date() : null,
      lockedByUserId: isLocked ? req.user?.id || null : null,
      lockReason: isLocked ? reason : null,
    },
  });

  await logMarketingAudit(
    tenantId,
    isLocked ? 'template.locked' : 'template.unlocked',
    'MarketingTemplate',
    id,
    { reason },
    actorFrom(req)
  );
  res.json({ ok: true, template: updated });
});

router.get('/api/marketing/templates/:id/versions', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const versions = await prisma.marketingTemplateVersion.findMany({
    where: { templateId: id },
    orderBy: { version: 'desc' },
    include: { createdBy: { select: { id: true, email: true, name: true } } },
  });
  res.json({ ok: true, versions });
});

router.post('/api/marketing/templates/:id/rollback', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);
  const versionId = req.body?.versionId ? String(req.body.versionId) : null;
  const versionNumber = req.body?.version ? Number(req.body.version) : null;

  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const version = await prisma.marketingTemplateVersion.findFirst({
    where: {
      templateId: id,
      ...(versionId ? { id: versionId } : {}),
      ...(versionNumber ? { version: versionNumber } : {}),
    },
  });
  if (!version) return res.status(404).json({ ok: false, message: 'Template version not found' });

  const updated = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      name: version.name,
      subject: version.subject,
      previewText: version.previewText,
      fromName: version.fromName,
      fromEmail: version.fromEmail,
      replyTo: version.replyTo,
      mjmlBody: version.mjmlBody,
    },
  });

  await createTemplateVersion(updated, req.user?.id);
  await logMarketingAudit(
    tenantId,
    'template.rolled_back',
    'MarketingTemplate',
    id,
    { version: version.version },
    actorFrom(req)
  );

  res.json({ ok: true, template: updated });
});

router.post('/api/marketing/templates/changes/:id/approve', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);

  const changeRequest = await prisma.marketingTemplateChangeRequest.findFirst({
    where: { id, tenantId },
  });
  if (!changeRequest || changeRequest.status !== MarketingTemplateChangeStatus.PENDING) {
    return res.status(404).json({ ok: false, message: 'Change request not found' });
  }

  const template = await prisma.marketingTemplate.findFirst({
    where: { id: changeRequest.templateId, tenantId },
  });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const payload = changeRequest.payload as Record<string, any>;
  const updated = await prisma.marketingTemplate.update({
    where: { id: template.id },
    data: {
      name: payload.name ?? template.name,
      subject: payload.subject ?? template.subject,
      previewText: payload.previewText ?? template.previewText,
      fromName: payload.fromName ?? template.fromName,
      fromEmail: payload.fromEmail ?? template.fromEmail,
      replyTo: payload.replyTo ?? template.replyTo,
      mjmlBody: payload.mjmlBody ?? template.mjmlBody,
      editorType: payload.editorType ?? template.editorType,
      editorStateJson: payload.editorStateJson ?? template.editorStateJson,
      compiledHtml: payload.compiledHtml ?? template.compiledHtml,
      compiledText: payload.compiledText ?? template.compiledText,
    },
  });

  await prisma.marketingTemplateChangeRequest.update({
    where: { id: changeRequest.id },
    data: {
      status: MarketingTemplateChangeStatus.APPROVED,
      approvedByUserId: req.user?.id || null,
      reviewedAt: new Date(),
    },
  });

  await createTemplateVersion(updated, req.user?.id);
  await logMarketingAudit(
    tenantId,
    'template.change.approved',
    'MarketingTemplate',
    template.id,
    { changeRequestId: changeRequest.id },
    actorFrom(req)
  );

  res.json({ ok: true, template: updated });
});

router.post('/api/marketing/templates/changes/:id/reject', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);

  const changeRequest = await prisma.marketingTemplateChangeRequest.findFirst({
    where: { id, tenantId },
  });
  if (!changeRequest || changeRequest.status !== MarketingTemplateChangeStatus.PENDING) {
    return res.status(404).json({ ok: false, message: 'Change request not found' });
  }

  const updatedRequest = await prisma.marketingTemplateChangeRequest.update({
    where: { id: changeRequest.id },
    data: {
      status: MarketingTemplateChangeStatus.REJECTED,
      approvedByUserId: req.user?.id || null,
      reviewedAt: new Date(),
      message: String(req.body?.message || '').trim() || changeRequest.message,
    },
  });

  await logMarketingAudit(
    tenantId,
    'template.change.rejected',
    'MarketingTemplate',
    changeRequest.templateId,
    { changeRequestId: changeRequest.id },
    actorFrom(req)
  );

  res.json({ ok: true, changeRequest: updatedRequest });
});

router.post('/api/marketing/ai/suggestions', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const showId = String(req.body?.showId || '');
  const types = Array.isArray(req.body?.types) ? req.body.types.map((type: any) => String(type)) : [];

  if (!showId) return res.status(400).json({ ok: false, message: 'Show required' });

  const show = await prisma.show.findFirst({
    where: { id: showId, organiserId: tenantId },
    select: {
      id: true,
      title: true,
      date: true,
      eventType: true,
      eventCategory: true,
      tags: true,
      venue: { select: { name: true, city: true, county: true } },
    },
  });
  if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { tradingName: true, companyName: true, name: true },
  });
  const tenantName = tenantNameFrom(tenant || {});

  const response: Record<string, any> = {};
  const wantedTypes = types.length ? types : ['segment', 'subject_lines', 'send_time', 'automation_preset'];

  if (wantedTypes.includes('segment')) {
    const segment = await recommendBestSegment(tenantId, showId);
    if (segment) {
      const stored = await storeAiSuggestion(tenantId, showId, 'segment', segment, { showId });
      response.segment = { id: stored.id, ...segment };
    }
  }

  if (wantedTypes.includes('subject_lines')) {
    const variations = buildSubjectVariations(show, tenantName);
    const stored = await storeAiSuggestion(tenantId, showId, 'subject_lines', { variations }, { showId });
    response.subjectLines = { id: stored.id, variations };
  }

  if (wantedTypes.includes('send_time')) {
    const sendTime = await recommendSendTime(tenantId);
    const stored = await storeAiSuggestion(tenantId, showId, 'send_time', sendTime, { showId });
    response.sendTime = { id: stored.id, ...sendTime };
  }

  if (wantedTypes.includes('automation_preset')) {
    const preset = recommendAutomationPreset(show);
    const stored = await storeAiSuggestion(tenantId, showId, 'automation_preset', preset, { showId });
    response.automationPreset = { id: stored.id, ...preset };
  }

  res.json({ ok: true, suggestions: response });
});

router.post('/api/marketing/ai/suggestions/:id/feedback', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const suggestion = await prisma.marketingAiSuggestion.findFirst({ where: { id, organiserId: tenantId } });
  if (!suggestion) return res.status(404).json({ ok: false, message: 'Suggestion not found' });

  const used = req.body?.used === true;
  const feedback = req.body?.feedback ? String(req.body.feedback) : null;
  const updated = await prisma.marketingAiSuggestion.update({
    where: { id },
    data: {
      used,
      usedAt: used ? new Date() : null,
      feedback,
    },
  });

  res.json({ ok: true, suggestion: updated });
});

router.get('/api/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const items = await prisma.marketingCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { name: true } },
      segment: { select: { name: true } },
      show: { select: { id: true, title: true, date: true } },
    },
  });
  res.json({ ok: true, items });
});

router.get('/api/marketing/campaigns/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: {
      template: { select: { id: true, name: true, subject: true, fromName: true, fromEmail: true } },
      segment: { select: { id: true, name: true } },
      show: { select: { id: true, title: true, date: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const grouped = await prisma.marketingCampaignRecipient.groupBy({
    by: ['status'],
    where: { tenantId, campaignId: id },
    _count: { _all: true },
  });
  const summary = grouped.reduce(
    (acc, row) => {
      acc.total += row._count._all;
      if (row.status === MarketingRecipientStatus.SENT) acc.sent = row._count._all;
      if (row.status === MarketingRecipientStatus.FAILED) acc.failed = row._count._all;
      if (row.status === MarketingRecipientStatus.RETRYABLE) acc.retryable = row._count._all;
      if (row.status === MarketingRecipientStatus.SKIPPED_SUPPRESSED) acc.skipped = row._count._all;
      if (row.status === MarketingRecipientStatus.PENDING) acc.pending = row._count._all;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, retryable: 0, skipped: 0, pending: 0 }
  );

  res.json({ ok: true, campaign, summary });
});

router.post('/api/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const { name, templateId, segmentId, type, showId } = req.body || {};
  if (!name || !templateId || !segmentId || !type) {
    return res.status(400).json({ ok: false, message: 'Missing campaign fields' });
  }

  const campaignType = String(type);
  if (!Object.values(MarketingCampaignType).includes(campaignType as MarketingCampaignType)) {
    return res.status(400).json({ ok: false, message: 'Invalid campaign type' });
  }

  let show = null;
  if (showId) {
    show = await prisma.show.findFirst({ where: { id: String(showId), organiserId: tenantId } });
    if (!show) {
      return res.status(400).json({ ok: false, message: 'Show not found for campaign' });
    }
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      tenantId,
      name,
      templateId,
      segmentId,
      type: campaignType as MarketingCampaignType,
      showId: show?.id || null,
      status: MarketingCampaignStatus.DRAFT,
      createdByUserId: tenantId,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.created', 'MarketingCampaign', campaign.id, { name }, actorFrom(req));
  res.json({ ok: true, campaign });
});

router.put('/api/marketing/campaigns/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const { name, templateId, segmentId, type, showId } = req.body || {};

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const editableStatuses: MarketingCampaignStatus[] = [
    MarketingCampaignStatus.DRAFT,
    MarketingCampaignStatus.APPROVAL_REQUIRED,
  ];
  if (!editableStatuses.includes(existing.status)) {
    return res.status(400).json({ ok: false, message: 'Campaign can only be edited while in draft or approval.' });
  }

  let campaignType: MarketingCampaignType | undefined = undefined;
  if (type) {
    const typed = String(type);
    if (!Object.values(MarketingCampaignType).includes(typed as MarketingCampaignType)) {
      return res.status(400).json({ ok: false, message: 'Invalid campaign type' });
    }
    campaignType = typed as MarketingCampaignType;
  }

  let showIdValue: string | null | undefined = undefined;
  if (showId !== undefined) {
    if (showId) {
      const show = await prisma.show.findFirst({ where: { id: String(showId), organiserId: tenantId } });
      if (!show) {
        return res.status(400).json({ ok: false, message: 'Show not found for campaign' });
      }
      showIdValue = show.id;
    } else {
      showIdValue = null;
    }
  }

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      name: name || undefined,
      templateId: templateId || undefined,
      segmentId: segmentId || undefined,
      type: campaignType,
      showId: showIdValue,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.updated', 'MarketingCampaign', campaign.id, { name }, actorFrom(req));
  res.json({ ok: true, campaign });
});

router.post('/api/marketing/campaigns/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { template: true, segment: true, tenant: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const estimate = await estimateCampaignRecipients(tenantId, campaign.segment.rules);
  const contacts = await evaluateSegmentContacts(tenantId, campaign.segment.rules);
  const suppressions = await prisma.marketingSuppression.findMany({ where: { tenantId } });
  const suppressionMap = new Map(suppressions.map((s) => [String(s.email || '').toLowerCase(), s]));
  const sampleContact = contacts.find((contact) => {
    const suppression = suppressionMap.get(String(contact.email || '').toLowerCase()) || null;
    const consentStatus = (contact.consentStatus as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
    const decision = shouldSuppressContact(consentStatus, suppression);
    return !decision.suppressed;
  }) || contacts[0];
  const email = sampleContact?.email || 'sample@example.com';
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(preferencesToken)}`;

  const mergeContext = buildTemplateMergeContext({
    contact: {
      firstName: sampleContact?.firstName || 'Sample',
      lastName: sampleContact?.lastName || 'User',
      email,
    },
    links: {
      managePreferencesLink: preferencesUrl,
      unsubscribeLink: unsubscribeUrl,
    },
  });

  if (campaign.template.compiledHtml) {
    const compiledHtml = renderCompiledTemplate({
      compiledHtml: campaign.template.compiledHtml,
      mergeContext,
      unsubscribeUrl,
      preferencesUrl,
    });
    return res.json({ ok: true, estimate, html: compiledHtml, errors: [] });
  }

  const { html, errors } = renderMarketingTemplate(campaign.template.mjmlBody, {
    firstName: sampleContact?.firstName || 'Sample',
    lastName: sampleContact?.lastName || 'User',
    email,
    tenantName: tenantNameFrom(campaign.tenant),
    unsubscribeUrl,
    preferencesUrl,
  });

  res.json({ ok: true, estimate, html, errors });
});

router.post('/api/marketing/campaigns/:id/test-send', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const email = normaliseEmail(req.body?.email);
  const firstName = String(req.body?.firstName || 'Test').trim();
  const lastName = String(req.body?.lastName || 'Recipient').trim();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Valid email required' });
  }

  const lastTest = await prisma.marketingAuditLog.findFirst({
    where: { tenantId, action: 'campaign.test_send' },
    orderBy: { createdAt: 'desc' },
  });
  if (lastTest && TEST_SEND_RATE_LIMIT_SECONDS > 0) {
    const secondsSince = (Date.now() - lastTest.createdAt.getTime()) / 1000;
    if (secondsSince < TEST_SEND_RATE_LIMIT_SECONDS) {
      return res.status(429).json({ ok: false, message: 'Test send rate limit reached.' });
    }
  }

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { template: true, tenant: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const settings = await fetchMarketingSettings(tenantId);
  const sender = resolveSenderDetails({
    templateFromName: campaign.template.fromName,
    templateFromEmail: campaign.template.fromEmail,
    templateReplyTo: campaign.template.replyTo,
    settings,
  });

  if (!sender.fromEmail || !sender.fromName) {
    return res.status(400).json({ ok: false, message: 'From name/email required' });
  }

  const requireVerifiedFrom = resolveRequireVerifiedFrom(settings, REQUIRE_VERIFIED_FROM_DEFAULT);
  try {
    assertSenderVerified({ fromEmail: sender.fromEmail, settings, requireVerifiedFrom, allowUnverified: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || 'From email not verified for marketing sends.' });
  }

  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(preferencesToken)}`;

  const mergeContext = buildTemplateMergeContext({
    contact: { firstName, lastName, email },
    links: {
      managePreferencesLink: preferencesUrl,
      unsubscribeLink: unsubscribeUrl,
    },
  });

  let html = '';
  let errors: string[] = [];
  if (campaign.template.compiledHtml) {
    html = renderCompiledTemplate({
      compiledHtml: campaign.template.compiledHtml,
      mergeContext,
      unsubscribeUrl,
      preferencesUrl,
    });
  } else {
    const rendered = renderMarketingTemplate(campaign.template.mjmlBody, {
      firstName,
      lastName,
      email,
      tenantName: tenantNameFrom(campaign.tenant),
      unsubscribeUrl,
      preferencesUrl,
    });
    html = rendered.html;
    errors = rendered.errors;
  }

  if (errors.length) {
    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: false,
      errors,
    }, actorFrom(req));
    return res.status(400).json({ ok: false, message: 'Template render failed', errors });
  }

  try {
    const provider = getEmailProvider(settings);
    const listUnsubscribeMail = buildListUnsubscribeMail(sender.fromEmail) || undefined;
    const headers: Record<string, string> = {
      'List-Unsubscribe': [listUnsubscribeMail, `<${unsubscribeUrl}>`].filter(Boolean).join(', '),
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    const result = await provider.sendEmail({
      to: email,
      subject: `[Test] ${campaign.template.subject}`,
      html,
      fromName: sender.fromName,
      fromEmail: applyMarketingStreamToEmail(sender.fromEmail, settings),
      replyTo: sender.replyTo || undefined,
      headers,
      customArgs: {
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        testSend: 'true',
      },
    });

    console.info('[marketing:campaign:test-send]', {
      campaignId: campaign.id,
      tenantId,
      providerId: result.id,
      providerStatus: result.status,
      providerResponse: result.response || null,
    });

    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: true,
    }, actorFrom(req));

    res.json({ ok: true });
  } catch (error: any) {
    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: false,
      error: error?.message || 'Send failed',
    }, actorFrom(req));
    res.status(500).json({ ok: false, message: 'Test send failed' });
  }
});

router.post('/api/marketing/campaigns/:id/schedule', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const sendNow = Boolean(req.body?.sendNow);
  const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { segment: true, template: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const schedulableStatuses: MarketingCampaignStatus[] = [
    MarketingCampaignStatus.DRAFT,
    MarketingCampaignStatus.APPROVAL_REQUIRED,
    MarketingCampaignStatus.SCHEDULED,
  ];
  if (!schedulableStatuses.includes(campaign.status)) {
    return res.status(400).json({ ok: false, message: 'Campaign cannot be scheduled from its current status.' });
  }

  const estimate = await estimateCampaignRecipients(tenantId, campaign.segment.rules);
  const maxSegment = Number(process.env.MARKETING_MAX_SEGMENT || 20000);
  const userRole = String(req.user?.role || '').toUpperCase();
  if (estimate.sendable > maxSegment && userRole !== 'ADMIN') {
    return res.status(403).json({ ok: false, message: 'Segment too large for your role.' });
  }

  await ensureDailyLimit(tenantId, estimate.sendable);

  const settings = await fetchMarketingSettings(tenantId);
  const sender = resolveSenderDetails({
    templateFromName: campaign.template.fromName,
    templateFromEmail: campaign.template.fromEmail,
    templateReplyTo: campaign.template.replyTo,
    settings,
  });

  if (!sender.fromEmail || !sender.fromName) {
    return res.status(400).json({ ok: false, message: 'From name/email required' });
  }

  if (settings?.sendgridDomain) {
    const domain = settings.sendgridDomain.toLowerCase();
    if (!sender.fromEmail.toLowerCase().endsWith(`@${domain}`)) {
      return res.status(400).json({ ok: false, message: `From email must use the verified domain (${domain}).` });
    }
  }

  const requireVerifiedFrom = resolveRequireVerifiedFrom(settings, REQUIRE_VERIFIED_FROM_DEFAULT);
  let senderVerified = true;
  try {
    assertSenderVerified({ fromEmail: sender.fromEmail, settings, requireVerifiedFrom });
  } catch (error: any) {
    if (requireVerifiedFrom) {
      senderVerified = false;
    } else {
      return res.status(400).json({ ok: false, message: error?.message || 'Sender validation failed.' });
    }
  }

  const approvalThreshold = Number.isFinite(APPROVAL_THRESHOLD_DEFAULT)
    ? APPROVAL_THRESHOLD_DEFAULT
    : 5000;
  const approvalReasons = [];
  const priorSends = await prisma.marketingCampaign.count({
    where: { tenantId, status: MarketingCampaignStatus.SENT },
  });
  if (estimate.sendable > approvalThreshold) approvalReasons.push('Segment exceeds approval threshold.');
  if (!priorSends) approvalReasons.push('First-time sender requires approval.');
  if (!senderVerified) approvalReasons.push('Sender domain is not verified.');

  const approvalRequired = approvalReasons.length > 0;
  if (!approvalRequired && role !== MarketingGovernanceRole.APPROVER) {
    return res.status(403).json({ ok: false, message: 'Approver role required to schedule sends.' });
  }
  const nextStatus = approvalRequired
    ? MarketingCampaignStatus.APPROVAL_REQUIRED
    : MarketingCampaignStatus.SCHEDULED;
  const scheduledTime = sendNow ? new Date() : scheduledFor;

  if (!scheduledTime || isNaN(scheduledTime.getTime())) {
    return res.status(400).json({ ok: false, message: 'scheduledFor required' });
  }

  const updated = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: nextStatus,
      scheduledFor: scheduledTime,
      scheduledByUserId: req.user?.id || null,
    },
  });

  await logMarketingAudit(
    tenantId,
    approvalRequired ? 'campaign.approval_required' : 'campaign.scheduled',
    'MarketingCampaign',
    updated.id,
    {
      scheduledFor: scheduledTime.toISOString(),
      approvalReasons: approvalReasons.length ? approvalReasons : undefined,
    },
    actorFrom(req)
  );
  res.json({
    ok: true,
    campaign: updated,
    estimate,
    approvalRequired,
    approvalReasons,
  });
});

router.post('/api/marketing/campaigns/:id/approve', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.APPROVER);
  if (!role) return;
  const id = String(req.params.id);
  const sendNow = Boolean(req.body?.sendNow);
  const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { segment: true, template: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  if (campaign.status !== MarketingCampaignStatus.APPROVAL_REQUIRED) {
    return res.status(400).json({ ok: false, message: 'Campaign does not require approval.' });
  }

  const scheduledTime = sendNow ? new Date() : scheduledFor || campaign.scheduledFor;
  if (!scheduledTime || isNaN(scheduledTime.getTime())) {
    return res.status(400).json({ ok: false, message: 'scheduledFor required' });
  }

  const estimate = await estimateCampaignRecipients(tenantId, campaign.segment.rules);
  await ensureDailyLimit(tenantId, estimate.sendable);

  const settings = await fetchMarketingSettings(tenantId);
  const sender = resolveSenderDetails({
    templateFromName: campaign.template.fromName,
    templateFromEmail: campaign.template.fromEmail,
    templateReplyTo: campaign.template.replyTo,
    settings,
  });

  if (!sender.fromEmail || !sender.fromName) {
    return res.status(400).json({ ok: false, message: 'From name/email required' });
  }

  const requireVerifiedFrom = resolveRequireVerifiedFrom(settings, REQUIRE_VERIFIED_FROM_DEFAULT);
  try {
    assertSenderVerified({ fromEmail: sender.fromEmail, settings, requireVerifiedFrom });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || 'Sender verification required.' });
  }

  const updated = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: MarketingCampaignStatus.SCHEDULED,
      scheduledFor: scheduledTime,
      approvedByUserId: req.user?.id || null,
      approvedAt: new Date(),
    },
  });

  await logMarketingAudit(
    tenantId,
    'campaign.approved',
    'MarketingCampaign',
    updated.id,
    { scheduledFor: scheduledTime.toISOString() },
    actorFrom(req)
  );

  res.json({ ok: true, campaign: updated, estimate });
});

router.post('/api/marketing/campaigns/:id/cancel', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const cancellableStatuses: MarketingCampaignStatus[] = [
    MarketingCampaignStatus.DRAFT,
    MarketingCampaignStatus.SCHEDULED,
    MarketingCampaignStatus.SENDING,
    MarketingCampaignStatus.PAUSED_LIMIT,
    MarketingCampaignStatus.APPROVAL_REQUIRED,
  ];
  if (!cancellableStatuses.includes(existing.status)) {
    return res.status(400).json({ ok: false, message: 'Campaign cannot be cancelled in its current status.' });
  }

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: { status: MarketingCampaignStatus.CANCELLED, sendLockedUntil: null },
  });

  await logMarketingAudit(tenantId, 'campaign.cancelled', 'MarketingCampaign', campaign.id, undefined, actorFrom(req));
  res.json({ ok: true, campaign });
});

router.get('/api/marketing/campaigns/:id/logs', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);

  const events = await prisma.marketingEmailEvent.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const recipients = await prisma.marketingCampaignRecipient.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { sentAt: 'desc' },
    take: 200,
  });

  res.json({ ok: true, events, recipients });
});

router.get('/api/marketing/campaigns/:id/recipients', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const includeItems = String(req.query?.include || '') === 'items' || String(req.query?.detail || '') === 'true';

  const grouped = await prisma.marketingCampaignRecipient.groupBy({
    by: ['status'],
    where: { tenantId, campaignId: id },
    _count: { _all: true },
  });

  const summary = grouped.reduce(
    (acc, row) => {
      acc.total += row._count._all;
      if (row.status === MarketingRecipientStatus.SENT) acc.sent = row._count._all;
      if (row.status === MarketingRecipientStatus.FAILED) acc.failed = row._count._all;
      if (row.status === MarketingRecipientStatus.RETRYABLE) acc.retryable = row._count._all;
      if (row.status === MarketingRecipientStatus.SKIPPED_SUPPRESSED) acc.skipped = row._count._all;
      if (row.status === MarketingRecipientStatus.PENDING) acc.pending = row._count._all;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, retryable: 0, skipped: 0, pending: 0 }
  );

  let items: MarketingCampaignRecipient[] = [];
  if (includeItems) {
    items = await prisma.marketingCampaignRecipient.findMany({
      where: { tenantId, campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  res.json({ ok: true, items: includeItems ? items : undefined, summary });
});

router.get('/api/marketing/campaigns/:id/events', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);

  const items = await prisma.marketingEmailEvent.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json({ ok: true, items });
});

router.get('/api/marketing/analytics/overview', marketingAnalyticsLimiter, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { from, to, fromLabel, toLabel } = parseDateRange(req);
  const key = cacheKey(['marketing-analytics-overview', tenantId, fromLabel, toLabel]);
  const cached = getCachedAnalytics<any>(key);
  if (cached) return res.json({ ok: true, cached: true, ...cached });

  const [rollups, checkoutCount, purchaseCount] = await Promise.all([
    prisma.marketingDailyEventRollup.findMany({
      where: { tenantId, day: { gte: from, lte: to } },
      select: { sent: true, opened: true, clicked: true, bounced: true, unsubscribed: true },
    }),
    prisma.marketingCheckoutEvent.count({
      where: { tenantId, createdAt: { gte: from, lte: to } },
    }),
    prisma.order.count({
      where: { status: OrderStatus.PAID, createdAt: { gte: from, lte: to }, show: { organiserId: tenantId } },
    }),
  ]);

  const rollupTotals = rollups.reduce(
    (acc, row) => {
      acc.sent += row.sent;
      acc.opened += row.opened;
      acc.clicked += row.clicked;
      acc.bounced += row.bounced;
      acc.unsubscribed += row.unsubscribed;
      return acc;
    },
    { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
  );

  let sentCount = rollupTotals.sent;
  let openCount = rollupTotals.opened;
  let clickCount = rollupTotals.clicked;
  let bounceCount = rollupTotals.bounced;
  let unsubscribeCount = rollupTotals.unsubscribed;

  if (!rollups.length) {
    const [fallbackSent, fallbackOpen, fallbackClick, fallbackBounce, fallbackUnsub] = await Promise.all([
      prisma.marketingCampaignRecipient.count({
        where: { tenantId, status: MarketingRecipientStatus.SENT, sentAt: { gte: from, lte: to } },
      }),
      prisma.marketingEmailEvent.count({
        where: { tenantId, type: MarketingEmailEventType.OPEN, createdAt: { gte: from, lte: to } },
      }),
      prisma.marketingEmailEvent.count({
        where: { tenantId, type: MarketingEmailEventType.CLICK, createdAt: { gte: from, lte: to } },
      }),
      prisma.marketingEmailEvent.count({
        where: { tenantId, type: MarketingEmailEventType.BOUNCE, createdAt: { gte: from, lte: to } },
      }),
      prisma.marketingEmailEvent.count({
        where: { tenantId, type: MarketingEmailEventType.UNSUBSCRIBE, createdAt: { gte: from, lte: to } },
      }),
    ]);
    sentCount = fallbackSent;
    openCount = fallbackOpen;
    clickCount = fallbackClick;
    bounceCount = fallbackBounce;
    unsubscribeCount = fallbackUnsub;
  }

  const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - rangeDays);

  const [currentInsights, previousInsights] = await Promise.all([
    prisma.customerInsight.findMany({
      where: { tenantId, lastPurchaseAt: { gte: from, lte: to } },
      select: { firstPurchaseAt: true, lastPurchaseAt: true, purchaseCount: true },
    }),
    prisma.customerInsight.findMany({
      where: { tenantId, lastPurchaseAt: { gte: prevFrom, lte: prevTo } },
      select: { firstPurchaseAt: true, lastPurchaseAt: true, purchaseCount: true },
    }),
  ]);

  const lapsedThresholdDays = 90;
  const lapsedThresholdMs = lapsedThresholdDays * 24 * 60 * 60 * 1000;
  const reengagedCount = currentInsights.filter((insight) => {
    if (!insight.firstPurchaseAt || !insight.lastPurchaseAt) return false;
    const gap = insight.lastPurchaseAt.getTime() - insight.firstPurchaseAt.getTime();
    return gap >= lapsedThresholdMs;
  }).length;

  function repeatStats(insights: Array<{ purchaseCount: number }>) {
    const total = insights.length;
    const repeat = insights.filter((insight) => (insight.purchaseCount || 0) > 1).length;
    const rate = total ? repeat / total : 0;
    return { total, repeat, rate };
  }

  const currentRepeat = repeatStats(currentInsights);
  const previousRepeat = repeatStats(previousInsights);
  const uplift = currentRepeat.rate - previousRepeat.rate;

  const engagementEvents = await prisma.marketingEmailEvent.findMany({
    where: {
      tenantId,
      type: { in: [MarketingEmailEventType.OPEN, MarketingEmailEventType.CLICK] },
      createdAt: { gte: from, lte: to },
    },
    select: { createdAt: true, type: true },
  });

  const hourly = Array.from({ length: 24 }, () => ({ opens: 0, clicks: 0, total: 0 }));
  engagementEvents.forEach((event) => {
    const hour = event.createdAt.getUTCHours();
    if (!hourly[hour]) return;
    if (event.type === MarketingEmailEventType.OPEN) hourly[hour].opens += 1;
    if (event.type === MarketingEmailEventType.CLICK) hourly[hour].clicks += 1;
    hourly[hour].total += 1;
  });

  const bestHours = hourly
    .map((row, hour) => ({ hour, ...row }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const response = {
    range: { from: fromLabel, to: toLabel },
    funnel: {
      sent: sentCount,
      opened: openCount,
      clicked: clickCount,
      bounced: bounceCount,
      unsubscribed: unsubscribeCount,
      checkout: checkoutCount,
      purchased: purchaseCount,
    },
    cohorts: {
      reengagedLapsed: reengagedCount,
      repeatPurchaseRate: currentRepeat.rate,
      repeatPurchaseUplift: uplift,
      previousRepeatPurchaseRate: previousRepeat.rate,
    },
    bestTimeToSend: {
      topHours: bestHours,
      timezone: 'UTC',
    },
  };

  setCachedAnalytics(key, response);
  res.json({ ok: true, ...response });
});

router.get('/api/marketing/analytics/campaigns', marketingAnalyticsLimiter, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { from, to, fromLabel, toLabel } = parseDateRange(req);
  const key = cacheKey(['marketing-analytics-campaigns', tenantId, fromLabel, toLabel]);
  const cached = getCachedAnalytics<any>(key);
  if (cached) return res.json({ ok: true, cached: true, ...cached });

  const campaigns = await prisma.marketingCampaign.findMany({
    where: {
      tenantId,
      OR: [
        { createdAt: { gte: from, lte: to } },
        { scheduledFor: { gte: from, lte: to } },
      ],
    },
    include: {
      segment: true,
      show: { include: { venue: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const campaignIds = campaigns.map((campaign) => campaign.id);
  if (!campaignIds.length) {
    const emptyResponse = {
      range: { from: fromLabel, to: toLabel },
      campaigns: [],
      bySegment: [],
      byVenue: [],
      byCategory: [],
      utmSummary: [],
    };
    setCachedAnalytics(key, emptyResponse);
    return res.json({ ok: true, ...emptyResponse });
  }

  const [recipientStats, eventStats, clickEvents, orders] = await Promise.all([
    prisma.marketingCampaignRecipient.groupBy({
      by: ['campaignId', 'status'],
      where: {
        tenantId,
        campaignId: { in: campaignIds },
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
    }),
    prisma.marketingEmailEvent.groupBy({
      by: ['campaignId', 'type'],
      where: {
        tenantId,
        campaignId: { in: campaignIds },
        createdAt: { gte: from, lte: to },
        type: { in: [MarketingEmailEventType.OPEN, MarketingEmailEventType.CLICK] },
      },
      _count: { _all: true },
    }),
    prisma.marketingEmailEvent.findMany({
      where: {
        tenantId,
        campaignId: { in: campaignIds },
        createdAt: { gte: from, lte: to },
        type: MarketingEmailEventType.CLICK,
      },
      select: {
        campaignId: true,
        email: true,
        createdAt: true,
        meta: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        createdAt: { gte: from, lte: to },
        show: { organiserId: tenantId },
      },
      select: {
        id: true,
        email: true,
        shippingEmail: true,
        amountPence: true,
        createdAt: true,
        showId: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const ordersByEmail = new Map<string, typeof orders>();
  orders.forEach((order) => {
    const rawEmail = (order.email || order.shippingEmail || '').toLowerCase();
    if (!rawEmail) return;
    const list = ordersByEmail.get(rawEmail) || [];
    list.push(order);
    ordersByEmail.set(rawEmail, list);
  });

  const statsByCampaign = new Map<
    string,
    {
      sent: number;
      opened: number;
      clicked: number;
      orders: number;
      revenuePence: number;
      utm: Map<string, { clicks: number; orders: number; revenuePence: number; utm: any }>;
      links: Map<string, { clicks: number; orders: number; revenuePence: number }>;
    }
  >();

  function ensureCampaignStats(campaignId: string) {
    if (!statsByCampaign.has(campaignId)) {
      statsByCampaign.set(campaignId, {
        sent: 0,
        opened: 0,
        clicked: 0,
        orders: 0,
        revenuePence: 0,
        utm: new Map(),
        links: new Map(),
      });
    }
    return statsByCampaign.get(campaignId)!;
  }

  recipientStats.forEach((row) => {
    const stats = ensureCampaignStats(row.campaignId);
    if (row.status === MarketingRecipientStatus.SENT) stats.sent = row._count._all;
  });

  eventStats.forEach((row) => {
    const stats = ensureCampaignStats(row.campaignId);
    if (row.type === MarketingEmailEventType.OPEN) stats.opened = row._count._all;
    if (row.type === MarketingEmailEventType.CLICK) stats.clicked = row._count._all;
  });

  const attributed = new Set<string>();

  function linkFromMeta(meta: any) {
    if (!meta) return null;
    return meta.url || meta.link || meta['url'] || meta['link'] || meta['click_url'] || null;
  }

  clickEvents.forEach((event) => {
    const email = String(event.email || '').toLowerCase();
    const stats = ensureCampaignStats(event.campaignId);
    const rawLink = linkFromMeta(event.meta);
    if (rawLink) {
      const linkStats = stats.links.get(rawLink) || { clicks: 0, orders: 0, revenuePence: 0 };
      linkStats.clicks += 1;
      stats.links.set(rawLink, linkStats);
    }

    const key = `${event.campaignId}:${email}`;
    if (!email || attributed.has(key)) return;

    const campaign = campaigns.find((item) => item.id === event.campaignId);
    const possibleOrders = ordersByEmail.get(email) || [];
    const attributedOrder = possibleOrders.find((order) => {
      if (order.createdAt < event.createdAt) return false;
      if (campaign?.showId && order.showId !== campaign.showId) return false;
      return true;
    });

    if (!attributedOrder) return;
    attributed.add(key);
    stats.orders += 1;
    stats.revenuePence += attributedOrder.amountPence || 0;

    if (rawLink) {
      const linkStats = stats.links.get(rawLink);
      if (linkStats) {
        linkStats.orders += 1;
        linkStats.revenuePence += attributedOrder.amountPence || 0;
      }
    }

    const utm = parseUtmFromUrl(rawLink);
    if (utm) {
      const utmKey = [
        utm.utmSource || '',
        utm.utmMedium || '',
        utm.utmCampaign || '',
        utm.utmContent || '',
        utm.utmTerm || '',
      ].join('|');
      const utmStats = stats.utm.get(utmKey) || { clicks: 0, orders: 0, revenuePence: 0, utm };
      utmStats.orders += 1;
      utmStats.revenuePence += attributedOrder.amountPence || 0;
      stats.utm.set(utmKey, utmStats);
    }
  });

  clickEvents.forEach((event) => {
    const rawLink = linkFromMeta(event.meta);
    if (!rawLink) return;
    const utm = parseUtmFromUrl(rawLink);
    if (!utm) return;
    const stats = ensureCampaignStats(event.campaignId);
    const utmKey = [
      utm.utmSource || '',
      utm.utmMedium || '',
      utm.utmCampaign || '',
      utm.utmContent || '',
      utm.utmTerm || '',
    ].join('|');
    const utmStats = stats.utm.get(utmKey) || { clicks: 0, orders: 0, revenuePence: 0, utm };
    utmStats.clicks += 1;
    stats.utm.set(utmKey, utmStats);
  });

  const campaignsResponse = campaigns.map((campaign) => {
    const stats = ensureCampaignStats(campaign.id);
    const utmList = Array.from(stats.utm.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
    const topLinks = Array.from(stats.links.entries())
      .map(([url, data]) => ({ url, ...data }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 3);
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      scheduledFor: campaign.scheduledFor,
      segment: campaign.segment ? { id: campaign.segment.id, name: campaign.segment.name } : null,
      show: campaign.show
        ? {
            id: campaign.show.id,
            title: campaign.show.title,
            category: campaign.show.eventCategory,
            venue: campaign.show.venue ? campaign.show.venue.name : null,
          }
        : null,
      sent: stats.sent,
      opened: stats.opened,
      clicked: stats.clicked,
      orders: stats.orders,
      revenuePence: stats.revenuePence,
      utm: utmList,
      topLinks,
    };
  });

  function aggregatePerformance(rows: typeof campaignsResponse, keyFn: (row: typeof campaignsResponse[0]) => string) {
    const map = new Map<
      string,
      { key: string; sent: number; opened: number; clicked: number; orders: number; revenuePence: number }
    >();
    rows.forEach((row) => {
      const key = keyFn(row);
      const entry = map.get(key) || {
        key,
        sent: 0,
        opened: 0,
        clicked: 0,
        orders: 0,
        revenuePence: 0,
      };
      entry.sent += row.sent;
      entry.opened += row.opened;
      entry.clicked += row.clicked;
      entry.orders += row.orders;
      entry.revenuePence += row.revenuePence;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }

  const bySegment = aggregatePerformance(campaignsResponse, (row) => row.segment?.name || 'Unassigned segment');
  const byVenue = aggregatePerformance(campaignsResponse, (row) => row.show?.venue || 'Unassigned venue');
  const byCategory = aggregatePerformance(campaignsResponse, (row) => row.show?.category || 'Unassigned category');

  const utmSummary = new Map<
    string,
    { utm: any; clicks: number; orders: number; revenuePence: number }
  >();

  campaignsResponse.forEach((campaign) => {
    campaign.utm.forEach((entry) => {
      const utmKey = [
        entry.utm.utmSource || '',
        entry.utm.utmMedium || '',
        entry.utm.utmCampaign || '',
        entry.utm.utmContent || '',
        entry.utm.utmTerm || '',
      ].join('|');
      const summary = utmSummary.get(utmKey) || {
        utm: entry.utm,
        clicks: 0,
        orders: 0,
        revenuePence: 0,
      };
      summary.clicks += entry.clicks;
      summary.orders += entry.orders;
      summary.revenuePence += entry.revenuePence;
      utmSummary.set(utmKey, summary);
    });
  });

  const response = {
    range: { from: fromLabel, to: toLabel },
    campaigns: campaignsResponse,
    bySegment,
    byVenue,
    byCategory,
    utmSummary: Array.from(utmSummary.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
  };

  setCachedAnalytics(key, response);
  res.json({ ok: true, ...response });
});

router.get('/marketing/api/search', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const q = String(req.query.q || '').trim();
  if (!q) {
    const response = { ok: true, campaigns: [], templates: [], contacts: [] };
    logMarketingApi(req, response);
    return res.json(response);
  }
  const [campaigns, templates, contacts] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where: { tenantId, name: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.marketingTemplate.findMany({
      where: { tenantId, name: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.marketingContact.findMany({
      where: {
        tenantId,
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const response = {
    ok: true,
    campaigns: campaigns.map((item) => ({ id: item.id, name: item.name, status: item.status })),
    templates: templates.map((item) => ({ id: item.id, name: item.name, subject: item.subject })),
    contacts: contacts.map((item) => ({ id: item.id, email: item.email, name: `${item.firstName || ''} ${item.lastName || ''}`.trim() })),
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/marketing/api/segments/:id', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });
  const response = { ok: true, segment };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/marketing/api/segments/:id/evaluate', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });
  const estimate = await estimateCampaignRecipients(tenantId, segment.rules);
  const contacts = await evaluateSegmentContacts(tenantId, segment.rules);
  const response = { ok: true, estimate, sample: contacts.slice(0, 25) };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/marketing/api/contacts/:id', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const contact = await prisma.marketingContact.findFirst({
    where: { id, tenantId },
    include: {
      consents: true,
      tags: { include: { tag: true } },
      preferences: { include: { topic: true } },
    },
  });
  if (!contact) return res.status(404).json({ ok: false, message: 'Contact not found' });

  const suppressions = await prisma.marketingSuppression.findMany({
    where: { tenantId, email: contact.email },
  });
  await ensureDefaultPreferenceTopics(tenantId);
  const topics = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });

  const response = {
    ok: true,
    contact,
    consent: contact.consents[0] || null,
    tags: contact.tags.map((tag) => tag.tag),
    suppressions,
    preferences: topics.map((topic) => {
      const match = contact.preferences.find((pref) => pref.topicId === topic.id);
      return { ...topic, status: match?.status || MarketingPreferenceStatus.SUBSCRIBED };
    }),
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/marketing/api/contacts/:id/audit', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const logs = await prisma.marketingAuditLog.findMany({
    where: { tenantId, entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const response = { ok: true, items: logs };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/marketing/api/contacts/:id/suppress', requireAuth, requireAdminOrOrganiser, requireMarketingStepUp, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const contact = await prisma.marketingContact.findFirst({ where: { id, tenantId } });
  if (!contact) return res.status(404).json({ ok: false, message: 'Contact not found' });
  const reason = String(req.body?.reason || 'Manual suppression').trim();
  await applySuppression(tenantId, contact.email, MarketingSuppressionType.UNSUBSCRIBE, reason, MarketingConsentSource.ADMIN_EDIT);
  const response = { ok: true };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/marketing/api/contacts/:id/unsuppress', requireAuth, requireAdminOrOrganiser, requireMarketingStepUp, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const contact = await prisma.marketingContact.findFirst({ where: { id, tenantId } });
  if (!contact) return res.status(404).json({ ok: false, message: 'Contact not found' });
  await clearSuppression(tenantId, contact.email);
  const response = { ok: true };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/marketing/api/automations/:id/toggle', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.CAMPAIGN_CREATOR);
  if (!role) return;
  const id = String(req.params.id);
  const automation = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });
  const nextEnabled = req.body?.isEnabled !== undefined ? Boolean(req.body.isEnabled) : !automation.isEnabled;
  const updated = await prisma.marketingAutomation.update({
    where: { id },
    data: { isEnabled: nextEnabled },
  });
  await recordAutomationAudit(tenantId, nextEnabled ? 'automation.enabled' : 'automation.disabled', updated.id, {});
  const response = { ok: true, automation: updated };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/marketing/api/analytics/summary', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const now = new Date();
  const from7 = new Date(now);
  from7.setDate(from7.getDate() - 7);
  const from30 = new Date(now);
  from30.setDate(from30.getDate() - 30);

  const [sent7, sent30, opened30, clicked30, topSegments, topCampaignEvents] = await Promise.all([
    prisma.marketingCampaignRecipient.count({
      where: { tenantId, status: MarketingRecipientStatus.SENT, sentAt: { gte: from7 } },
    }),
    prisma.marketingCampaignRecipient.count({
      where: { tenantId, status: MarketingRecipientStatus.SENT, sentAt: { gte: from30 } },
    }),
    prisma.marketingEmailEvent.count({
      where: { tenantId, type: MarketingEmailEventType.OPEN, createdAt: { gte: from30 } },
    }),
    prisma.marketingEmailEvent.count({
      where: { tenantId, type: MarketingEmailEventType.CLICK, createdAt: { gte: from30 } },
    }),
    fetchTopSegmentsByEngagement(tenantId, 30),
    prisma.marketingEmailEvent.groupBy({
      by: ['campaignId'],
      where: { tenantId, createdAt: { gte: from30 } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  const campaignIds = topCampaignEvents.map((row) => row.campaignId);
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { tenantId, id: { in: campaignIds } },
    select: { id: true, name: true },
  });
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));

  const response = {
    ok: true,
    sentLast7Days: sent7,
    sentLast30Days: sent30,
    openRate: sent30 ? Number((opened30 / sent30).toFixed(4)) : 0,
    clickRate: sent30 ? Number((clicked30 / sent30).toFixed(4)) : 0,
    topCampaigns: topCampaignEvents.map((row) => ({
      id: row.campaignId,
      name: campaignMap.get(row.campaignId) || 'Campaign',
      events: row._count?.id ?? 0,
    })),
    topSegments,
  };
  logMarketingApi(req, response);
  res.json(response);
});

router.get('/marketing/api/deliverability/campaigns/:id', requireAuth, requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const role = await assertMarketingRole(req, res, MarketingGovernanceRole.VIEWER);
  if (!role) return;
  const id = String(req.params.id);
  const items = await fetchCampaignDeliverability(tenantId, 30);
  const match = items.find((item) => item.campaignId === id) || null;
  const response = { ok: true, report: match };
  logMarketingApi(req, response);
  res.json(response);
});

router.post('/marketing/api/campaigns/:id/send-test', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/campaigns/${req.params.id}/test-send`);
});

router.post('/marketing/api/campaigns/:id/send-now', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/campaigns/${req.params.id}/approve`, undefined, { sendNow: true });
});

router.post('/marketing/api/campaigns/:id/cancel-schedule', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/campaigns/${req.params.id}/cancel`);
});

router.get('/marketing/api/campaigns/:id/preview', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/campaigns/${req.params.id}/preview`, 'POST');
});

router.post('/marketing/api/templates/:id', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/templates/${req.params.id}`, 'PUT');
});

router.post('/marketing/api/templates/:id/restore', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/templates/${req.params.id}/rollback`);
});

router.post('/marketing/api/segments/:id', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/segments/${req.params.id}`, 'PUT');
});

router.post('/marketing/api/contacts/import', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, '/api/marketing/imports');
});

router.post('/marketing/api/automations/:id', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, `/api/marketing/automations/${req.params.id}`, 'PUT');
});

router.post('/marketing/api/settings/roles', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, '/api/marketing/roles');
});

router.get('/marketing/api/settings/roles', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  forwardToLegacy(req, res, next, '/api/marketing/roles');
});

router.use('/marketing/api', requireAuth, requireAdminOrOrganiser, (req, res, next) => {
  const legacyPath = req.url.replace('/marketing/api', '/api/marketing');
  forwardToLegacy(req, res, next, legacyPath);
});

router.get('/marketing', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/campaigns', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/campaigns/:id', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/templates', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/templates/:id/edit', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/segments', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/segments/:id', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/contacts', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/contacts/:id', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/automations', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/automations/:id', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/analytics', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/deliverability', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing/settings', requireAuth, requireAdminOrOrganiser, (req, res) => {
  renderMarketingShell(req, res);
});

router.get('/marketing', requireAdminOrOrganiser, (_req, res) => {
  sendMarketingSuiteShell(res);
});

router.get('/marketing/*', requireAdminOrOrganiser, (_req, res) => {
  sendMarketingSuiteShell(res);
});

export default router;
