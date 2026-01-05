import prisma from '../../lib/prisma.js';
import { getEmailProvider } from '../../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../../lib/email-marketing/preferences.js';
import { renderMarketingTemplate } from '../../lib/email-marketing/rendering.js';
import {
  fetchMarketingSettings,
  applyMarketingStreamToEmail,
  assertSenderVerified,
  buildListUnsubscribeMail,
  resolveDailyLimit,
  resolveRequireVerifiedFrom,
  resolveSenderDetails,
  resolveSendRate,
} from './settings.js';
import {
  MarketingCampaignStatus,
  MarketingConsentStatus,
  MarketingConsentSource,
  MarketingLawfulBasis,
  MarketingRecipientStatus,
  MarketingSuppressionType,
  MarketingEmailEventType,
} from '@prisma/client';
import { evaluateSegmentContacts } from './segments.js';
import { buildRecommendedShowsHtml } from './recommendations.js';
import { recordConsentAudit, recordSuppressionAudit } from './audit.js';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const RATE_PER_SEC = Number(process.env.MARKETING_SEND_RATE_PER_SEC || 50);
const BATCH_SIZE = Number(process.env.MARKETING_SEND_BATCH_SIZE || 50);
const DAILY_LIMIT = Number(process.env.MARKETING_DAILY_LIMIT || 50000);
const REQUIRE_VERIFIED_FROM = String(process.env.MARKETING_REQUIRE_VERIFIED_FROM || 'true') === 'true';
const CAMPAIGN_LOCK_MINUTES = Number(process.env.MARKETING_CAMPAIGN_LOCK_MINUTES || 5);
const MAX_RETRY_DELAY_MINUTES = Number(process.env.MARKETING_SEND_RETRY_MAX_MINUTES || 60);
const BASE_RETRY_DELAY_SECONDS = Number(process.env.MARKETING_SEND_RETRY_BASE_SECONDS || 30);
const ESTIMATE_CACHE_MS = Number(process.env.MARKETING_ESTIMATE_CACHE_MS || 30000);

type CampaignEstimate = {
  total: number;
  sendable: number;
  suppressed: number;
  sample: string[];
};

const estimateCache = new Map<string, { value: CampaignEstimate; expiresAt: number }>();

