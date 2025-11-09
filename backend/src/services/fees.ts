// backend/src/services/fees.ts
import prisma from '../lib/prisma.js';

export type FeeCalcInput = {
  showId: string;
  quantity: number;
  unitPricePence: number; // ticket face value per ticket
  organiserId?: string | null; // who owns the show / order
};

export type FeeCalcResult = {
  grossPence: number;           // unitPrice * qty
  platformFeePence: number;     // venue fee% * gross + per-ticket * qty + basket
  organiserSharePence: number;  // organiser split of platformFee (per organiser account)
  ourSharePence: number;        // platform share of platformFee
  paymentFeePence: number;      // (placeholder for Stripe costs if you track them)
  netPayoutPence: number;       // gross - paymentFee - platformFee (organiser receives net payout from gross minus fees)
};

function bps(v?: number | null) {
  const n = typeof v === 'number' ? v : 0;
  return Math.max(0, n) / 10000; // 10000 bps = 100%
}

/**
 * Main calculator:
 * - pulls venue fee policy from the Show -> Venue
 * - pulls organiser split from the organiser (User.organiserSplitBps) or DEFAULT_ORGANISER_SPLIT_BPS
 */
export async function calcFeesForShow(input: FeeCalcInput): Promise<FeeCalcResult> {
  const { showId, quantity, unitPricePence } = input;

  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      venue: {
        select: {
          feePercentBps: true,
          perTicketFeePence: true,
          basketFeePence: true,
        }
      }
    }
  });
  if (!show) throw new Error('Show not found');

  const grossPence = unitPricePence * Math.max(0, quantity);

  const v = show.venue || ({} as any);
  const pctPart = Math.round(grossPence * bps(v.feePercentBps));
  const perTicketPart = Math.round((v.perTicketFeePence ?? 0) * Math.max(0, quantity));
  const basketPart = Math.round(v.basketFeePence ?? 0);

  const platformFeePence = Math.max(0, pctPart + perTicketPart + basketPart);

  // organiser split
  let organiserSplitBps = Number(process.env.DEFAULT_ORGANISER_SPLIT_BPS || 5000); // default 50%
  if (input.organiserId) {
    const org = await prisma.user.findUnique({
      where: { id: input.organiserId },
      select: { organiserSplitBps: true },
    });
    if (org && org.organiserSplitBps != null) organiserSplitBps = org.organiserSplitBps;
  }
  const organiserSharePence = Math.round(platformFeePence * bps(organiserSplitBps));
  const ourSharePence = Math.max(0, platformFeePence - organiserSharePence);

  // placeholder payment processor fee (optional—set to 0 for now)
  const paymentFeePence = 0;

  const netPayoutPence = Math.max(0, grossPence - paymentFeePence - platformFeePence);

  return {
    grossPence,
    platformFeePence,
    organiserSharePence,
    ourSharePence,
    paymentFeePence,
    netPayoutPence
  };
}
