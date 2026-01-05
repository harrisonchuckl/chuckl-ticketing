import prisma from '../../lib/prisma.js';

export type MarketingSettingsSnapshot = {
  tenantId: string;
  defaultFromName: string | null;
  defaultFromEmail: string | null;
  defaultReplyTo: string | null;
  requireVerifiedFrom: boolean;
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
