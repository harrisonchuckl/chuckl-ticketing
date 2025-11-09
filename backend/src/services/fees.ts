// backend/src/services/fees.ts
import type { PrismaClient } from '@prisma/client';

export type FeePolicy = {
  feePercentBps?: number | null;      // e.g. 1000 = 10%
  perTicketFeePence?: number | null;  // e.g. 50
  basketFeePence?: number | null;     // e.g. 30
};

export type FeeCalcInput = {
  subTotalPence: number;              // unit price * quantity (before fees)
  quantity: number;
  policy: FeePolicy;
  organiserSplitBps?: number | null;  // from User.organiserSplitBps
};

export type FeeCalcResult = {
  platformFeePence: number;           // total platform fee (percent + per-ticket + basket)
  organiserSharePence: number;        // portion of platform fee we owe organiser
  paymentFeePence: number;            // (placeholder for Stripe costs etc.)
  netPayoutPence: number;             // suggested net to organiser (subtotal - payment fees - our share)
};

function ceil(x: number) {
  return Math.ceil(x);
}

export function calcFees(input: FeeCalcInput): FeeCalcResult {
  const { subTotalPence, quantity, policy, organiserSplitBps } = input;

  const percent = policy.feePercentBps ?? 0;
  const perTicket = policy.perTicketFeePence ?? 0;
  const basket = policy.basketFeePence ?? 0;

  const percentFee = ceil((subTotalPence * percent) / 10_000);
  const perTicketFee = quantity * perTicket;
  const basketFee = basket;

  const platformFeePence = percentFee + perTicketFee + basketFee;

  const organiserSharePence = ceil((platformFeePence * (organiserSplitBps ?? 0)) / 10_000);

  // For now keep payment processing cost at 0 in code (you can wire Stripe reporting later)
  const paymentFeePence = 0;

  // What organiser should receive if you pass-through the organiser share to them immediately:
  // organiser_net = subtotal - payment_fees - (platform_fee - organiser_share)
  const ourShare = platformFeePence - organiserSharePence;
  const netPayoutPence = subTotalPence - paymentFeePence - ourShare;

  return {
    platformFeePence,
    organiserSharePence,
    paymentFeePence,
    netPayoutPence,
  };
}

/**
 * Convenience: load the venue fee policy by showId, then calculate.
 * unitPricePence: price per ticket for this order (before fees)
 */
export async function calcFeesForShow(
  prisma: PrismaClient,
  showId: string,
  quantity: number,
  unitPricePence: number,
  organiserSplitBps?: number | null,
): Promise<FeeCalcResult> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      venue: {
        select: {
          feePercentBps: true,
          perTicketFeePence: true,
          basketFeePence: true,
        },
      },
    },
  });

  const policy: FeePolicy = {
    feePercentBps: show?.venue?.feePercentBps ?? 0,
    perTicketFeePence: show?.venue?.perTicketFeePence ?? 0,
    basketFeePence: show?.venue?.basketFeePence ?? 0,
  };

  return calcFees({
    subTotalPence: unitPricePence * quantity,
    quantity,
    policy,
    organiserSplitBps: organiserSplitBps ?? 0,
  });
}
