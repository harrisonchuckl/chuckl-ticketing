import prisma from "../lib/prisma.js";

export type PrintfulPricingConfig = {
  organiserId: string;
  marginBps: number;
  vatRegistered: boolean;
  vatRateBps: number;
  shippingPolicy: "PASS_THROUGH" | "INCLUDED" | "THRESHOLD";
  stripeFeeBps: number;
  stripeFeeFixedPence: number;
  allowNegativeMargin: boolean;
  minimumProfitPence: number;
};

export const DEFAULT_PRINTFUL_PRICING: Omit<PrintfulPricingConfig, "organiserId"> = {
  marginBps: 1500,
  vatRegistered: true,
  vatRateBps: 2000,
  shippingPolicy: "PASS_THROUGH",
  stripeFeeBps: 150,
  stripeFeeFixedPence: 20,
  allowNegativeMargin: false,
  minimumProfitPence: 0,
};

export async function getPrintfulPricingConfig(organiserId: string): Promise<PrintfulPricingConfig> {
  const existing = await prisma.printfulPricingConfig.findFirst({ where: { organiserId } });
  if (existing) {
    return {
      organiserId,
      marginBps: existing.marginBps,
      vatRegistered: existing.vatRegistered,
      vatRateBps: existing.vatRateBps,
      shippingPolicy: existing.shippingPolicy as PrintfulPricingConfig["shippingPolicy"],
      stripeFeeBps: existing.stripeFeeBps,
      stripeFeeFixedPence: existing.stripeFeeFixedPence,
      allowNegativeMargin: existing.allowNegativeMargin,
      minimumProfitPence: existing.minimumProfitPence,
    };
  }

  const created = await prisma.printfulPricingConfig.create({
    data: {
      organiserId,
      marginBps: DEFAULT_PRINTFUL_PRICING.marginBps,
      vatRegistered: DEFAULT_PRINTFUL_PRICING.vatRegistered,
      vatRateBps: DEFAULT_PRINTFUL_PRICING.vatRateBps,
      shippingPolicy: DEFAULT_PRINTFUL_PRICING.shippingPolicy,
      stripeFeeBps: DEFAULT_PRINTFUL_PRICING.stripeFeeBps,
      stripeFeeFixedPence: DEFAULT_PRINTFUL_PRICING.stripeFeeFixedPence,
      allowNegativeMargin: DEFAULT_PRINTFUL_PRICING.allowNegativeMargin,
      minimumProfitPence: DEFAULT_PRINTFUL_PRICING.minimumProfitPence,
    },
  });

  return {
    organiserId,
    marginBps: created.marginBps,
    vatRegistered: created.vatRegistered,
    vatRateBps: created.vatRateBps,
    shippingPolicy: created.shippingPolicy as PrintfulPricingConfig["shippingPolicy"],
    stripeFeeBps: created.stripeFeeBps,
    stripeFeeFixedPence: created.stripeFeeFixedPence,
    allowNegativeMargin: created.allowNegativeMargin,
    minimumProfitPence: created.minimumProfitPence,
  };
}

export function computeRetailFromBase(params: {
  baseCostPence: number;
  marginBps: number;
  vatRegistered: boolean;
  vatRateBps: number;
}) {
  const baseCost = Math.max(0, Number(params.baseCostPence || 0));
  const marginMultiplier = 1 + Number(params.marginBps || 0) / 10000;
  const preVat = Math.round(baseCost * marginMultiplier);
  const vat = params.vatRegistered ? Math.round((preVat * Number(params.vatRateBps || 0)) / 10000) : 0;
  const retail = preVat + vat;
  return { preVat, vat, retail };
}

export function estimateStripeFees(totalPence: number, config: PrintfulPricingConfig) {
  const percentFee = Math.round((Number(totalPence || 0) * Number(config.stripeFeeBps || 0)) / 10000);
  return percentFee + Number(config.stripeFeeFixedPence || 0);
}

export function estimateVat(totalPence: number, config: PrintfulPricingConfig) {
  if (!config.vatRegistered) return 0;
  return Math.round((Number(totalPence || 0) * Number(config.vatRateBps || 0)) / 10000);
}