function baseUrl() {
  return PUBLIC_BASE_URL.replace(/\/+$/, '');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

function tenantSlugFrom(user: { storefrontSlug?: string | null; id: string }) {
  return user.storefrontSlug || user.id;
}

export function shouldSuppressContact(
  consentStatus: MarketingConsentStatus,
  suppression: { type: MarketingSuppressionType } | null
): { suppressed: boolean; reason: string | null } {
  if (suppression) {
    return { suppressed: true, reason: `suppressed:${suppression.type}` };
  }

  if (
    consentStatus === MarketingConsentStatus.UNSUBSCRIBED ||
    consentStatus === MarketingConsentStatus.BOUNCED ||
    consentStatus === MarketingConsentStatus.COMPLAINED ||
    consentStatus === MarketingConsentStatus.TRANSACTIONAL_ONLY
  ) {
    return { suppressed: true, reason: `consent:${consentStatus}` };
  }

  return { suppressed: false, reason: null };
}

export function buildRecipientEntries(options: {
  tenantId: string;
  campaignId: string;
  contacts: Array<{ id: string; email: string; consentStatus: string | null }>;
  suppressions: Array<{ email: string; type: MarketingSuppressionType }>;
}) {
  const suppressionMap = new Map(
    options.suppressions.map((s) => [String(s.email || '').toLowerCase(), s])
  );

  const seenContacts = new Set<string>();
  return options.contacts
    .filter((contact) => {
      if (seenContacts.has(contact.id)) return false;
      seenContacts.add(contact.id);
      return true;
    })
    .map((contact) => {
      const suppression = suppressionMap.get(contact.email.toLowerCase()) || null;
      const consentStatus = (contact.consentStatus as MarketingConsentStatus) || MarketingConsentStatus.TRANSACTIONAL_ONLY;
      const decision = shouldSuppressContact(consentStatus, suppression);

      return {
        tenantId: options.tenantId,
        campaignId: options.campaignId,
        contactId: contact.id,
        email: contact.email,
        status: decision.suppressed ? MarketingRecipientStatus.SKIPPED_SUPPRESSED : MarketingRecipientStatus.PENDING,
        errorText: decision.reason,
      };
    });
}

export async function estimateCampaignRecipients(tenantId: string, rulesInput: unknown): Promise<CampaignEstimate> {
  const cacheKey = `${tenantId}:${JSON.stringify(rulesInput || {})}`;
  const cached = estimateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const contacts = await evaluateSegmentContacts(tenantId, rulesInput);
  const suppressions = await prisma.marketingSuppression.findMany({
    where: { tenantId },
  });

  const recipients = buildRecipientEntries({
    tenantId,
    campaignId: 'estimate',
    contacts,
    suppressions,
  });

  const sendable = recipients.filter((r) => r.status === MarketingRecipientStatus.PENDING);
  const suppressed = recipients.filter((r) => r.status === MarketingRecipientStatus.SKIPPED_SUPPRESSED);

  const estimate = {
    total: recipients.length,
    sendable: sendable.length,
    suppressed: suppressed.length,
    sample: sendable.slice(0, 20).map((r) => r.email),
  };

  estimateCache.set(cacheKey, { value: estimate, expiresAt: Date.now() + ESTIMATE_CACHE_MS });
  return estimate;
}

async function ensureRecipients(campaignId: string) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { segment: true, template: true, tenant: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const existing = await prisma.marketingCampaignRecipient.count({
    where: { campaignId: campaign.id, tenantId: campaign.tenantId },
  });
  if (existing > 0) return campaign;

  const contacts = await evaluateSegmentContacts(campaign.tenantId, campaign.segment.rules);
  const suppressions = await prisma.marketingSuppression.findMany({
    where: { tenantId: campaign.tenantId },
  });

  const recipients = buildRecipientEntries({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contacts,
    suppressions,
  });

  if (recipients.length) {
    await prisma.marketingCampaignRecipient.createMany({
      data: recipients,
      skipDuplicates: true,
    });
  }

  await prisma.marketingCampaign.updateMany({
    where: { id: campaignId, recipientsPreparedAt: null },
    data: { recipientsPreparedAt: new Date() },
  });

  return campaign;
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

function startOfDayUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextRetryAt(retryCount: number) {
  const baseDelay = Math.max(1, BASE_RETRY_DELAY_SECONDS);
  const backoffSeconds = Math.min(
    baseDelay * Math.pow(2, Math.max(0, retryCount)),
    MAX_RETRY_DELAY_MINUTES * 60
  );
  return new Date(Date.now() + backoffSeconds * 1000);
}

function parseSendError(error: any) {
  const message = String(error?.message || 'Send failed');
  const match = message.match(/SendGrid error: (\d{3})/);
  const status = match ? Number(match[1]) : null;
  const retryable =
    (status !== null && (status === 429 || status >= 500)) ||
    /timeout|temporarily|rate limit|too many requests|network/i.test(message);
  return { message, status, retryable };
}

async function reserveDailySendSlot(tenantId: string, dailyLimit: number) {
  const day = startOfDayUtc();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketingDailySendCounter.findUnique({
      where: { tenantId_day: { tenantId, day } },
    });
    let currentCount = existing?.count ?? 0;
    if (!existing) {
      const sentToday = await tx.marketingCampaignRecipient.count({
        where: {
          tenantId,
          status: MarketingRecipientStatus.SENT,
          sentAt: { gte: day },
        },
      });
      currentCount = sentToday;
    }
    if (currentCount >= dailyLimit) {
      return { allowed: false, count: currentCount };
    }
    if (existing) {
      const updated = await tx.marketingDailySendCounter.update({
        where: { tenantId_day: { tenantId, day } },
        data: { count: { increment: 1 } },
      });
      return { allowed: true, count: updated.count };
    }
    const created = await tx.marketingDailySendCounter.create({
      data: { tenantId, day, count: currentCount + 1 },
    });
    return { allowed: true, count: created.count };
  });
}

