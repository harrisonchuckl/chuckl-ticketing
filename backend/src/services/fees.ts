// backend/src/services/fees.ts
import { PrismaClient, Venue } from '@prisma/client';

export type FeeCalcResult = {
  platformFeePence: number;      // total platform fee on the basket
  organiserFeePence: number;     // organiser share of the platform fee
  ourSharePence: number;         // our share of the platform fee
  basketFeePence: number;        // basket-level flat fee (if any)
  paymentFeePence: number;       // placeholder for PSP fees (0 for now)
};

export type VenueFeePolicy = Pick<
  Venue,
  'feePercentBps' | 'perTicketFeePence' | 'basketFeePence' | 'organiserSplitBps'
>;

// Strict, non-null policy we actually use for maths
type NormalisedPolicy = {
  feePercentBps: number;
  perTicketFeePence: number;
  basketFeePence: number;
  organiserSplitBps: number;
};

export const defaultVenuePolicy: NormalisedPolicy = {
  feePercentBps: 0,
  perTicketFeePence: 0,
  basketFeePence: 0,
  organiserSplitBps: 5000, // 50/50 by default
};

export function normalisePolicy(v?: Partial<VenueFeePolicy>): NormalisedPolicy {
  return {
    feePercentBps: (v?.feePercentBps ?? defaultVenuePolicy.feePercentBps) || 0,
    perTicketFeePence: (v?.perTicketFeePence ?? defaultVenuePolicy.perTicketFeePence) || 0,
    basketFeePence: (v?.basketFeePence ?? defaultVenuePolicy.basketFeePence) || 0,
    organiserSplitBps: (v?.organiserSplitBps ?? defaultVenuePolicy.organiserSplitBps) || 0,
  };
}

export function calcFeesForVenue(
  policyInput: Partial<VenueFeePolicy> | undefined,
  quantity: number,
  subtotalPence: number
): FeeCalcResult {
  const policy = normalisePolicy(policyInput);
  const safeQty = Math.max(0, quantity || 0);
  const safeSubtotal = Math.max(0, subtotalPence || 0);

  const pctFee = Math.round((safeSubtotal * policy.feePercentBps) / 10_000);
  const perTicketFee = Math.round(policy.perTicketFeePence * safeQty);
  const basketFee = Math.round(policy.basketFeePence);

  const platformFee = pctFee + perTicketFee + basketFee;

  const organiserShare = Math.round((platformFee * policy.organiserSplitBps) / 10_000);
  const ourShare = platformFee - organiserShare;

  return {
    platformFeePence: platformFee,
    organiserFeePence: organiserShare,
    ourSharePence: ourShare,
    basketFeePence: basketFee,
    paymentFeePence: 0,
  };
}

/**
 * Flexible helper:
 *  - (prisma, showId, quantity, subtotalPence)
 *  - ({ prisma, showId, quantity, subtotalPence })
 *  - (showId) -> zeros (legacy)
 */
export async function calcFeesForShow(...args: any[]): Promise<FeeCalcResult> {
  if (args.length === 1 && typeof args[0] === 'string') {
    return { platformFeePence: 0, organiserFeePence: 0, ourSharePence: 0, basketFeePence: 0, paymentFeePence: 0 };
  }
  if (args.length === 1 && typeof args[0] === 'object') {
    const { prisma, showId, quantity, subtotalPence } = args[0] || {};
    return calcFromDb(prisma as PrismaClient, showId as string, quantity as number, subtotalPence as number);
  }
  if (args.length >= 4) {
    const [prisma, showId, quantity, subtotalPence] = args as [PrismaClient, string, number, number];
    return calcFromDb(prisma, showId, quantity, subtotalPence);
  }
  return { platformFeePence: 0, organiserFeePence: 0, ourSharePence: 0, basketFeePence: 0, paymentFeePence: 0 };
}

async function calcFromDb(
  prisma: PrismaClient,
  showId: string,
  quantity: number,
  subtotalPence: number
): Promise<FeeCalcResult> {
  if (!prisma || !showId) {
    return { platformFeePence: 0, organiserFeePence: 0, ourSharePence: 0, basketFeePence: 0, paymentFeePence: 0 };
  }

  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      venue: {
        select: {
          feePercentBps: true,
          perTicketFeePence: true,
          basketFeePence: true,
          organiserSplitBps: true,
        },
      },
    },
  });

  const policy = normalisePolicy(show?.venue ?? undefined);
  return calcFeesForVenue(policy, quantity || 0, subtotalPence || 0);
}
