export function calcPlatformFeePence(grossPence: number): number {
  const bps = Number(process.env.PLATFORM_FEE_BPS || 100); // default 1.00%
  // (gross * bps / 10_000), rounded down
  const fee = Math.floor((Math.max(0, grossPence) * Math.max(0, bps)) / 10000);
  return fee;
}
