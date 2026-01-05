import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';
import { isOwnerEmail } from '../lib/owner-authz.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { renderMarketingTemplate } from '../lib/email-marketing/rendering.js';
import { getEmailProvider } from '../lib/email-marketing/index.js';
import { createUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../lib/email-marketing/preferences.js';
import { encryptToken } from '../lib/token-crypto.js';
import {
  MarketingAutomationTriggerType,
  MarketingCampaignStatus,
  MarketingConsentSource,
  MarketingConsentStatus,
  MarketingLawfulBasis,
  MarketingSuppressionType,
  MarketingImportJobStatus,
  MarketingRecipientStatus,
  MarketingSenderMode,
  MarketingVerifiedStatus,
  Prisma,
} from '@prisma/client';
import { evaluateSegmentContacts, estimateSegment } from '../services/marketing/segments.js';
import { applySuppression, clearSuppression, ensureDailyLimit, shouldSuppressContact } from '../services/marketing/campaigns.js';
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
  fetchDeliverabilitySummary,
  fetchTopSegmentsByEngagement,
  recordAutomationAudit,
  recordDeliverabilityAudit,
  recordPreferenceAudit,
  warmupPresets,
} from '../services/marketing/automations.js';
import { ensureDefaultPreferenceTopics } from '../services/marketing/preferences.js';
import { recordConsentAudit } from '../services/marketing/audit.js';

const router = Router();

function tenantIdFrom(req: any) {
  return String(req.user?.id || '');
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

async function logMarketingAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
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


router.get('/marketing/health', requireAdminOrOwner, async (_req, res) => {
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

router.get('/marketing/insights/health', requireAdminOrOwner, async (_req, res) => {
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

router.get('/marketing/insights', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/insights/query', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const payload = req.body || {};
  const limit = Number(payload.limit || 100);
  const results = await queryCustomerInsights(tenantId, payload.rules, limit);
  res.json({ ok: true, ...results });
});

router.get('/marketing/settings', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/settings', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const payload = req.body || {};

  const existing = await prisma.marketingSettings.findUnique({
    where: { tenantId },
    select: { defaultFromEmail: true },
  });

  const defaultFromName = hasOwn(payload, 'defaultFromName') ? String(payload.defaultFromName || '').trim() : undefined;
  const defaultFromEmail = hasOwn(payload, 'defaultFromEmail') ? String(payload.defaultFromEmail || '').trim() : undefined;
  const defaultReplyTo = hasOwn(payload, 'defaultReplyTo') ? String(payload.defaultReplyTo || '').trim() : undefined;
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
      dailyLimitOverride: Number.isFinite(dailyLimitOverride) ? dailyLimitOverride : null,
      sendRatePerSecOverride: Number.isFinite(sendRatePerSecOverride) ? sendRatePerSecOverride : null,
    },
    update: {
      defaultFromName: defaultFromName !== undefined ? (defaultFromName ? defaultFromName : null) : undefined,
      defaultFromEmail: defaultFromEmail !== undefined ? (defaultFromEmail ? defaultFromEmail : null) : undefined,
      defaultReplyTo: defaultReplyTo !== undefined ? (defaultReplyTo ? defaultReplyTo : null) : undefined,
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

router.get('/marketing/sender-identity', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/sender-identity', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/sender-identity/sendgrid/start', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/sender-identity/sendgrid/refresh', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/sender-identity/test-send', requireAdminOrOrganiser, async (req, res) => {
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

router.get('/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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

router.post('/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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
    },
    update: {
      firstName: req.body?.firstName || undefined,
      lastName: req.body?.lastName || undefined,
      phone: req.body?.phone || undefined,
      town: req.body?.town || undefined,
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

  await logMarketingAudit(tenantId, 'contact.saved', 'MarketingContact', contact.id, { email });

  res.json({ ok: true, contactId: contact.id });
});

router.post('/marketing/imports', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const csvText = String(req.body?.csv || req.body?.csvText || req.body?.text || '').trim();
  if (!csvText) return res.status(400).json({ ok: false, message: 'CSV required' });

  const filename = String(req.body?.filename || '').trim() || null;
  const requestedLawfulBasis = String(req.body?.lawfulBasis || '').trim();
  const lawfulBasis =
    requestedLawfulBasis === MarketingLawfulBasis.LEGITIMATE_INTEREST
      ? MarketingLawfulBasis.LEGITIMATE_INTEREST
      : MarketingLawfulBasis.CONSENT;

  const job = await prisma.marketingImportJob.create({
    data: {
      tenantId,
      filename,
      status: MarketingImportJobStatus.PROCESSING,
    },
  });

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
          errorsJson: { message: 'No rows found' },
        },
      });
      return res.status(400).json({ ok: false, message: 'No rows found' });
    }

    const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const emailHeaderIndex = headerRow.findIndex((value) => value === 'email' || value === 'e-mail');
    const hasHeader = emailHeaderIndex >= 0;
    const firstNameIndex = headerRow.findIndex((value) => value === 'first_name' || value === 'firstname');
    const lastNameIndex = headerRow.findIndex((value) => value === 'last_name' || value === 'lastname');
    const phoneIndex = headerRow.findIndex((value) => value === 'phone' || value === 'phone_number');
    const townIndex = headerRow.findIndex((value) => value === 'town' || value === 'city');

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const emailIndex = hasHeader ? emailHeaderIndex : 0;

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
        errorsJson: rowErrors.length ? { total: rowErrors.length } : Prisma.DbNull,
      },
    });

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
        errorsJson: { message: 'Import failed' },
      },
    });
    return res.status(500).json({ ok: false, message: 'Import failed' });
  }
});