async function refreshCampaignLock(campaignId: string) {
  const lockUntil = new Date(Date.now() + CAMPAIGN_LOCK_MINUTES * 60 * 1000);
  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { sendLockedUntil: lockUntil },
  });
}

export async function ensureDailyLimit(tenantId: string, upcomingCount: number) {
  const settings = await fetchMarketingSettings(tenantId);
  const start = startOfDayUtc();
  const sentToday = await prisma.marketingCampaignRecipient.count({
    where: {
      tenantId,
      status: MarketingRecipientStatus.SENT,
      sentAt: { gte: start },
    },
  });
  const dailyLimit = resolveDailyLimit(settings, DAILY_LIMIT);
  if (sentToday + upcomingCount > dailyLimit) {
    throw new Error('Daily marketing send limit reached.');
  }
}

export async function processCampaignSend(campaignId: string) {
  const campaign = await ensureRecipients(campaignId);
  if (campaign.status === MarketingCampaignStatus.CANCELLED) return;

  await refreshCampaignLock(campaignId);

  const settings = await fetchMarketingSettings(campaign.tenantId);
  const sender = resolveSenderDetails({
    templateFromName: campaign.template.fromName,
    templateFromEmail: campaign.template.fromEmail,
    templateReplyTo: campaign.template.replyTo,
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

  const provider = getEmailProvider(settings);

  const tenant = await prisma.user.findUnique({
    where: { id: campaign.tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const dailyLimit = resolveDailyLimit(settings, DAILY_LIMIT);

  while (true) {
    await refreshCampaignLock(campaignId);
    const recipients = await prisma.marketingCampaignRecipient.findMany({
      where: {
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        status: { in: [MarketingRecipientStatus.PENDING, MarketingRecipientStatus.RETRYABLE] },
        OR: [{ retryAt: null }, { retryAt: { lte: new Date() } }],
      },
      take: BATCH_SIZE,
    });

    if (!recipients.length) break;

    for (const recipient of recipients) {
      const slot = await reserveDailySendSlot(campaign.tenantId, dailyLimit);
      if (!slot.allowed) {
        await prisma.marketingCampaign.update({
          where: { id: campaign.id },
          data: { status: MarketingCampaignStatus.PAUSED_LIMIT, sendLockedUntil: null },
        });
        return;
      }

      const contact = await prisma.marketingContact.findUnique({
        where: { id: recipient.contactId },
        select: { firstName: true, lastName: true, email: true },
      });
      const unsubscribeUrl = await buildUnsubscribeUrl(campaign.tenantId, recipient.email);
      const preferencesUrl = await buildPreferencesUrl(campaign.tenantId, recipient.email);
      const recommendedShows = await buildRecommendedShowsHtml(campaign.tenantId, recipient.email);

      const { html, errors } = renderMarketingTemplate(campaign.template.mjmlBody, {
        firstName: contact?.firstName || '',
        lastName: contact?.lastName || '',
        email: recipient.email,
        tenantName: tenantNameFrom(tenant),
        unsubscribeUrl,
        preferencesUrl,
        recommendedShows: recommendedShows || '',
      });

      if (errors.length) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MarketingRecipientStatus.FAILED,
            errorText: errors.join('; '),
            lastAttemptAt: new Date(),
          },
        });
        continue;
      }

      try {
        const listUnsubscribeMail = buildListUnsubscribeMail(sender.fromEmail) || undefined;
        const headers: Record<string, string> = {
          'List-Unsubscribe': [listUnsubscribeMail, `<${unsubscribeUrl}>`].filter(Boolean).join(', '),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };

        const result = await provider.sendEmail({
          to: recipient.email,
          subject: campaign.template.subject,
          html,
          fromName: sender.fromName,
          fromEmail: applyMarketingStreamToEmail(sender.fromEmail, settings),
          replyTo: sender.replyTo,
          headers,
          customArgs: {
            campaignId: campaign.id,
            tenantId: campaign.tenantId,
            contactId: recipient.contactId,
          },
        });

        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MarketingRecipientStatus.SENT,
            sentAt: new Date(),
            errorText: null,
            lastAttemptAt: new Date(),
            retryAt: null,
          },
        });

        await prisma.marketingWorkerState.upsert({
          where: { id: 'global' },
          update: { lastSendAt: new Date() },
          create: { id: 'global', lastSendAt: new Date(), lastWorkerRunAt: null },
        });

        await prisma.marketingEmailEvent.create({
          data: {
            tenantId: campaign.tenantId,
            campaignId: campaign.id,
            contactId: recipient.contactId,
            email: recipient.email,
            type: MarketingEmailEventType.DELIVERED,
            meta: { provider: 'sendgrid' },
          },
        });

        console.info('[marketing:send]', {
          campaignId: campaign.id,
          recipientId: recipient.id,
          providerId: result.id,
          providerStatus: result.status,
          providerResponse: result.response || null,
        });
      } catch (error: any) {
        const parsed = parseSendError(error);
        const nextStatus = parsed.retryable ? MarketingRecipientStatus.RETRYABLE : MarketingRecipientStatus.FAILED;
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: nextStatus,
            errorText: parsed.message,
            retryAt: parsed.retryable ? nextRetryAt(recipient.retryCount) : null,
            retryCount: parsed.retryable ? recipient.retryCount + 1 : recipient.retryCount,
            lastAttemptAt: new Date(),
          },
        });
        console.error('[marketing:send:error]', {
          campaignId: campaign.id,
          recipientId: recipient.id,
          error: parsed.message,
          retryable: parsed.retryable,
        });
      }

      const sendRate = resolveSendRate(settings, RATE_PER_SEC);
      const delay = Math.max(0, Math.floor(1000 / Math.max(1, sendRate)));
      if (delay) {
        await sleep(delay);
      }
    }
  }

  const remaining = await prisma.marketingCampaignRecipient.count({
    where: {
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      status: { in: [MarketingRecipientStatus.PENDING, MarketingRecipientStatus.RETRYABLE] },
    },
  });
  if (remaining > 0) {
    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: MarketingCampaignStatus.SENDING, sendLockedUntil: null },
    });
    return;
  }

  const failures = await prisma.marketingCampaignRecipient.count({
    where: {
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      status: MarketingRecipientStatus.FAILED,
    },
  });
  const finalStatus = failures > 0 ? MarketingCampaignStatus.FAILED : MarketingCampaignStatus.SENT;
  await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: {
      status: finalStatus,
      sendLockedUntil: null,
      sentAt: finalStatus === MarketingCampaignStatus.SENT ? new Date() : null,
    },
  });

  const actorUserId = campaign.approvedByUserId || campaign.scheduledByUserId || null;
  const actor =
    actorUserId
      ? await prisma.user.findUnique({ where: { id: actorUserId }, select: { email: true } })
      : null;
  await prisma.marketingAuditLog.create({
    data: {
      tenantId: campaign.tenantId,
      actorUserId,
      actorEmail: actor?.email || null,
      action: finalStatus === MarketingCampaignStatus.SENT ? 'campaign.sent' : 'campaign.failed',
      entityType: 'MarketingCampaign',
      entityId: campaign.id,
      metadata: { failures },
    },
  });
}

