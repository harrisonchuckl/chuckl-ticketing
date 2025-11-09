// backend/src/services/fees.ts
//
// Centralised fee calculation.
// Venue-level config (all optional):
//   perTicketFeePence     Int?   fixed fee per ticket, in pence
//   basketFeePence        Int?   fixed fee per order, in pence
//   feePercent            Int?   percentage of subtotal (e.g. 10 for 10%)
//   organiserSharePercent Int?   percentage of the platform fee paid to organiser (e.g. 50)

export type VenueFeeConfig = {
  perTicketFeePence?: number | null;
  basketFeePence?: number | null;
  feePercent?: number | null;
  organiserSharePercent?: number | null;
};

export type FeeCalcInput = {
  venue: VenueFeeConfig | null | undefined;
  ticketCount: number;     // number of tickets in the order
  subtotalPence: number;   // ticket revenue before platform fees
};

export type FeeCalcResult = {
  platformFeePence: number;
  organiserSharePence: number;
  ourSharePence: number; // platformFeePence - organiserSharePence
  breakdown: {
    perTicketFeePence: number;
    basketFeePence: number;
    percentFeePence: number;
  };
};

export function calcFeesForVenue(input: FeeCalcInput): FeeCalcResult {
  const v = input.venue ?? {};
  const perTicket = Math.max(0, Number(v.perTicketFeePence ?? 0));
  const basket = Math.max(0, Number(v.basketFeePence ?? 0));
  const percent = Math.max(0, Number(v.feePercent ?? 0));
  // Default organiser share to 50% if not provided
  const organiserSharePct = Math.min(100, Math.max(0, Number(v.organiserSharePercent ?? 50)));

  const perTicketTotal = perTicket * Math.max(0, input.ticketCount || 0);
  const percentFee = Math.round((percent / 100) * Math.max(0, input.subtotalPence || 0));
  const platformFee = perTicketTotal + basket + percentFee;
  const organiserShare = Math.round((organiserSharePct / 100) * platformFee);
  const ourShare = platformFee - organiserShare;

  return {
    platformFeePence: platformFee,
    organiserSharePence: organiserShare,
    ourSharePence: ourShare,
    breakdown: {
      perTicketFeePence: perTicketTotal,
      basketFeePence: basket,
      percentFeePence: percentFee,
    },
  };
}

// Convenience wrapper used by some routes.
// Accepts a "show-like" object with a nested venue carrying fee fields.
export function calcFeesForShow(args: {
  show?: { venue?: VenueFeeConfig | null } | null;
  ticketCount: number;
  subtotalPence: number;
}): FeeCalcResult {
  return calcFeesForVenue({
    venue: args.show?.venue,
    ticketCount: args.ticketCount,
    subtotalPence: args.subtotalPence,
  });
}