router.get('/marketing/imports', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingImportJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ ok: true, items });
});

router.get('/marketing/imports/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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

router.get('/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingSegment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, description, rules } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

  const segment = await prisma.marketingSegment.create({
    data: {
      tenantId,
      name,
      description: description || null,
      rules: rules || { rules: [] },
    },
  });
  await logMarketingAudit(tenantId, 'segment.created', 'MarketingSegment', segment.id, { name });
  res.json({ ok: true, segment });
});

router.put('/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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
  await logMarketingAudit(tenantId, 'segment.updated', 'MarketingSegment', segment.id, { name });
  res.json({ ok: true, segment });
});

router.delete('/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const existing = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Segment not found' });
  await prisma.marketingSegment.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'segment.deleted', 'MarketingSegment', id);
  res.json({ ok: true });
});

router.get('/marketing/segments/:id/estimate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const estimate = await estimateSegment(tenantId, segment.rules);
  res.json({ ok: true, estimate });
});

router.post('/marketing/segments/:id/estimate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const estimate = await estimateSegment(tenantId, segment.rules);
  res.json({ ok: true, estimate });
});

router.get('/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingTemplate.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.get('/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingAutomation.findMany({
    where: { tenantId },
    include: { steps: { include: { template: true }, orderBy: { stepOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, triggerType, isEnabled } = req.body || {};
  if (!name || !triggerType) return res.status(400).json({ ok: false, message: 'Name + trigger required' });

  const automation = await prisma.marketingAutomation.create({
    data: {
      tenantId,
      name,
      triggerType: triggerType as MarketingAutomationTriggerType,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.created', automation.id, { triggerType });

  res.json({ ok: true, automation });
});

router.put('/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, triggerType, isEnabled } = req.body || {};

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const automation = await prisma.marketingAutomation.update({
    where: { id },
    data: {
      name: name || undefined,
      triggerType: triggerType || undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.updated', automation.id, { triggerType, isEnabled });

  res.json({ ok: true, automation });
});

router.delete('/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  await prisma.marketingAutomation.delete({ where: { id } });
  await recordAutomationAudit(tenantId, 'automation.deleted', id);
  res.json({ ok: true });
});

router.post('/marketing/automations/:id/steps', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const { delayMinutes, templateId, conditionRules, stepOrder } = req.body || {};
  if (!templateId || stepOrder === undefined) {
    return res.status(400).json({ ok: false, message: 'Template + step order required' });
  }

  const automation = await prisma.marketingAutomation.findFirst({ where: { id: automationId, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const step = await prisma.marketingAutomationStep.create({
    data: {
      tenantId,
      automationId,
      delayMinutes: Number(delayMinutes || 0),
      templateId,
      conditionRules: conditionRules || {},
      stepOrder: Number(stepOrder),
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.created', automationId, { stepId: step.id });
  res.json({ ok: true, step });
});

router.put('/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const stepId = String(req.params.stepId);
  const { delayMinutes, templateId, conditionRules, stepOrder } = req.body || {};

  const existing = await prisma.marketingAutomationStep.findFirst({
    where: { id: stepId, tenantId, automationId },
  });
  if (!existing) return res.status(404).json({ ok: false, message: 'Step not found' });

  const step = await prisma.marketingAutomationStep.update({
    where: { id: stepId },
    data: {
      delayMinutes: delayMinutes !== undefined ? Number(delayMinutes) : undefined,
      templateId: templateId || undefined,
      conditionRules: conditionRules || undefined,
      stepOrder: stepOrder !== undefined ? Number(stepOrder) : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.updated', automationId, { stepId });
  res.json({ ok: true, step });
});

router.delete('/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
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

router.get('/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  await ensureDefaultPreferenceTopics(tenantId);
  const items = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.get('/marketing/consent/summary', requireAdminOrOrganiser, async (req, res) => {
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

router.get('/marketing/consent/check', requireAdminOrOrganiser, async (req, res) => {
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

router.post('/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
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

router.put('/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
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

router.delete('/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingPreferenceTopic.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Topic not found' });

  await prisma.marketingPreferenceTopic.delete({ where: { id } });
  await recordPreferenceAudit(tenantId, 'preferences.topic.deleted', id);
  res.json({ ok: true });
});

router.get('/marketing/deliverability/summary', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const summary = await fetchDeliverabilitySummary(tenantId, days);
  await recordDeliverabilityAudit(tenantId, { days });
  res.json({ ok: true, summary });
});

router.get('/marketing/deliverability/top-segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const items = await fetchTopSegmentsByEngagement(tenantId, days);
  res.json({ ok: true, items });
});

router.get('/marketing/deliverability/warmup', requireAdminOrOrganiser, async (_req, res) => {
  res.json({ ok: true, data: warmupPresets() });
});

router.post('/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody } = req.body || {};
  if (!name || !subject || !mjmlBody) {
    return res.status(400).json({ ok: false, message: 'Missing template fields' });
  }

  const template = await prisma.marketingTemplate.create({
    data: {
      tenantId,
      name,
      subject,
      fromName: String(fromName || '').trim(),
      fromEmail: String(fromEmail || '').trim(),
      replyTo: replyTo ? String(replyTo).trim() : null,
      mjmlBody,
    },
  });
  await logMarketingAudit(tenantId, 'template.created', 'MarketingTemplate', template.id, { name });
  res.json({ ok: true, template });
});

router.put('/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody } = req.body || {};

  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });

  const template = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      name: name || undefined,
      subject: subject || undefined,
      fromName: fromName !== undefined ? String(fromName || '').trim() : undefined,
      fromEmail: fromEmail !== undefined ? String(fromEmail || '').trim() : undefined,
      replyTo: replyTo !== undefined ? (replyTo ? String(replyTo).trim() : null) : undefined,
      mjmlBody: mjmlBody || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'template.updated', 'MarketingTemplate', template.id, { name });
  res.json({ ok: true, template });
});

router.delete('/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });
  await prisma.marketingTemplate.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'template.deleted', 'MarketingTemplate', id);
  res.json({ ok: true });
});

router.post('/marketing/templates/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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

  const { html, errors } = renderMarketingTemplate(template.mjmlBody, {
    firstName: req.body?.sample?.firstName || 'Sample',
    lastName: req.body?.sample?.lastName || 'User',
    email,
    tenantName: tenantNameFrom(tenant),
    unsubscribeUrl,
    preferencesUrl,
  });

  res.json({ ok: true, html, errors });
});

router.get('/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { name: true } },
      segment: { select: { name: true } },
    },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, templateId, segmentId } = req.body || {};
  if (!name || !templateId || !segmentId) {
    return res.status(400).json({ ok: false, message: 'Missing campaign fields' });
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      tenantId,
      name,
      templateId,
      segmentId,
      status: MarketingCampaignStatus.DRAFT,
      createdByUserId: tenantId,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.created', 'MarketingCampaign', campaign.id, { name });
  res.json({ ok: true, campaign });
});

router.put('/marketing/campaigns/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, templateId, segmentId } = req.body || {};

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      name: name || undefined,
      templateId: templateId || undefined,
      segmentId: segmentId || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.updated', 'MarketingCampaign', campaign.id, { name });
  res.json({ ok: true, campaign });
});

router.post('/marketing/campaigns/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { template: true, segment: true, tenant: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const estimate = await estimateSegment(tenantId, campaign.segment.rules);
  const sampleContact = await evaluateSegmentContacts(tenantId, campaign.segment.rules).then((c) => c[0]);
  const email = sampleContact?.email || 'sample@example.com';
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(preferencesToken)}`;

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

router.post('/marketing/campaigns/:id/test-send', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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

  const { html, errors } = renderMarketingTemplate(campaign.template.mjmlBody, {
    firstName,
    lastName,
    email,
    tenantName: tenantNameFrom(campaign.tenant),
    unsubscribeUrl,
    preferencesUrl,
  });

  if (errors.length) {
    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: false,
      errors,
    });
    return res.status(400).json({ ok: false, message: 'Template render failed', errors });
  }

  try {
    const provider = getEmailProvider(settings);
    const listUnsubscribeMail = buildListUnsubscribeMail(sender.fromEmail) || undefined;
    const headers: Record<string, string> = {
      'List-Unsubscribe': [listUnsubscribeMail, `<${unsubscribeUrl}>`].filter(Boolean).join(', '),
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    await provider.sendEmail({
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

    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: true,
    });

    res.json({ ok: true });
  } catch (error: any) {
    await logMarketingAudit(tenantId, 'campaign.test_send', 'MarketingCampaign', campaign.id, {
      email,
      success: false,
      error: error?.message || 'Send failed',
    });
    res.status(500).json({ ok: false, message: 'Test send failed' });
  }
});

router.post('/marketing/campaigns/:id/schedule', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const sendNow = Boolean(req.body?.sendNow);
  const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { segment: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const estimate = await estimateSegment(tenantId, campaign.segment.rules);
  const maxSegment = Number(process.env.MARKETING_MAX_SEGMENT || 20000);
  const role = String(req.user?.role || '').toUpperCase();
  if (estimate.count > maxSegment && role !== 'ADMIN') {
    return res.status(403).json({ ok: false, message: 'Segment too large for your role.' });
  }

  await ensureDailyLimit(tenantId, estimate.count);

  const nextStatus = MarketingCampaignStatus.SCHEDULED;
  const scheduledTime = sendNow ? new Date() : scheduledFor;

  if (!scheduledTime || isNaN(scheduledTime.getTime())) {
    return res.status(400).json({ ok: false, message: 'scheduledFor required' });
  }

  const updated = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: nextStatus,
      scheduledFor: scheduledTime,
    },
  });

  await logMarketingAudit(tenantId, 'campaign.scheduled', 'MarketingCampaign', updated.id, {
    scheduledFor: scheduledTime.toISOString(),
  });
  res.json({ ok: true, campaign: updated, estimate });
});

router.post('/marketing/campaigns/:id/cancel', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: { status: MarketingCampaignStatus.CANCELLED, sendLockedUntil: null },
  });

  await logMarketingAudit(tenantId, 'campaign.cancelled', 'MarketingCampaign', campaign.id);
  res.json({ ok: true, campaign });
});

router.get('/marketing/campaigns/:id/logs', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
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

router.get('/marketing/campaigns/:id/recipients', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const items = await prisma.marketingCampaignRecipient.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const summary = {
    total: items.length,
    sent: items.filter((r) => r.status === MarketingRecipientStatus.SENT).length,
    failed: items.filter((r) => r.status === MarketingRecipientStatus.FAILED).length,
    retryable: items.filter((r) => r.status === MarketingRecipientStatus.RETRYABLE).length,
    skipped: items.filter((r) => r.status === MarketingRecipientStatus.SKIPPED_SUPPRESSED).length,
  };

  res.json({ ok: true, items, summary });
});

router.get('/marketing/campaigns/:id/events', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const items = await prisma.marketingEmailEvent.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json({ ok: true, items });
});

export default router;
