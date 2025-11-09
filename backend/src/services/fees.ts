// backend/src/services/fees.ts
import { PrismaClient } from '@prisma/client';

export type FeeCalcInput = {
  subtotalPence: number; // ticket line total BEFORE fees (qty * unit price minus discounts)
  quantity: number;      // number of tickets
  feePercentBps?: number | null;      // e.g. 1000 = 10.00%
  perTicketFeePence?: number | null;  // fixed fee per ticket
  basketFeePence?: number | null;     // fixed fee per order
  organiserSplitBps?: number | null;  // e.g. 5000 = 50.00%
};

export type FeeCalcResult = {
  feePercentBps: number;
  perTicketFeePence: number;
  basketFeePence: number;
  organiserSplitBps: number;

  percentComponentPence: number;
  perTicketComponentPence: number;
  basketComponentPence: number;

  totalFeePence: number;
  ourSharePence: number;        // what we keep
  organiserSharePence: number;  // what we transfer to organiser
};

const clampBps = (n: number | null | undefined) =>
  Math.max(0, Math.min(10000, Number(n ?? 0)));

const clampInt = (n: number | null | undefined) =>
  Math.max(0, Math.floor(Number(n ?? 0)));

export function calcFees(input: FeeCalcInput): FeeCalcResult {
  const feePercentBps     = clampBps(input.feePercentBps);
  const perTicketFeePence = clampInt(input.perTicketFeePence);
  const basketFeePence    = clampInt(input.basketFeePence);
  const organiserSplitBps = clampBps(input.organiserSplitBps ?? 5000);

  const subtotal = clampInt(input.subtotalPence);
  const qty      = clampInt(input.quantity);

  const percentComponentPence   = Math.floor((subtotal * feePercentBps) / 10000);
  const perTicketComponentPence = perTicketFeePence * qty;
  const basketComponentPence    = basketFeePence;

  const totalFeePence = percentComponentPence + perTicketComponentPence + basketComponentPence;

  const organiserSharePence = Math.floor((totalFeePence * organiserSplitBps) / 10000);
  const ourSharePence       = totalFeePence - organiserSharePence;

  return {
    feePercentBps,
    perTicketFeePence,
    basketFeePence,
    organiserSplitBps,
    percentComponentPence,
    perTicketComponentPence,
    basketComponentPence,
    totalFeePence,
    organiserSharePence,
    ourSharePence,
  };
}

/**
 * Convenience: get the venue from a show and compute fees.
 * Signature matches what checkout already expects: (showId, qty, subtotal)
 */
export async function calcFeesForShow(
  prisma: PrismaClient,
  showId: string,
  quantity: number,
  subtotalPence: number
): Promise<FeeCalcResult> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      venue: {
        select: {
          feePercentBps: true,
          perTicketFeePence: true,
          basketFeePence: true,
          organiserSplitBps: true,
        }
      }
    }
  });
  const v = show?.venue ?? {};
  return calcFees({
    subtotalPence,
    quantity,
    feePercentBps: v.feePercentBps ?? 0,
    perTicketFeePence: v.perTicketFeePence ?? 0,
    basketFeePence: v.basketFeePence ?? 0,
    organiserSplitBps: v.organiserSplitBps ?? 5000
  });
}

/**
 * If you ever need to compute directly from a Venue object.
 */
export function calcFeesForVenue(
  venue: {
    feePercentBps?: number | null;
    perTicketFeePence?: number | null;
    basketFeePence?: number | null;
    organiserSplitBps?: number | null;
  },
  quantity: number,
  subtotalPence: number
): FeeCalcResult {
  return calcFees({
    subtotalPence,
    quantity,
    feePercentBps: venue.feePercentBps ?? 0,
    perTicketFeePence: venue.perTicketFeePence ?? 0,
    basketFeePence: venue.basketFeePence ?? 0,
    organiserSplitBps: venue.organiserSplitBps ?? 5000,
  });
}
