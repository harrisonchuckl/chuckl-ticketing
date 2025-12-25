// backend/src/lib/booking-fee.ts

export type BookingFeeBand = {
  // The price threshold at which this band applies (in pence)
  minPricePence: number;

  // Percentages expressed as decimals (e.g. 0.11 = 11%)
  minPct: number;
  maxPct: number;

  // Optional legacy/display fields (safe to keep if other code uses them)
  feePercent?: number; // e.g. 11 (same as minPct*100)
  minFeePence?: number; // baseline example at band base (NOT used for calculations)
  maxFeePence?: number; // baseline example at band base (NOT used for calculations)
};

/**
 * Bands are defined by the BASE of each price tier.
 * IMPORTANT: min/max fees are calculated as % of the *actual ticket price*.
 * The minFeePence/maxFeePence values below are just baseline examples at the band base.
 */
export const BOOKING_FEE_BANDS: BookingFeeBand[] = [
  // £50+ => 11% to 18%  (at £50: £5.50 to £9.00)
  { minPricePence: 5000, minPct: 0.11, maxPct: 0.18, feePercent: 11, minFeePence: 550, maxFeePence: 900 },

  // £40–£49.99 => 11% to 16% (at £40: £4.40 to £6.40)
  { minPricePence: 4000, minPct: 0.11, maxPct: 0.16, feePercent: 11, minFeePence: 440, maxFeePence: 640 },

  // £30–£39.99 => 11% to £5.30 at £30 (≈17.6667%)
  { minPricePence: 3000, minPct: 0.11, maxPct: 5.30 / 30, feePercent: 11, minFeePence: 330, maxFeePence: 530 },

  // £25–£29.99 => 12.5% to £4.30 at £25 (17.2%)
  { minPricePence: 2500, minPct: 0.125, maxPct: 4.30 / 25, feePercent: 12.5, minFeePence: 313, maxFeePence: 430 },

  // £20–£24.99 => 12.5% to £3.30 at £20 (16.5%)
  { minPricePence: 2000, minPct: 0.125, maxPct: 3.30 / 20, feePercent: 12.5, minFeePence: 250, maxFeePence: 330 },

  // £15–£19.99 => 14% to £3.30 at £15 (22%)
  { minPricePence: 1500, minPct: 0.14, maxPct: 3.30 / 15, feePercent: 14, minFeePence: 210, maxFeePence: 330 },

  // £12.50–£14.99 => 14% to £2.90 at £12.50 (23.2%)
  { minPricePence: 1250, minPct: 0.14, maxPct: 2.90 / 12.5, feePercent: 14, minFeePence: 175, maxFeePence: 290 },

  // £10–£12.49 => 15.5% to £2.50 at £10 (25%)
  { minPricePence: 1000, minPct: 0.155, maxPct: 2.50 / 10, feePercent: 15.5, minFeePence: 155, maxFeePence: 250 },

  // £7.50–£9.99 => £1.33 at £7.50 (17.7333%) to £2.30 at £7.50 (30.6667%)
  { minPricePence: 750, minPct: 1.33 / 7.5, maxPct: 2.30 / 7.5, feePercent: 17.7, minFeePence: 133, maxFeePence: 230 },

  // £5–£7.49 => £1.13 at £5 (22.6%) to £2.30 at £5 (46%)
  { minPricePence: 500, minPct: 1.13 / 5, maxPct: 2.30 / 5, feePercent: 22.6, minFeePence: 113, maxFeePence: 230 },

  // £2.50–£4.99 => £1.13 at £2.50 (45.2%) to £1.70 at £2.50 (68%)
  { minPricePence: 250, minPct: 1.13 / 2.5, maxPct: 1.70 / 2.5, feePercent: 45, minFeePence: 113, maxFeePence: 170 },

  // £2–£2.49 => 50% to £1.70 at £2 (85%)
  { minPricePence: 200, minPct: 0.50, maxPct: 1.70 / 2, feePercent: 50, minFeePence: 100, maxFeePence: 170 },

  // £1–£1.99 => 79% to £1.70 at £1 (170%)
  { minPricePence: 100, minPct: 0.79, maxPct: 1.70 / 1, feePercent: 79, minFeePence: 79, maxFeePence: 170 },

  { minPricePence: 0, minPct: 0, maxPct: 0, feePercent: 0, minFeePence: 0, maxFeePence: 0 },
];

export function getBookingFeeBand(pricePence: number): BookingFeeBand {
  const price = Math.max(0, Math.round(Number(pricePence) || 0));
  for (const band of BOOKING_FEE_BANDS) {
    if (price >= band.minPricePence) return band;
  }
  return BOOKING_FEE_BANDS[BOOKING_FEE_BANDS.length - 1];
}

/**
 * Calculates the recommended min/max fee for the *actual* ticket price.
 */
export function getBookingFeeRange(
  pricePence: number
): { minFeePence: number; maxFeePence: number } {
  const price = Math.max(0, Math.round(Number(pricePence) || 0));
  if (!Number.isFinite(price) || price <= 0) return { minFeePence: 0, maxFeePence: 0 };

  const band = getBookingFeeBand(price);
  const minFeePence = Math.max(0, Math.round(price * band.minPct));
  const maxFeePence = Math.max(0, Math.round(price * band.maxPct));

  return { minFeePence, maxFeePence };
}

/**
 * Clamp a booking fee so it always stays within the recommended band for this price.
 * - If bookingFeePence is blank/invalid => returns MIN
 * - Otherwise clamps between MIN and MAX
 */
export function clampBookingFeePence(
  pricePence: number,
  bookingFeePence?: number | string | null
): number {
  const price = Math.max(0, Math.round(Number(pricePence) || 0));
  if (!Number.isFinite(price) || price <= 0) return 0;

  const { minFeePence, maxFeePence } = getBookingFeeRange(price);

  // default (blank) = minimum fee
  if (bookingFeePence === null || bookingFeePence === undefined) {
    return minFeePence;
  }
  if (typeof bookingFeePence === "string" && bookingFeePence.trim() === "") {
    return minFeePence;
  }

  const parsed = Math.max(0, Math.round(Number(bookingFeePence) || 0));
  if (!Number.isFinite(parsed)) return minFeePence;

  // Clamp between min and max (if max is 0, just enforce min)
  if (maxFeePence > 0) return Math.min(Math.max(parsed, minFeePence), maxFeePence);
  return Math.max(parsed, minFeePence);
}

/**
 * Handy helper: “what should the fee default to for this price?”
 * (use this when price changes in the UI)
 */
export function defaultBookingFeePence(pricePence: number): number {
  return getBookingFeeRange(pricePence).minFeePence;
}
