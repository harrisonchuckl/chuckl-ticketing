type BookingFeeBand = {
  minPricePence: number;
  feePercent: number;
  minFeePence: number;
  maxFeePence: number;
};

export const BOOKING_FEE_BANDS: BookingFeeBand[] = [
  { minPricePence: 5000, feePercent: 11, minFeePence: 550, maxFeePence: 900 },
  { minPricePence: 4000, feePercent: 11, minFeePence: 440, maxFeePence: 640 },
  { minPricePence: 3000, feePercent: 11, minFeePence: 330, maxFeePence: 530 },
  { minPricePence: 2500, feePercent: 12.5, minFeePence: 313, maxFeePence: 430 },
  { minPricePence: 2000, feePercent: 12.5, minFeePence: 250, maxFeePence: 330 },
  { minPricePence: 1500, feePercent: 14, minFeePence: 210, maxFeePence: 330 },
  { minPricePence: 1250, feePercent: 14, minFeePence: 175, maxFeePence: 290 },
  { minPricePence: 1000, feePercent: 15.5, minFeePence: 155, maxFeePence: 250 },
  { minPricePence: 750, feePercent: 17.7, minFeePence: 133, maxFeePence: 230 },
  { minPricePence: 500, feePercent: 22.6, minFeePence: 113, maxFeePence: 230 },
  { minPricePence: 250, feePercent: 45, minFeePence: 113, maxFeePence: 170 },
  { minPricePence: 200, feePercent: 50, minFeePence: 100, maxFeePence: 170 },
  { minPricePence: 100, feePercent: 79, minFeePence: 79, maxFeePence: 170 },
  { minPricePence: 0, feePercent: 0, minFeePence: 0, maxFeePence: 0 },
];

export function getBookingFeeBand(pricePence: number): BookingFeeBand {
  const price = Number(pricePence || 0);
  for (const band of BOOKING_FEE_BANDS) {
    if (price >= band.minPricePence) return band;
  }
  return BOOKING_FEE_BANDS[BOOKING_FEE_BANDS.length - 1];
}

export function clampBookingFeePence(
  pricePence: number,
  bookingFeePence?: number | null
): number {
  const safePrice = Number(pricePence || 0);
  if (!Number.isFinite(safePrice) || safePrice <= 0) return 0;

  const band = getBookingFeeBand(safePrice);
  const minFee = band.minFeePence;
  const parsed = Number(bookingFeePence);
  if (!Number.isFinite(parsed)) return minFee;
  return Math.max(minFee, Math.round(parsed));
}
