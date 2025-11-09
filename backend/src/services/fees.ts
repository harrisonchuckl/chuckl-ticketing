// backend/src/services/fees.ts
//
// Centralised fee calculation for venues.
// Reads fee config from a Venue (nullable fields are treated as 0).
//
// Schema expectations on Venue (all optional):
// - perTicketFeePence:   Int?   (fixed fee per ticket, in pence)
// - basketFeePence:      Int?   (fixed fee per order, in pence)
// - feePercent:          Int?   (percentage of subtotal, e.g. 10 for 10%)
// - organiserSharePercent: Int? (percentage of the platform fee you remit to organiser, e.g. 50)
//
// If some or all of these don’t exist yet in your prisma schema, run a migration
// to add them—or set safe defaults below.

export type VenueFeeConfig = {
  perTicketFeePence?: number | null;
  basketFeePence?: number | null;
  feePercent?: number | null;
  organiserSharePercent?: number | null;
};

export type FeeCalcInput = {
  venue: VenueFeeConfig | null | undefined;
  ticketCount: number;       // total tickets in the order
  subtotalPence: number;     // pre-fee order amount (sum of ticket prices), in pence
};

export type FeeCalcResult = {
  platformFeePence: number;      // what you’ll store on Order.platformFeePence
  organiserSharePence: number;   // the organiser’s share (not persisted unless you decide to)
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
  const organiserSharePct = Math.min(100, Math.max(0, Number(v.organiserSharePercent ?? 0)));

  const perTicketTotal = perTicket * Math.max(0, input.ticketCount || 0);
  const percentFee = Math.round((percent / 100) * Math.max(0, input.subtotalPence || 0));

  const platformFee = perTicketTotal + basket + percentFee;
  const organiserShare = Math.round((organiserSharePct / 100) * platformFee);

  return {
    platformFeePence: platformFee,
    organiserSharePence: organiserShare,
    breakdown: {
      perTicketFeePence: perTicketTotal,
      basketFeePence: basket,
      percentFeePence: percentFee,
    },
  };
}