export async function processScheduledCampaigns() {
  const now = new Date();
  const scheduled = await prisma.marketingCampaign.findMany({
    where: {
      status: MarketingCampaignStatus.SCHEDULED,
      scheduledFor: { lte: now },
      OR: [{ sendLockedUntil: null }, { sendLockedUntil: { lte: now } }],
    },
    select: { id: true },
  });

  for (const campaign of scheduled) {
    const lockUntil = new Date(Date.now() + CAMPAIGN_LOCK_MINUTES * 60 * 1000);
    const locked = await prisma.marketingCampaign.updateMany({
      where: {
        id: campaign.id,
        status: MarketingCampaignStatus.SCHEDULED,
        OR: [{ sendLockedUntil: null }, { sendLockedUntil: { lte: now } }],
      },
      data: { status: MarketingCampaignStatus.SENDING, sendLockedUntil: lockUntil },
    });
    if (locked.count === 0) continue;
    try {
      await processCampaignSend(campaign.id);
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: MarketingCampaignStatus.FAILED, sendLockedUntil: null },
      });
      console.error('Failed to send marketing campaign', { campaignId: campaign.id, error });
    }
  }
}

export async function processSendingCampaigns() {
  const now = new Date();
  const campaigns = await prisma.marketingCampaign.findMany({
    where: {
      status: { in: [MarketingCampaignStatus.SENDING, MarketingCampaignStatus.PAUSED_LIMIT] },
      OR: [{ sendLockedUntil: null }, { sendLockedUntil: { lte: now } }],
    },
    select: { id: true },
  });

  for (const campaign of campaigns) {
    const lockUntil = new Date(Date.now() + CAMPAIGN_LOCK_MINUTES * 60 * 1000);
    const locked = await prisma.marketingCampaign.updateMany({
      where: {
        id: campaign.id,
        status: { in: [MarketingCampaignStatus.SENDING, MarketingCampaignStatus.PAUSED_LIMIT] },
        OR: [{ sendLockedUntil: null }, { sendLockedUntil: { lte: now } }],
      },
      data: { status: MarketingCampaignStatus.SENDING, sendLockedUntil: lockUntil },
    });
    if (locked.count === 0) continue;
    try {
      await processCampaignSend(campaign.id);
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: MarketingCampaignStatus.FAILED, sendLockedUntil: null },
      });
      console.error('Failed to resume marketing campaign', { campaignId: campaign.id, error });
    }
  }
}

