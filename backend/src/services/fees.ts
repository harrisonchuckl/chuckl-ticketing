// backend/src/services/fees.ts
//
// Fee calculation with no dependency on Venue fee fields.
// Policy is driven by environment variables with safe defaults.
// Compatible with the updated Prisma schema (no fee fields on Venue).

import prisma from '../lib/prisma.js';

// ------- Types -------
export type FeeBreakdown = {
  platformFeePence: number;     // Chuckl. platform total (percentage + per-ticket + per-basket)
  organiserSharePence: number;  // Optional share of platform fee for organiser (if organiserSplitBps is provided)
  paymentFeePence: number;      // e.g. Stripe
  netPayoutPence: number;       // gross - platform - payment
};

// ------- Helpers -------
const intFromEnv = (key: string, def: number): number => {
  const raw = process.env[key];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : def;
};

// Global policy (env-driven)
// Basis points = hundredths of a percent. 1000 = 10%.
const POLICY = {
  // Percentage of basket kept as platform fee
  PLATFORM_FEE_BPS: intFromEnv('PLATFORM_FEE_BPS', 1000), // default 10%

  // Optional per-ticket and per-basket add-ons to platform fee
  PER_TICKET_FEE_PENCE: intFromEnv('PER_TICKET_FEE_PENCE', 0),
  BASKET_FEE_PENCE: intFromEnv('BASKET_FEE_PENCE', 0),

  // Payment processor fees (e.g. Stripe UK typical ~1.5% + 20p; configure to taste)
  PAYMENT_FEE_BPS: intFromEnv('PAYMENT_FEE_BPS', 150),      // 1.5%
  PAYMENT_FIXED_PENCE: intFromEnv('PAYMENT_FIXED_PENCE', 20) // 20p
};

// Sanity: ensure non-negative
const nn = (v: number) => (v < 0 ? 0 : v);

// ------- Public API -------

/**
 * Calculate all fees for an order *without* reading fee data from Venue.
 * Fee policy is taken from environment variables above.
 *
 * @param showId - the show the order belongs to (validated for existence)
 * @param amountPence - gross amount in pence (sum of ticket prices)
 * @param quantity - number of tickets
 * @param organiserSplitBps - optional share of platform fee for organiser (e.g. 5000 = 50%)
 */
export async function calculateFeesForOrder(
  showId: string,
  amountPence: number,
  quantity: number,
  organiserSplitBps?: number
): Promise<FeeBreakdown> {
  // Ensure the show exists (also ensures Prisma types are correct with the new schema)
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { id: true } // do not select venue; fees are env-based now
  });
  if (!show) {
    throw new Error('Show not found');
  }

  const gross = nn(Math.floor(amountPence));
  const qty = nn(Math.floor(quantity));

  // Platform fee = percentage of gross + per-ticket + per-basket
  const platformPct = Math.floor((gross * POLICY.PLATFORM_FEE_BPS) / 10_000);
  const platformPerTicket = nn(POLICY.PER_TICKET_FEE_PENCE) * qty;
  const platformBasket = nn(POLICY.BASKET_FEE_PENCE);

  const platformFeePence = nn(platformPct + platformPerTicket + platformBasket);

  // Organiser share of *platform* fee (optional)
  const organiserSharePence =
    organiserSplitBps && organiserSplitBps > 0
      ? Math.floor((platformFeePence * organiserSplitBps) / 10_000)
      : 0;

  // Payment processor fee (e.g. Stripe)
  const paymentPct = Math.floor((gross * POLICY.PAYMENT_FEE_BPS) / 10_000);
  const paymentFeePence = nn(paymentPct + nn(POLICY.PAYMENT_FIXED_PENCE));

  // Net payout to you after platform + payment fees
  const netPayoutPence = nn(gross - platformFeePence - paymentFeePence);

  return {
    platformFeePence,
    organiserSharePence,
    paymentFeePence,
    netPayoutPence
  };
}

// Backwards compat alias in case other modules import a different name
export const calculateOrderFees = calculateFeesForOrder;
export default calculateFeesForOrder;
