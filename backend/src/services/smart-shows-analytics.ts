export type PaceThreshold = { days: number; pct: number };

export const paceThresholds: PaceThreshold[] = [
  { days: 21, pct: 40 },
  { days: 14, pct: 60 },
  { days: 7, pct: 75 },
  { days: 3, pct: 85 },
];

export type Recommendation = {
  key: string;
  label: string;
};

export type RiskBadge = {
  level: "Hot" | "Stable" | "At Risk";
  reason: string;
};

export type ShowAnalyticsMetrics = {
  soldCount: number;
  revenuePence: number;
  capacity: number | null;
  capacityPct: number | null;
  timeToShowDays: number;
  last7: number;
  prev7: number;
  wowPct: number;
  pacePerDay: number;
  forecastSold: number;
  forecastCapacityPct: number | null;
};

export function getTargetPacePct(timeToShowDays: number) {
  if (!Number.isFinite(timeToShowDays)) return null;
  const positiveDays = Math.max(0, Math.ceil(timeToShowDays));
  const match = paceThresholds
    .slice()
    .sort((a, b) => a.days - b.days)
    .find((threshold) => positiveDays <= threshold.days);
  return match ? match.pct : null;
}

export function computeWowPct(last7: number, prev7: number) {
  if (prev7 > 0) return ((last7 - prev7) / prev7) * 100;
  if (last7 > 0) return 100;
  return 0;
}

export function computePacePerDay(last7: number, prev7: number) {
  if (last7 > 0) return last7 / 7;
  const last14 = last7 + prev7;
  return last14 > 0 ? last14 / 14 : 0;
}

export function computeRiskBadge(metrics: ShowAnalyticsMetrics): RiskBadge {
  const { capacity, forecastCapacityPct, wowPct, last7, timeToShowDays } = metrics;

  if (
    (capacity !== null && forecastCapacityPct !== null && forecastCapacityPct >= 95) ||
    (wowPct >= 15 && last7 >= 10)
  ) {
    return {
      level: "Hot",
      reason:
        capacity !== null && forecastCapacityPct !== null && forecastCapacityPct >= 95
          ? "Projected sell-out"
          : "Strong week-over-week growth",
    };
  }

  if (
    (capacity !== null && forecastCapacityPct !== null && forecastCapacityPct < 70 && timeToShowDays <= 21) ||
    (wowPct <= -10 && timeToShowDays <= 28)
  ) {
    return {
      level: "At Risk",
      reason:
        capacity !== null && forecastCapacityPct !== null && forecastCapacityPct < 70 && timeToShowDays <= 21
          ? `Behind pace at T-${Math.max(0, timeToShowDays)}`
          : "WoW decline",
    };
  }

  return { level: "Stable", reason: "On track" };
}

export function computeRecommendations(opts: {
  metrics: ShowAnalyticsMetrics;
  risk: RiskBadge;
  missingVenueReport: boolean;
}): Recommendation[] {
  const { metrics, risk, missingVenueReport } = opts;
  const { timeToShowDays, capacityPct } = metrics;
  const recs: Recommendation[] = [];

  if (risk.level === "At Risk" && timeToShowDays <= 21) {
    recs.push(
      { key: "schedule_email", label: "Schedule email" },
      { key: "generate_promo_pack", label: "Generate promo pack" },
      { key: "boost_featured_slot", label: "Boost featured slot" }
    );
  }

  if (risk.level === "At Risk" && missingVenueReport) {
    recs.push({ key: "chase_venue_report", label: "Chase venue report" });
  }

  if (risk.level === "Hot") {
    recs.push(
      { key: "create_upsell_bundle", label: "Create upsell bundle" },
      { key: "add_to_featured", label: "Add to Featured" }
    );
  }

  if (risk.level === "Stable") {
    const targetPct = getTargetPacePct(timeToShowDays);
    if (targetPct !== null && capacityPct !== null && capacityPct < targetPct && capacityPct >= targetPct - 10) {
      recs.push(
        { key: "momentum_email", label: "Momentum email" },
        { key: "featured_7_days", label: "Feature for 7 days" }
      );
    }
  }

  return recs.slice(0, 3);
}

export function computeCapacity(opts: {
  showCapacity: number | null;
  ticketTypes: Array<{ available: number | null }>;
}) {
  if (opts.showCapacity !== null && opts.showCapacity !== undefined) {
    return Number.isFinite(opts.showCapacity) ? Number(opts.showCapacity) : null;
  }

  let total = 0;
  let hasFinite = false;

  for (const ticketType of opts.ticketTypes || []) {
    if (ticketType.available === null || ticketType.available === undefined) {
      return null;
    }
    const value = Number(ticketType.available);
    if (!Number.isFinite(value)) continue;
    total += value;
    hasFinite = true;
  }

  return hasFinite ? total : null;
}

