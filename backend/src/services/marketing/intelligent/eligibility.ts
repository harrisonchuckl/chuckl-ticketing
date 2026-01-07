import { MarketingEmailEventType } from '@prisma/client';
import prisma from '../../../lib/prisma.js';

type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

const INTELLIGENT_PREFIX = 'IC:';
const DEFAULT_INTELLIGENT_CAP_30D = 3;

function normaliseEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function extractShowIdFromMergeContext(mergeContext: unknown): string | null {
  if (!mergeContext || typeof mergeContext !== 'object') return null;
  const context = mergeContext as Record<string, any>;
  const direct = context.showId || context.show?.id || context.show?.showId || null;
  if (!direct) return null;
  const trimmed = String(direct).trim();
  return trimmed ? trimmed : null;
}

export function resolveIntelligentSendCap(configJson: unknown) {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
    return DEFAULT_INTELLIGENT_CAP_30D;
  }
  const config = configJson as Record<string, any>;
  const raw = config.maxEmailsPer30DaysPerContact;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_INTELLIGENT_CAP_30D;
  return Math.max(0, value);
}

export async function countIntelligentSendsLast30d(
  tenantId: string,
  email: string,
  maxEmailsPer30DaysPerContact = DEFAULT_INTELLIGENT_CAP_30D
): Promise<EligibilityResult> {
  const normalizedEmail = normaliseEmail(email);
  if (!tenantId || !normalizedEmail) {
    return { eligible: false, reasons: ['missing_tenant_or_email'] };
  }

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cap = Math.max(0, Number(maxEmailsPer30DaysPerContact) || 0);

  const count = await prisma.marketingEmailEvent.count({
    where: {
      tenantId,
      email: { equals: normalizedEmail, mode: 'insensitive' },
      type: MarketingEmailEventType.DELIVERED,
      createdAt: { gte: from },
      campaign: { name: { startsWith: INTELLIGENT_PREFIX } },
    },
  });

  if (count >= cap) {
    return {
      eligible: false,
      reasons: [`intelligent_send_cap_reached:${count}`],
    };
  }

  return { eligible: true, reasons: [] };
}

export async function hasEmailedShowRecently(
  tenantId: string,
  email: string,
  showId: string,
  cooldownDays: number
): Promise<EligibilityResult> {
  const normalizedEmail = normaliseEmail(email);
  const normalizedShowId = String(showId || '').trim();
  if (!tenantId || !normalizedEmail || !normalizedShowId) {
    return { eligible: false, reasons: ['missing_tenant_email_or_show'] };
  }

  const safeCooldown = Math.max(0, Number(cooldownDays) || 0);
  if (safeCooldown === 0) {
    return { eligible: true, reasons: [] };
  }

  const from = new Date(Date.now() - safeCooldown * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.marketingSendSnapshot.findMany({
    where: {
      tenantId,
      recipientEmail: { equals: normalizedEmail, mode: 'insensitive' },
      createdAt: { gte: from },
      campaign: { name: { startsWith: INTELLIGENT_PREFIX } },
    },
    select: {
      mergeContext: true,
      campaign: { select: { showId: true } },
    },
  });

  const matchInSnapshots = snapshots.some((snapshot) => {
    if (snapshot.campaign?.showId && snapshot.campaign.showId === normalizedShowId) return true;
    const mergeShowId = extractShowIdFromMergeContext(snapshot.mergeContext);
    return mergeShowId === normalizedShowId;
  });

  if (matchInSnapshots) {
    return { eligible: false, reasons: ['intelligent_show_recently_emailed'] };
  }

  const recentEvent = await prisma.marketingEmailEvent.findFirst({
    where: {
      tenantId,
      email: { equals: normalizedEmail, mode: 'insensitive' },
      createdAt: { gte: from },
      campaign: {
        name: { startsWith: INTELLIGENT_PREFIX },
        showId: normalizedShowId,
      },
      type: MarketingEmailEventType.DELIVERED,
    },
    select: { id: true },
  });

  if (recentEvent) {
    return { eligible: false, reasons: ['intelligent_show_recently_emailed'] };
  }

  return { eligible: true, reasons: [] };
}
