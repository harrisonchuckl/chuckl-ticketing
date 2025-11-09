import prisma from '../lib/prisma.js';

type FeeResult = {
  platformFeePence: number;
  ourSharePence: number;
  organiserSharePence: number;
};

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : def;
}

/**
 * Compute platform fee for a given show/venue, including:
 *  - percentage of gross (bps)
 *  - per-ticket fixed fee
 *  - per-basket fixed fee
 * Then split the fee between us and the organiser.
 *
 * Env defaults when venue fields are null:
 *  PLATFORM_FEE_BPS (default 100 = 1.00%)
 *  PER_TICKET_FEE_PENCE (default 0)
 *  BASKET_FEE_PENCE (default 0)
 *  ORGANISER_FEE_SHARE_BPS (default 5000 = 50%)
 */
export async function calcFeesForShow(showId: string, grossPence: number, quantity: number): Promise<FeeResult> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { venue: { select: {
      feePercentBps: true, perTicketFeePence: true, basketFeePence: true, organiserShareBps: true
    } } }
  });

  const venue = show?.venue;

  const bps = toInt(venue?.feePercentBps ?? process.env.PLATFORM_FEE_BPS ?? 100);            // 1.00% default
  const perTicket = toInt(venue?.perTicketFeePence ?? process.env.PER_TICKET_FEE_PENCE ?? 0);
  const basket = toInt(venue?.basketFeePence ?? process.env.BASKET_FEE_PENCE ?? 0);
  const organiserShareBps = toInt(venue?.organiserShareBps ?? process.env.ORGANISER_FEE_SHARE_BPS ?? 5000); // 50%

  const percentComponent = Math.floor((Math.max(0, grossPence) * bps) / 10000);
  const perTicketComponent = perTicket * Math.max(0, quantity);
  const basketComponent = basket;

  const platformFeePence = Math.max(0, percentComponent + perTicketComponent + basketComponent);

  const organiserSharePence = Math.floor((platformFeePence * organiserShareBps) / 10000);
  const ourSharePence = Math.max(0, platformFeePence - organiserSharePence);

  return { platformFeePence, ourSharePence, organiserSharePence };
}