export function buildShowAnalytics(input: {
  show: {
    id: string;
    title: string | null;
    date: Date;
    status: string | null;
    showCapacity: number | null;
    ticketTypes: Array<{ available: number | null }>;
    venueId?: string | null;
    venue: { name: string; city: string | null } | null;
    promoterLinks: Array<{
      weeklyReportEnabled: boolean;
      weeklyReportEmail: string | null;
      weeklyReportTime: string | null;
    }>;
  };
  soldCount: number;
  revenuePence: number;
  last7: number;
  prev7: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeToShowDays = Math.ceil(
    (new Date(input.show.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const timeRemaining = Math.max(0, timeToShowDays);
  const capacity = computeCapacity({
    showCapacity: input.show.showCapacity,
    ticketTypes: input.show.ticketTypes,
  });
  const soldCount = input.soldCount;
  const capacityPct = capacity ? (soldCount / capacity) * 100 : null;
  const wowPct = computeWowPct(input.last7, input.prev7);
  const pacePerDay = computePacePerDay(input.last7, input.prev7);
  const forecastSold = Math.round(soldCount + pacePerDay * timeRemaining);
  const forecastCapacityPct = capacity ? (forecastSold / capacity) * 100 : null;

  const metrics: ShowAnalyticsMetrics = {
    soldCount,
    revenuePence: input.revenuePence,
    capacity,
    capacityPct,
    timeToShowDays,
    last7: input.last7,
    prev7: input.prev7,
    wowPct,
    pacePerDay,
    forecastSold,
    forecastCapacityPct,
  };

  const missingVenueReport =
    !input.show.promoterLinks.length ||
    !input.show.promoterLinks.some(
      (link) => link.weeklyReportEnabled && (link.weeklyReportEmail || link.weeklyReportTime)
    );

  const risk = computeRiskBadge(metrics);
  const recommendations = computeRecommendations({ metrics, risk, missingVenueReport });

  return {
    showId: input.show.id,
    title: input.show.title,
    date: input.show.date,
    status: input.show.status,
    venueId: input.show.venueId ?? null,
    venue: input.show.venue,
    metrics,
    risk,
    recommendations,
    missingVenueReport,
  };
}

export function buildEarlyInsights(params: {
  analytics: ReturnType<typeof buildShowAnalytics>[];
  windowDays: number;
}) {
  const { analytics, windowDays } = params;
  const upcoming = analytics.filter(
    (row) => row.metrics.timeToShowDays >= 0 && row.metrics.timeToShowDays <= windowDays
  );

  const insights: Array<{ text: string; showIds: string[] }> = [];

  const atRisk = upcoming.filter((row) => row.risk.level === "At Risk");
  if (atRisk.length) {
    insights.push({
      text: `${atRisk.length} shows at risk in the next ${windowDays} days`,
      showIds: atRisk.map((row) => row.showId),
    });
  }

  const worstWow = upcoming
    .filter((row) => row.metrics.wowPct < 0)
    .sort((a, b) => a.metrics.wowPct - b.metrics.wowPct)[0];
  if (worstWow) {
    const location = worstWow.venue?.city || worstWow.venue?.name || worstWow.title || "This show";
    insights.push({
      text: `${location} is down ${Math.abs(worstWow.metrics.wowPct).toFixed(1)}% WoW — recommend email + final tickets push`,
      showIds: [worstWow.showId],
    });
  }

  const hotShow = upcoming.find((row) => row.risk.level === "Hot");
  if (hotShow) {
    const pct = hotShow.metrics.forecastCapacityPct;
    insights.push({
      text:
        pct !== null
          ? `${hotShow.title || "A show"} is forecast at ${Math.round(pct)}% capacity — keep momentum rolling`
          : `${hotShow.title || "A show"} is showing strong momentum — keep momentum rolling`,
      showIds: [hotShow.showId],
    });
  }

  const targetBehind = upcoming
    .filter((row) => {
      const target = getTargetPacePct(row.metrics.timeToShowDays);
      if (target === null || row.metrics.capacityPct === null) return false;
      return row.metrics.capacityPct < target;
    })
    .sort((a, b) => (a.metrics.capacityPct ?? 0) - (b.metrics.capacityPct ?? 0))[0];
  if (targetBehind) {
    insights.push({
      text: `${targetBehind.title || "A show"} is behind target pace — consider a momentum email`,
      showIds: [targetBehind.showId],
    });
  }

  return insights.slice(0, 5);
}
