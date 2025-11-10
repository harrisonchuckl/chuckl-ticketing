// backend/src/services/fees.ts
//
// Fee calculation with no dependency on Venue fee fields.
// Policy is driven by environment variables with safe defaults.
// Compatible with the updated Prisma schema (no fee fields on Venue).
//
// Also exposes a backward-compat named export `calcFeesForShow`
// so existing routes (checkout/webhook) continue to compile.

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
const POLICY = {
  PLATFORM_FEE_BPS: intFromEnv('PLATFORM_FEE_BPS', 1000),        // 10%
  PER_TICKET_FEE_PENCE: intFromEnv('PER_TICKET_FEE_PENCE', 0),   // 0p
  BASKET_FEE_PENCE: intFromEnv('BASKET_FEE_PENCE', 0),           // 0p
  PAYMENT_FEE_BPS: intFromEnv('PAYMENT_FEE_BPS', 150),           // 1.5%
  PAYMENT_FIXED_PENCE: intFromEnv('PAYMENT_FIXED_PENCE', 20)     // 20p
};

const nn = (v: number) => (v < 0 ? 0 : v);

// ------- Core implementation -------
export async function calculateFeesForOrder(
  showId: string,
  amountPence: number,
  quantity: number,
  organiserSplitBps?: number
): Promise<FeeBreakdown> {
  // Validate show exists (minimal select so Prisma types match new schema)
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { id: true }
  });
  if (!show) throw new Error('Show not found');

  const gross = nn(Math.floor(amountPence));
  const qty = nn(Math.floor(quantity));

  // Platform fee parts
  const platformPct = Math.floor((gross * POLICY.PLATFORM_FEE_BPS) / 10_000);
  const platformPerTicket = nn(POLICY.PER_TICKET_FEE_PENCE) * qty;
  const platformBasket = nn(POLICY.BASKET_FEE_PENCE);
  const platformFeePence = nn(platformPct + platformPerTicket + platformBasket);

  // Optional organiser share of platform fee
  const organiserSharePence =
    organiserSplitBps && organiserSplitBps > 0
      ? Math.floor((platformFeePence * organiserSplitBps) / 10_000)
      : 0;

  // Payment processor fee (e.g. Stripe)
  const paymentPct = Math.floor((gross * POLICY.PAYMENT_FEE_BPS) / 10_000);
  const paymentFeePence = nn(paymentPct + nn(POLICY.PAYMENT_FIXED_PENCE));

  const netPayoutPence = nn(gross - platformFeePence - paymentFeePence);

  return {
    platformFeePence,
    organiserSharePence,
    paymentFeePence,
    netPayoutPence,
  };
}

// Back-compat alias some modules might still use
export const calculateOrderFees = calculateFeesForOrder;

// ------- Backward-compat shim: calcFeesForShow -------
// Supports both signatures:
//   calcFeesForShow(showId: string, amountPence: number, quantity: number, organiserSplitBps?: number)
//   calcFeesForShow({ showId, amountPence, quantity, organiserSplitBps })
export async function calcFeesForShow(
  showIdOrArgs:
    | string
    | {
        showId: string;
        amountPence: number;
        quantity: number;
        organiserSplitBps?: number;
      },
  maybeAmountPence?: number,
  maybeQuantity?: number,
  maybeOrganiserSplitBps?: number
): Promise<FeeBreakdown> {
  if (typeof showIdOrArgs === 'string') {
    // Positional
    return calculateFeesForOrder(
      showIdOrArgs,
      maybeAmountPence ?? 0,
      maybeQuantity ?? 0,
      maybeOrganiserSplitBps
    );
  }
  // Object form
  const { showId, amountPence, quantity, organiserSplitBps } = showIdOrArgs;
  return calculateFeesForOrder(showId, amountPence, quantity, organiserSplitBps);
}

// Default export remains the new name for clarity
export default calculateFeesForOrder;
