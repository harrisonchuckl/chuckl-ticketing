import { OrderStatus } from '@prisma/client';
import prisma from '../../../lib/prisma.js';

function normaliseEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

export async function hasPurchasedShow(tenantId: string, email: string, showId: string): Promise<boolean> {
  const normalizedEmail = normaliseEmail(email);
  if (!tenantId || !showId || !normalizedEmail) return false;

  const match = await prisma.order.findFirst({
    where: {
      status: OrderStatus.PAID,
      showId,
      show: { organiserId: tenantId },
      email: { equals: normalizedEmail, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return Boolean(match);
}

export function filterOutPurchasedShows<T extends { showId: string }>(
  recommendations: T[],
  purchasedSet: Set<string>
): T[] {
  if (!Array.isArray(recommendations) || !purchasedSet?.size) {
    return Array.isArray(recommendations) ? recommendations : [];
  }
  return recommendations.filter((recommendation) => !purchasedSet.has(recommendation.showId));
}