export async function applySuppression(
  tenantId: string,
  email: string,
  type: MarketingSuppressionType,
  reason?: string | null,
  source: MarketingConsentSource = MarketingConsentSource.API
) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const existing = await prisma.marketingSuppression.findFirst({
    where: { tenantId, email: normalizedEmail },
  });

  let suppressionId = existing?.id || null;
  if (existing) {
    const updated = await prisma.marketingSuppression.update({
      where: { id: existing.id },
      data: { type, reason: reason || null },
    });
    suppressionId = updated.id;
  } else {
    const created = await prisma.marketingSuppression.create({
      data: { tenantId, email: normalizedEmail, type, reason: reason || null },
    });
    suppressionId = created.id;
  }
  await recordSuppressionAudit(tenantId, 'suppression.updated', suppressionId, {
    email: normalizedEmail,
    type,
    reason: reason || null,
  });

  const contact = await prisma.marketingContact.findUnique({
    where: { tenantId_email: { tenantId, email: normalizedEmail } },
  });

  if (contact) {
    let status: MarketingConsentStatus = MarketingConsentStatus.UNSUBSCRIBED;
    if (type === MarketingSuppressionType.HARD_BOUNCE) status = MarketingConsentStatus.BOUNCED;
    if (type === MarketingSuppressionType.SPAM_COMPLAINT) status = MarketingConsentStatus.COMPLAINED;

    await prisma.marketingConsent.upsert({
      where: { tenantId_contactId: { tenantId, contactId: contact.id } },
      create: {
        tenantId,
        contactId: contact.id,
        status,
        lawfulBasis: MarketingLawfulBasis.UNKNOWN,
        source,
        capturedAt: new Date(),
      },
      update: {
        status,
        source,
      },
    });
    await recordConsentAudit(tenantId, 'consent.updated', contact.id, { status, source, email: normalizedEmail });
  }
}

export async function clearSuppression(tenantId: string, email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  const deleted = await prisma.marketingSuppression.deleteMany({
    where: { tenantId, email: normalizedEmail },
  });
  if (deleted.count > 0) {
    await recordSuppressionAudit(tenantId, 'suppression.cleared', null, { email: normalizedEmail });
  }
}
