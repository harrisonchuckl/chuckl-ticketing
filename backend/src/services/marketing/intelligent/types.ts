export type IntelligentStrategyKey = 'MONTHLY_DIGEST' | 'NEW_ON_SALE_BATCH' | 'ALMOST_SOLD_OUT' | 'ADDON_UPSELL';

export const DEFAULT_INTELLIGENT_CONFIG = {
  horizonDays: 90,
  limit: 6,
  cooldownDays: 30,
  maxEmailsPer30DaysPerContact: 3,
};

export const DEFAULT_ALMOST_SOLD_OUT_CONFIG = {
  threshold: 20,
  cooldownDays: 30,
  horizonDays: 90,
  maxEmailsPer30DaysPerContact: DEFAULT_INTELLIGENT_CONFIG.maxEmailsPer30DaysPerContact,
};

export const DEFAULT_ADDON_UPSELL_CONFIG = {
  lookbackDays: 30,
  cooldownDays: 30,
  maxEmailsPer30DaysPerContact: DEFAULT_INTELLIGENT_CONFIG.maxEmailsPer30DaysPerContact,
};

export const INTELLIGENT_STRATEGY_DEFINITIONS = [
  {
    key: 'MONTHLY_DIGEST',
    label: 'Monthly digest',
    description: 'Curated monthly picks based on past engagement.',
  },
  {
    key: 'NEW_ON_SALE_BATCH',
    label: 'New on sale',
    description: 'Freshly announced shows for your audience.',
  },
  {
    key: 'ALMOST_SOLD_OUT',
    label: 'Almost sold out',
    description: 'High-demand shows nearing capacity.',
  },
  {
    key: 'ADDON_UPSELL',
    label: 'Addon upsell',
    description: 'Suggested add-ons for recent purchasers.',
  },
] as const satisfies ReadonlyArray<{
  key: IntelligentStrategyKey;
  label: string;
  description: string;
}>;

export const BUILT_IN_INTELLIGENT_TYPES = INTELLIGENT_STRATEGY_DEFINITIONS.map((strategy) => ({
  key: strategy.key,
  label: strategy.label,
  description: strategy.description,
  strategyKey: strategy.key,
  defaultConfigJson: defaultConfigForStrategy(strategy.key),
}));

export function defaultConfigForStrategy(strategyKey: IntelligentStrategyKey) {
  switch (strategyKey) {
    case 'ALMOST_SOLD_OUT':
      return { ...DEFAULT_ALMOST_SOLD_OUT_CONFIG };
    case 'ADDON_UPSELL':
      return { ...DEFAULT_ADDON_UPSELL_CONFIG };
    case 'MONTHLY_DIGEST':
    case 'NEW_ON_SALE_BATCH':
    default:
      return { ...DEFAULT_INTELLIGENT_CONFIG };
  }
}

export function isIntelligentStrategyKey(value: string): value is IntelligentStrategyKey {
  return INTELLIGENT_STRATEGY_DEFINITIONS.some((strategy) => strategy.key === value);
}

export function normalizeIntelligentTypeKey(value: string) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized || '';
}
