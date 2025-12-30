import prisma from '../../lib/prisma.js';
import { getEmailProvider } from '../../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../../lib/email-marketing/unsubscribe.js';
import { renderMarketingTemplate } from '../../lib/email-marketing/rendering.js';
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

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

const RATE_PER_SEC = Number(process.env.MARKETING_SEND_RATE_PER_SEC || 50);
const BATCH_SIZE = Number(process.env.MARKETING_SEND_BATCH_SIZE || 50);
const DAILY_LIMIT = Number(process.env.MARKETING_DAILY_LIMIT || 50000);
const REQUIRE_VERIFIED_FROM = String(process.env.MARKETING_REQUIRE_VERIFIED_FROM || 'true') === 'true';
const VERIFIED_FROM_DOMAIN = String(process.env.MARKETING_FROM_DOMAIN || '').trim();

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

function isFromVerified(fromEmail: string) {
  if (!REQUIRE_VERIFIED_FROM || !VERIFIED_FROM_DOMAIN) return true;
  return fromEmail.toLowerCase().endsWith(`@${VERIFIED_FROM_DOMAIN.toLowerCase()}`);
}

export async function ensureDailyLimit(tenantId: string, upcomingCount: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const sentToday = await prisma.marketingCampaignRecipient.count({
    where: {
      tenantId,
      status: MarketingRecipientStatus.SENT,
      sentAt: { gte: start },
    },
  });
  if (sentToday + upcomingCount > DAILY_LIMIT) {
    throw new Error('Daily marketing send limit reached.');
  }
}

export async function processCampaignSend(campaignId: string) {
  const campaign = await ensureRecipients(campaignId);
  if (campaign.status === MarketingCampaignStatus.CANCELLED) return;

  if (!isFromVerified(campaign.template.fromEmail)) {
    throw new Error('From email not verified for marketing sends.');
  }

  const provider = getEmailProvider();

  const tenant = await prisma.user.findUnique({
    where: { id: campaign.tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  while (true) {
    const recipients = await prisma.marketingCampaignRecipient.findMany({
      where: {
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        status: MarketingRecipientStatus.PENDING,
      },
      take: BATCH_SIZE,
    });

    if (!recipients.length) break;

    for (const recipient of recipients) {
      const contact = await prisma.marketingContact.findUnique({
        where: { id: recipient.contactId },
        select: { firstName: true, lastName: true, email: true },
      });
      const unsubscribeUrl = await buildUnsubscribeUrl(campaign.tenantId, recipient.email);

      const { html, errors } = renderMarketingTemplate(campaign.template.mjmlBody, {
        firstName: contact?.firstName || '',
        lastName: contact?.lastName || '',
        email: recipient.email,
        tenantName: tenantNameFrom(tenant),
        unsubscribeUrl,
      });

      if (errors.length) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: MarketingRecipientStatus.FAILED, errorText: errors.join('; ') },
        });
        continue;
      }

      try {
        const listUnsubscribeMail = VERIFIED_FROM_DOMAIN
          ? `<mailto:unsubscribe@${VERIFIED_FROM_DOMAIN}?subject=unsubscribe>`
          : undefined;
        const headers: Record<string, string> = {
          'List-Unsubscribe': [listUnsubscribeMail, `<${unsubscribeUrl}>`].filter(Boolean).join(', '),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };

        await provider.sendEmail({
          to: recipient.email,
          subject: campaign.template.subject,
          html,
          fromName: campaign.template.fromName,
          fromEmail: campaign.template.fromEmail,
          replyTo: campaign.template.replyTo,
          headers,
          customArgs: {
            campaignId: campaign.id,
            tenantId: campaign.tenantId,
            contactId: recipient.contactId,
          },
        });

        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: MarketingRecipientStatus.SENT, sentAt: new Date(), errorText: null },
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
      } catch (error: any) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: MarketingRecipientStatus.FAILED, errorText: error?.message || 'Send failed' },
        });
      }

      const delay = Math.max(0, Math.floor(1000 / Math.max(1, RATE_PER_SEC)));
      if (delay) {
        await sleep(delay);
      }
    }
  }

  await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: { status: MarketingCampaignStatus.SENT },
  });
}

export async function processScheduledCampaigns() {
  const now = new Date();
  const scheduled = await prisma.marketingCampaign.findMany({
    where: {
      status: MarketingCampaignStatus.SCHEDULED,
      scheduledFor: { lte: now },
    },
    select: { id: true },
  });

  for (const campaign of scheduled) {
    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: MarketingCampaignStatus.SENDING },
    });
    try {
      await processCampaignSend(campaign.id);
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: MarketingCampaignStatus.CANCELLED },
      });
      console.error('Failed to send marketing campaign', { campaignId: campaign.id, error });
    }
  }
}

export async function processSendingCampaigns() {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { status: MarketingCampaignStatus.SENDING },
    select: { id: true },
  });

  for (const campaign of campaigns) {
    try {
      await processCampaignSend(campaign.id);
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: MarketingCampaignStatus.CANCELLED },
      });
      console.error('Failed to resume marketing campaign', { campaignId: campaign.id, error });
    }
  }
}

export async function applySuppression(
  tenantId: string,
  email: string,
  type: MarketingSuppressionType,
  reason?: string | null
) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const existing = await prisma.marketingSuppression.findFirst({
    where: { tenantId, email: normalizedEmail },
  });

  if (existing) {
    await prisma.marketingSuppression.update({
      where: { id: existing.id },
      data: { type, reason: reason || null },
    });
  } else {
    await prisma.marketingSuppression.create({
      data: { tenantId, email: normalizedEmail, type, reason: reason || null },
    });
  }

  const contact = await prisma.marketingContact.findUnique({
    where: { tenantId_email: { tenantId, email: normalizedEmail } },
  });

  if (contact) {
    let status = MarketingConsentStatus.UNSUBSCRIBED;
    if (type === MarketingSuppressionType.HARD_BOUNCE) status = MarketingConsentStatus.BOUNCED;
    if (type === MarketingSuppressionType.SPAM_COMPLAINT) status = MarketingConsentStatus.COMPLAINED;

    await prisma.marketingConsent.upsert({
      where: { tenantId_contactId: { tenantId, contactId: contact.id } },
      create: {
        tenantId,
        contactId: contact.id,
        status,
        lawfulBasis: MarketingLawfulBasis.UNKNOWN,
        source: MarketingConsentSource.API,
        capturedAt: new Date(),
      },
      update: {
        status,
      },
    });
  }
}
