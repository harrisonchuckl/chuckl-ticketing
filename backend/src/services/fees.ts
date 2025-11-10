// backend/src/services/fees.ts
//
// Fee calculation with no dependency on Venue fee fields.
// Policy is driven by environment variables with safe defaults.
// Compatible with the updated Prisma schema (no fee fields on Venue).
//
// Exports:
//   - default export: calculateFeesForOrder(showId, amountPence, quantity, organiserSplitBps?)
//   - named export:  calcFeesForShow(...legacyArgs)  <-- backward-compat shim
//
// The shim accepts BOTH object and positional forms, and tolerates EXTRA args.

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
// Accepts BOTH signatures and tolerates extra positional args:
//
//   1) Positional (legacy)
//      calcFeesForShow(showId, amountPence, quantity, organiserSplitBps?, ...ignored)
//      ^ any args beyond the 4th are ignored
//
//   2) Object
//      calcFeesForShow({ showId, amountPence, quantity, organiserSplitBps })
//
// Returns Promise<FeeBreakdown>
export async function calcFeesForShow(...args: any[]): Promise<FeeBreakdown> {
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const { showId, amountPence, quantity, organiserSplitBps } = args[0];
    return calculateFeesForOrder(showId, amountPence, quantity, organiserSplitBps);
  }

  // Positional: use first four values, ignore the rest for compatibility
  const [showId, amountPence, quantity, organiserSplitBps] = args;
  return calculateFeesForOrder(showId, amountPence, quantity, organiserSplitBps);
}

// Default export remains the new name for clarity
export default calculateFeesForOrder;
