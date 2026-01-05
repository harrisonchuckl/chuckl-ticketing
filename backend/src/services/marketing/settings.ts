import prisma from '../../lib/prisma.js';
import { MarketingSenderMode, MarketingVerifiedStatus } from '@prisma/client';

export type MarketingSettingsSnapshot = {
  tenantId: string;
  defaultFromName: string | null;
  defaultFromEmail: string | null;
  defaultReplyTo: string | null;
  requireVerifiedFrom: boolean;
  sendingMode: MarketingSenderMode;
  verifiedStatus: MarketingVerifiedStatus;
  sendgridDomain: string | null;
  sendgridSubdomain: string | null;
  sendgridDomainId: string | null;
  sendgridDnsRecords: any | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUserEncrypted: string | null;
  smtpPassEncrypted: string | null;
  smtpSecure: boolean | null;
  smtpLastTestAt: Date | null;
  dailyLimitOverride: number | null;
  sendRatePerSecOverride: number | null;
};

export async function fetchMarketingSettings(tenantId: string) {
  return prisma.marketingSettings.findUnique({ where: { tenantId } });
}

function normalizeValue(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed.length ? trimmed : null;
}

export function resolveSenderDetails(options: {
  templateFromName?: string | null;
  templateFromEmail?: string | null;
  templateReplyTo?: string | null;
  settings?: MarketingSettingsSnapshot | null;
}) {
  const fromName = normalizeValue(options.templateFromName) ?? normalizeValue(options.settings?.defaultFromName);
  const fromEmail = normalizeValue(options.templateFromEmail) ?? normalizeValue(options.settings?.defaultFromEmail);
  const replyTo = normalizeValue(options.templateReplyTo) ?? normalizeValue(options.settings?.defaultReplyTo);
  return { fromName, fromEmail, replyTo };
}

export function resolveDailyLimit(settings: MarketingSettingsSnapshot | null, fallback: number) {
  return settings?.dailyLimitOverride ?? fallback;
}

export function resolveSendRate(settings: MarketingSettingsSnapshot | null, fallback: number) {
  return settings?.sendRatePerSecOverride ?? fallback;
}

export function resolveRequireVerifiedFrom(settings: MarketingSettingsSnapshot | null, fallback: boolean) {
  return settings?.requireVerifiedFrom ?? fallback;
}

export function resolveSendingMode(
  settings: MarketingSettingsSnapshot | null,
  fallback: MarketingSenderMode = MarketingSenderMode.SENDGRID
) {
  return settings?.sendingMode ?? fallback;
}

export function resolveVerifiedStatus(settings: MarketingSettingsSnapshot | null) {
  return settings?.verifiedStatus ?? MarketingVerifiedStatus.UNVERIFIED;
}

export function applyMarketingStreamToEmail(fromEmail: string, settings?: MarketingSettingsSnapshot | null) {
  const mode = resolveSendingMode(settings ?? null);
  if (mode !== MarketingSenderMode.SENDGRID) return fromEmail;
  const streamDomain = String(process.env.MARKETING_STREAM_DOMAIN || '').trim();
  if (!streamDomain) return fromEmail;
  const at = fromEmail.indexOf('@');
  if (at === -1) return fromEmail;
  return `${fromEmail.slice(0, at)}@${streamDomain}`;
}

export function buildListUnsubscribeMail(fromEmail: string) {
  const parts = String(fromEmail || '').split('@');
  if (parts.length < 2) return null;
  const domain = parts[1];
  if (!domain) return null;
  return `<mailto:unsubscribe@${domain}?subject=unsubscribe>`;
}

export function assertSenderVerified(options: {
  fromEmail: string;
  settings: MarketingSettingsSnapshot | null;
  requireVerifiedFrom: boolean;
  allowUnverified?: boolean;
}) {
  const fromEmail = String(options.fromEmail || '').trim();
  if (!fromEmail) {
    throw new Error('From email required for marketing sends.');
  }

  const settings = options.settings;
  const mode = resolveSendingMode(settings);
  const verifiedStatus = resolveVerifiedStatus(settings);
  const domain = settings?.sendgridDomain;

  if (mode === MarketingSenderMode.SENDGRID && domain) {
    if (!fromEmail.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
      throw new Error(`From email must use the verified domain (${domain}).`);
    }
  }

  if (!options.allowUnverified && verifiedStatus !== MarketingVerifiedStatus.VERIFIED) {
    throw new Error('Sender domain is not verified. Complete verification before sending.');
  }
}
