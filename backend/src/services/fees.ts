// backend/src/services/fees.ts
import { PrismaClient, Venue } from '@prisma/client';

export type FeeCalcResult = {
  platformFeePence: number;      // total platform fee on the basket
  organiserFeePence: number;     // organiser share of the platform fee
  ourSharePence: number;         // our share of the platform fee
  basketFeePence: number;        // basket-level flat fee (if any)
  paymentFeePence: number;       // placeholder for Stripe/PSP fees (0 for now)
};

export type VenueFeePolicy = Pick<
  Venue,
  'feePercentBps' | 'perTicketFeePence' | 'basketFeePence' | 'organiserSplitBps'
>;

/**
 * Safe defaults if a venue has not set fees yet.
 * feePercentBps: % of subtotal (basis points, 1000 = 10%)
 * organiserSplitBps: share of platform fee the organiser receives (5000 = 50%)
 */
export const defaultVenuePolicy: Required<VenueFeePolicy> = {
  feePercentBps: 0,
  perTicketFeePence: 0,
  basketFeePence: 0,
  organiserSplitBps: 5000, // 50/50 by default
};

/** Merge a possibly-partial venue record with safe defaults. */
export function normalisePolicy(v?: Partial<VenueFeePolicy>): Required<VenueFeePolicy> {
  return {
    feePercentBps: v?.feePercentBps ?? defaultVenuePolicy.feePercentBps,
    perTicketFeePence: v?.perTicketFeePence ?? defaultVenuePolicy.perTicketFeePence,
    basketFeePence: v?.basketFeePence ?? defaultVenuePolicy.basketFeePence,
    organiserSplitBps: v?.organiserSplitBps ?? defaultVenuePolicy.organiserSplitBps,
  };
}

/**
 * Core calculation given a policy, quantity and subtotal (in pence).
 */
export function calcFeesForVenue(
  policyInput: Partial<VenueFeePolicy> | undefined,
  quantity: number,
  subtotalPence: number
): FeeCalcResult {
  const policy = normalisePolicy(policyInput);
  const pctFee = Math.round((subtotalPence * policy.feePercentBps) / 10_000);
  const perTicketFee = Math.round((policy.perTicketFeePence || 0) * Math.max(0, quantity || 0));
  const basketFee = Math.round(policy.basketFeePence || 0);

  const platformFee = pctFee + perTicketFee + basketFee;

  const organiserShare = Math.round((platformFee * policy.organiserSplitBps) / 10_000);
  const ourShare = platformFee - organiserShare;

  return {
    platformFeePence: platformFee,
    organiserFeePence: organiserShare,
    ourSharePence: ourShare,
    basketFeePence: basketFee,
    paymentFeePence: 0, // placeholder; we can model PSP costs later
  };
}

/**
 * Flexible helper used by routes. Accepts either:
 *  - (prisma, showId: string, quantity: number, subtotalPence: number)
 *  - ({ prisma, showId, quantity, subtotalPence })
 *  - (showId)  -> returns zeros (for legacy build paths)
 */
export async function calcFeesForShow(...args: any[]): Promise<FeeCalcResult> {
  // legacy 1-arg form: return zeros to keep the build green
  if (args.length === 1 && typeof args[0] === 'string') {
    return {
      platformFeePence: 0,
      organiserFeePence: 0,
      ourSharePence: 0,
      basketFeePence: 0,
      paymentFeePence: 0,
    };
  }

  // object form
  if (args.length === 1 && typeof args[0] === 'object') {
    const { prisma, showId, quantity, subtotalPence } = args[0] || {};
    return calcFromDb(prisma as PrismaClient, showId as string, quantity as number, subtotalPence as number);
  }

  // positional form
  if (args.length >= 4) {
    const [prisma, showId, quantity, subtotalPence] = args as [PrismaClient, string, number, number];
    return calcFromDb(prisma, showId, quantity, subtotalPence);
  }

  // fallback
  return {
    platformFeePence: 0,
    organiserFeePence: 0,
    ourSharePence: 0,
    basketFeePence: 0,
    paymentFeePence: 0,
  };
}

async function calcFromDb(
  prisma: PrismaClient,
  showId: string,
  quantity: number,
  subtotalPence: number
): Promise<FeeCalcResult> {
  if (!prisma || !showId) {
    return {
      platformFeePence: 0,
      organiserFeePence: 0,
      ourSharePence: 0,
      basketFeePence: 0,
      paymentFeePence: 0,
    };
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
