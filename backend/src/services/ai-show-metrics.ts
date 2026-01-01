import prisma from "../lib/prisma.js";
import {
  computeCapacity,
  computePacePerDay,
  computeRiskBadge,
  computeWowPct,
  getTargetPacePct,
  paceThresholds,
} from "./smart-shows-analytics.js";

export type ShowMetrics = {
  showId: string;
  soldCount: number;
  revenuePence: number;
  capacity: number | null;
  capacityPct: number | null;
  timeToShowDays: number;
  last7: number;
  prev7: number;
  wowPct: number;
  pacePerDay: number;
};

export type ShowForecast = {
  forecastSold: number;
  forecastCapacityPct: number | null;
};

export type ShowRiskBadge = {
  level: "Hot" | "Stable" | "At Risk";
  reason: string;
};

export type ShowRecommendation = {
  action: string;
  reason: string;
};

export const targetThresholds = paceThresholds;

function toNumber(value: any) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function forecast(metrics: ShowMetrics): ShowForecast {
  const timeRemaining = Math.max(0, Math.ceil(metrics.timeToShowDays));
  const forecastSold = Math.round(metrics.soldCount + metrics.pacePerDay * timeRemaining);
  const forecastCapacityPct = metrics.capacity
    ? (forecastSold / metrics.capacity) * 100
    : null;
  return { forecastSold, forecastCapacityPct };
}

export function riskBadge(metrics: ShowMetrics): ShowRiskBadge {
  const forecastMetrics = forecast(metrics);
  return computeRiskBadge({
    ...metrics,
    forecastSold: forecastMetrics.forecastSold,
    forecastCapacityPct: forecastMetrics.forecastCapacityPct,
  });
}

export function recommendations(metrics: ShowMetrics): ShowRecommendation[] {
  const risk = riskBadge(metrics);
  const output: ShowRecommendation[] = [];
  const target = getTargetPacePct(metrics.timeToShowDays);

  if (risk.level === "At Risk") {
    output.push(
      {
        action: "Boost marketing intensity",
        reason: `${risk.reason} with ${Math.round(metrics.capacityPct ?? 0)}% sold`,
      },
      {
        action: "Feature across storefront",
        reason: "Lift visibility while sales pace is soft",
      }
    );
    if (metrics.timeToShowDays <= 14) {
      output.push({
        action: "Launch last-chance push",
        reason: "Countdown window is inside two weeks",
      });
    }
  }

  if (risk.level === "Stable" && target !== null && metrics.capacityPct !== null) {
    if (metrics.capacityPct < target) {
      output.push({
        action: "Nudge with reminder campaign",
        reason: `Below target of ${target}% at T-${metrics.timeToShowDays}`,
      });
    } else {
      output.push({
        action: "Maintain momentum",
        reason: `Ahead of ${target}% target pace`,
      });
    }
  }

  if (risk.level === "Hot") {
    output.push({
      action: "Upsell experiences",
      reason: "Demand is strong and sell-out is likely",
    });
  }

  return output.slice(0, 3);
}

export async function computeShowMetrics(showId: string, organiserId?: string) {
  const show = await prisma.show.findFirst({
    where: organiserId ? { id: showId, organiserId } : { id: showId },
    select: {
      id: true,
      date: true,
      showCapacity: true,
      ticketTypes: { select: { available: true } },
    },
  });

  if (!show) return null;

  const now = new Date();
  const start7 = new Date(now);
  start7.setDate(now.getDate() - 7);
  const start14 = new Date(now);
  start14.setDate(now.getDate() - 14);

  const [totalSold, last7, prev7, revenueAgg] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["showId"],
      where: { showId, order: { is: { status: "PAID" } } },
      _sum: { quantity: true },
    }),
    prisma.ticket.groupBy({
      by: ["showId"],
      where: {
        showId,
        order: { is: { status: "PAID", createdAt: { gte: start7, lt: now } } },
      },
      _sum: { quantity: true },
    }),
    prisma.ticket.groupBy({
      by: ["showId"],
      where: {
        showId,
        order: { is: { status: "PAID", createdAt: { gte: start14, lt: start7 } } },
      },
      _sum: { quantity: true },
    }),
    prisma.order.groupBy({
      by: ["showId"],
      where: { showId, status: "PAID" },
      _sum: { amountPence: true },
    }),
  ]);

  const soldCount = toNumber(totalSold[0]?._sum.quantity);
  const last7Count = toNumber(last7[0]?._sum.quantity);
  const prev7Count = toNumber(prev7[0]?._sum.quantity);
  const revenuePence = toNumber(revenueAgg[0]?._sum.amountPence);
  const timeToShowDays = Math.ceil(
    (new Date(show.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const capacity = computeCapacity({
    showCapacity: show.showCapacity,
    ticketTypes: show.ticketTypes,
  });
  const capacityPct = capacity ? (soldCount / capacity) * 100 : null;
  const wowPct = computeWowPct(last7Count, prev7Count);
  const pacePerDay = computePacePerDay(last7Count, prev7Count);

  return {
    showId: show.id,
    soldCount,
    revenuePence,
    capacity,
    capacityPct,
    timeToShowDays,
    last7: last7Count,
    prev7: prev7Count,
    wowPct,
    pacePerDay,
  } satisfies ShowMetrics;
}

export async function computeShowMetricsBatch(params: {
  showIds: string[];
  now?: Date;
}) {
  const now = params.now ?? new Date();
  if (!params.showIds.length) return new Map<string, ShowMetrics>();

  const start7 = new Date(now);
  start7.setDate(now.getDate() - 7);
  const start14 = new Date(now);
  start14.setDate(now.getDate() - 14);

  const [shows, totalSold, last7, prev7, revenueAgg] = await Promise.all([
    prisma.show.findMany({
      where: { id: { in: params.showIds } },
      select: {
        id: true,
        date: true,
        showCapacity: true,
        ticketTypes: { select: { available: true } },
      },
    }),
    prisma.ticket.groupBy({
      by: ["showId"],
      where: { showId: { in: params.showIds }, order: { is: { status: "PAID" } } },
      _sum: { quantity: true },
    }),
    prisma.ticket.groupBy({
      by: ["showId"],
      where: {
        showId: { in: params.showIds },
        order: { is: { status: "PAID", createdAt: { gte: start7, lt: now } } },
      },
      _sum: { quantity: true },
    }),
    prisma.ticket.groupBy({
      by: ["showId"],
      where: {
        showId: { in: params.showIds },
        order: { is: { status: "PAID", createdAt: { gte: start14, lt: start7 } } },
      },
      _sum: { quantity: true },
    }),
    prisma.order.groupBy({
      by: ["showId"],
      where: { showId: { in: params.showIds }, status: "PAID" },
      _sum: { amountPence: true },
    }),
  ]);

  const byShowId = <T extends { showId: string }>(rows: T[]) => {
    const map = new Map<string, T>();
    rows.forEach((row) => map.set(row.showId, row));
    return map;
  };

  const soldMap = byShowId(totalSold);
  const last7Map = byShowId(last7);
  const prev7Map = byShowId(prev7);
  const revenueMap = byShowId(revenueAgg);

  const metricsMap = new Map<string, ShowMetrics>();

  shows.forEach((show) => {
    const soldCount = toNumber(soldMap.get(show.id)?._sum.quantity);
    const last7Count = toNumber(last7Map.get(show.id)?._sum.quantity);
    const prev7Count = toNumber(prev7Map.get(show.id)?._sum.quantity);
    const revenuePence = toNumber(revenueMap.get(show.id)?._sum.amountPence);
    const timeToShowDays = Math.ceil(
      (new Date(show.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const capacity = computeCapacity({
      showCapacity: show.showCapacity,
      ticketTypes: show.ticketTypes,
    });
    const capacityPct = capacity ? (soldCount / capacity) * 100 : null;
    const wowPct = computeWowPct(last7Count, prev7Count);
    const pacePerDay = computePacePerDay(last7Count, prev7Count);

    metricsMap.set(show.id, {
      showId: show.id,
      soldCount,
      revenuePence,
      capacity,
      capacityPct,
      timeToShowDays,
      last7: last7Count,
      prev7: prev7Count,
      wowPct,
      pacePerDay,
    });
  });

  return metricsMap;
}
