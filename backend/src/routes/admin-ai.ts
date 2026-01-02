import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import {
  computeShowMetricsBatch,
  forecast,
  recommendations,
  riskBadge,
  targetThresholds,
} from "../services/ai-show-metrics.js";

const router = Router();

const DEFAULT_FEATURED_CONFIG = {
  mode: "AUTO",
  slotCount: 8,
  weights: {
    salesVelocityWeight: 1,
    urgencyWeight: 1,
    riskWeight: 1,
    newShowWeight: 0.6,
    nearSelloutWeight: 1,
  },
  exclusions: {
    excludeSoldOut: true,
    excludeWithinHours: 24,
    excludeNotLive: true,
  },
};

const NEW_SHOW_DAYS = 14;

function organiserIdFor(req: any) {
  return String(req.user?.id || "");
}

function showWhereForList(req: any) {
  const organiserId = organiserIdFor(req);
  if (!organiserId) return {};
  return { organiserId };
}

function parseJson(input: any, fallback: any) {
  if (!input) return fallback;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(String(input));
  } catch (err) {
    return fallback;
  }
}

function toPlainObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

function formatDateShort(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatCurrency(pence: number | null | undefined) {
  const value = Number(pence || 0) / 100;
  return `£${value.toFixed(2)}`;
}

function normalizeCounty(value: any) {
  return String(value || "").trim().toLowerCase();
}

function buildFeaturedReasons(args: {
  metrics: ReturnType<typeof recommendations>[number] extends never ? any : any;
  risk: { level: string; reason: string };
  velocity: number;
  urgency: number;
  nearSelloutScore: number;
}) {
  const reasons: string[] = [];
  if (args.velocity > 0) reasons.push(`High sales velocity (${args.velocity.toFixed(1)}/day)`);
  if (args.urgency > 0.6) reasons.push("Urgent on-sale window");
  if (args.risk.level === "At Risk") reasons.push(`At Risk: ${args.risk.reason}`);
  if (args.nearSelloutScore > 0.2) reasons.push("Near sell-out momentum");
  return reasons.slice(0, 3);
}

async function fetchShowsForFeatured(req: any) {
  const shows = await prisma.show.findMany({
    where: showWhereForList(req),
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      imageUrl: true,
      showCapacity: true,
      venue: { select: { name: true, city: true } },
      ticketTypes: { select: { pricePence: true, available: true } },
    },
  });
  return shows;
}

function computeFeaturedScore(params: {
  weights: any;
  metrics: any;
  riskLevel: string;
  publishedAt: Date | null;
  createdAt: Date;
}) {
  const { metrics, weights } = params;
  const velocity = metrics.pacePerDay;
  const urgency = Math.max(0, Math.min(1, 1 - metrics.timeToShowDays / 60));
  const riskScore = params.riskLevel === "At Risk" ? 1 : params.riskLevel === "Stable" ? 0.5 : 0.3;
  const publishedAt = params.publishedAt ?? params.createdAt;
  const isNew =
    publishedAt &&
    (Date.now() - new Date(publishedAt).getTime()) / (24 * 60 * 60 * 1000) <= NEW_SHOW_DAYS
      ? 1
      : 0;
  const nearSellout =
    metrics.capacityPct !== null && metrics.capacityPct >= 80 && metrics.capacityPct <= 95
      ? Math.min(1, (metrics.capacityPct - 80) / 15)
      : 0;

  const score =
    weights.salesVelocityWeight * velocity +
    weights.urgencyWeight * urgency +
    weights.riskWeight * riskScore +
    weights.newShowWeight * isNew +
    weights.nearSelloutWeight * nearSellout;

  return {
    score,
    velocity,
    urgency,
    riskScore,
    isNew,
    nearSellout,
  };
}

function priceFrom(ticketTypes: Array<{ pricePence: number | null }>) {
  const prices = ticketTypes
    .map((t) => (typeof t.pricePence === "number" ? t.pricePence : null))
    .filter((v): v is number => v !== null);
  if (!prices.length) return null;
  return Math.min(...prices);
}

function isSoldOut(show: {
  showCapacity: number | null;
  ticketTypes: Array<{ available: number | null }>;
  soldCount: number;
}) {
  if (show.showCapacity !== null && show.showCapacity !== undefined) {
    return show.soldCount >= show.showCapacity;
  }
  const availables = show.ticketTypes.map((t) => t.available);
  if (!availables.length) return false;
  const finiteAvail = availables.filter((a) => a !== null);
  if (!finiteAvail.length) return false;
  return finiteAvail.every((a) => Number(a || 0) <= 0);
}

async function buildFeaturedPreview(req: any, county: string | null) {
  const organiserId = organiserIdFor(req);
  const [configRow, pins, regionRules, shows] = await Promise.all([
    prisma.featuredConfig.findFirst({ where: { organiserId } }),
    prisma.featuredPin.findMany({ where: { organiserId } }),
    prisma.featuredRegionRule.findMany({ where: { organiserId } }),
    fetchShowsForFeatured(req),
  ]);

  const config = configRow
    ? {
        mode: configRow.mode,
        slotCount: configRow.slotCount,
        weights: configRow.weights ?? DEFAULT_FEATURED_CONFIG.weights,
        exclusions: configRow.exclusions ?? DEFAULT_FEATURED_CONFIG.exclusions,
      }
    : DEFAULT_FEATURED_CONFIG;

  const countyKey = normalizeCounty(county);
  const regionRule = regionRules.find(
    (rule) => normalizeCounty(rule.county) === countyKey && countyKey
  );

  const weights = {
    ...toPlainObject(config.weights),
    ...toPlainObject(regionRule?.weightsOverride),
  };
  const exclusions = {
    ...toPlainObject(config.exclusions),
    ...toPlainObject(regionRule?.exclusionsOverride),
  };

  const metricsMap = await computeShowMetricsBatch({
    showIds: shows.map((show) => show.id),
  });

  const eligiblePins = pins.filter((pin) => {
    if (!countyKey) return !pin.regionCounty;
    if (!pin.regionCounty) return true;
    return normalizeCounty(pin.regionCounty) === countyKey;
  });

  const pinIds = new Set(eligiblePins.map((pin) => pin.showId));

  const candidates = shows
    .map((show) => {
      const metrics = metricsMap.get(show.id);
      if (!metrics) return null;
      const risk = riskBadge(metrics);
      const soldCount = metrics.soldCount;
      const soldOut = isSoldOut({ showCapacity: show.showCapacity, ticketTypes: show.ticketTypes, soldCount });
      const excludeWithinHours = Number(exclusions.excludeWithinHours || 0);
      const hoursToShow = metrics.timeToShowDays * 24;

      if (exclusions.excludeNotLive && String(show.status || "") !== "LIVE") return null;
      if (exclusions.excludeSoldOut && soldOut) return null;
      if (exclusions.excludeWithinHours && hoursToShow <= excludeWithinHours) return null;

      const breakdown = computeFeaturedScore({
        weights,
        metrics,
        riskLevel: risk.level,
        publishedAt: show.publishedAt,
        createdAt: show.createdAt,
      });

      const reasons = buildFeaturedReasons({
        metrics,
        risk,
        velocity: breakdown.velocity,
        urgency: breakdown.urgency,
        nearSelloutScore: breakdown.nearSellout,
      });

      return {
        show,
        metrics,
        risk,
        breakdown,
        reasons,
        score: breakdown.score,
        priceFrom: priceFrom(show.ticketTypes),
      };
    })
    .filter(Boolean) as Array<any>;

  const pinnedShows = eligiblePins
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((pin) => candidates.find((c) => c.show.id === pin.showId))
    .filter(Boolean) as Array<any>;

  const ranked = candidates
    .filter((c) => !pinIds.has(c.show.id))
    .sort((a, b) => b.score - a.score);

  const slots = Math.max(1, Number(config.slotCount || DEFAULT_FEATURED_CONFIG.slotCount));
  let featured: any[] = [];
  if (String(config.mode || "").toUpperCase() === "MANUAL") {
    featured = pinnedShows.slice(0, slots);
  } else if (String(config.mode || "").toUpperCase() === "AUTO") {
    featured = ranked.slice(0, slots);
  } else {
    featured = [...pinnedShows, ...ranked].slice(0, slots);
  }

  const preview = featured.map((item) => ({
    showId: item.show.id,
    title: item.show.title,
    date: item.show.date,
    venueName: item.show.venue?.name ?? "Venue TBC",
    town: item.show.venue?.city ?? "",
    imageUrl: item.show.imageUrl,
    priceFrom: item.priceFrom,
    reasons: item.reasons,
    breakdown: item.breakdown,
    score: item.score,
  }));

  return {
    config,
    regionRules,
    pins,
    preview,
    weights,
    exclusions,
  };
}

async function logAudit(organiserId: string, action: string, metadata: any) {
  if (!organiserId) return;
  await prisma.marketingAuditLog.create({
    data: {
      tenantId: organiserId,
      action,
      entityType: "AI",
      entityId: organiserId,
      metadata,
    },
  });
}

router.get("/ai/featured/config", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const [config, pins, regionRules, logs] = await Promise.all([
      prisma.featuredConfig.findFirst({ where: { organiserId } }),
      prisma.featuredPin.findMany({ where: { organiserId }, orderBy: { priority: "asc" } }),
      prisma.featuredRegionRule.findMany({ where: { organiserId }, orderBy: { county: "asc" } }),
      prisma.featuredDecisionLog.findMany({
        where: { organiserId },
        orderBy: { computedAt: "desc" },
        take: 20,
      }),
    ]);

    res.json({
      ok: true,
      config: config ?? DEFAULT_FEATURED_CONFIG,
      pins,
      regionRules,
      logs,
    });
  } catch (err) {
    console.error("ai/featured/config failed", err);
    res.status(500).json({ ok: false, error: "Failed to load featured config" });
  }
});

router.post("/ai/featured/config", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const mode = String(req.body?.mode || DEFAULT_FEATURED_CONFIG.mode);
    const slotCount = Math.max(1, Number(req.body?.slotCount || DEFAULT_FEATURED_CONFIG.slotCount));
    const weights = parseJson(req.body?.weights, DEFAULT_FEATURED_CONFIG.weights);
    const exclusions = parseJson(req.body?.exclusions, DEFAULT_FEATURED_CONFIG.exclusions);

    const config = await prisma.featuredConfig.upsert({
      where: { organiserId },
      create: {
        organiserId,
        mode,
        slotCount,
        weights,
        exclusions,
      },
      update: {
        mode,
        slotCount,
        weights,
        exclusions,
      },
    });

    await logAudit(organiserId, "AI_FEATURED_CONFIG_UPDATED", { mode, slotCount, weights, exclusions });

    res.json({ ok: true, config });
  } catch (err) {
    console.error("ai/featured/config save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save config" });
  }
});

router.post("/ai/featured/pins", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const action = String(req.body?.action || "set");
    if (action === "delete") {
      const id = String(req.body?.id || "");
      await prisma.featuredPin.deleteMany({ where: { id, organiserId } });
    } else {
      const pins = Array.isArray(req.body?.pins) ? req.body.pins : [];
      if (action === "set") {
        await prisma.featuredPin.deleteMany({ where: { organiserId } });
        if (pins.length) {
          await prisma.featuredPin.createMany({
            data: pins.map((pin: any, index: number) => ({
              organiserId,
              showId: String(pin.showId),
              priority: Number(pin.priority ?? index + 1),
              regionCounty: pin.regionCounty ? String(pin.regionCounty) : null,
            })),
          });
        }
      } else if (action === "add") {
        const pin = req.body?.pin || {};
        const created = await prisma.featuredPin.create({
          data: {
            organiserId,
            showId: String(pin.showId),
            priority: Number(pin.priority ?? 1),
            regionCounty: pin.regionCounty ? String(pin.regionCounty) : null,
          },
        });
        return res.json({ ok: true, pin: created });
      }
    }

    const pins = await prisma.featuredPin.findMany({ where: { organiserId }, orderBy: { priority: "asc" } });
    res.json({ ok: true, pins });
  } catch (err) {
    console.error("ai/featured/pins failed", err);
    res.status(500).json({ ok: false, error: "Failed to update pins" });
  }
});

router.post("/ai/featured/region-rules", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const action = String(req.body?.action || "create");

    if (action === "delete") {
      await prisma.featuredRegionRule.deleteMany({
        where: { id: String(req.body?.id), organiserId },
      });
    } else if (action === "update") {
      const ruleId = String(req.body?.id || "");
      const existing = await prisma.featuredRegionRule.findFirst({
        where: { id: ruleId, organiserId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ ok: false, error: "Rule not found" });
      await prisma.featuredRegionRule.update({
        where: { id: ruleId },
        data: {
          county: String(req.body?.county || ""),
          weightsOverride: parseJson(req.body?.weightsOverride, null),
          exclusionsOverride: parseJson(req.body?.exclusionsOverride, null),
        },
      });
    } else {
      await prisma.featuredRegionRule.create({
        data: {
          organiserId,
          county: String(req.body?.county || ""),
          weightsOverride: parseJson(req.body?.weightsOverride, null),
          exclusionsOverride: parseJson(req.body?.exclusionsOverride, null),
        },
      });
    }

    const regionRules = await prisma.featuredRegionRule.findMany({ where: { organiserId }, orderBy: { county: "asc" } });
    res.json({ ok: true, regionRules });
  } catch (err) {
    console.error("ai/featured/region-rules failed", err);
    res.status(500).json({ ok: false, error: "Failed to update region rules" });
  }
});

router.get("/ai/featured/preview", requireAdminOrOrganiser, async (req, res) => {
  try {
    const county = typeof req.query.county === "string" ? req.query.county : null;
    const preview = await buildFeaturedPreview(req, county);
    res.json({ ok: true, preview: preview.preview, weights: preview.weights, exclusions: preview.exclusions });
  } catch (err) {
    console.error("ai/featured/preview failed", err);
    res.status(500).json({ ok: false, error: "Failed to load preview" });
  }
});

router.post("/ai/featured/recompute", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const county = typeof req.body?.county === "string" ? req.body.county : null;
    const preview = await buildFeaturedPreview(req, county);

    const logEntry = await prisma.featuredDecisionLog.create({
      data: {
        organiserId,
        county: county || null,
        results: {
          computedAt: new Date().toISOString(),
          results: preview.preview,
        },
      },
    });

    await logAudit(organiserId, "AI_FEATURED_RECOMPUTE", {
      county: county || "Global",
      featuredCount: preview.preview.length,
    });

    res.json({ ok: true, preview: preview.preview, log: logEntry });
  } catch (err) {
    console.error("ai/featured/recompute failed", err);
    res.status(500).json({ ok: false, error: "Failed to recompute featured" });
  }
});

router.get("/ai/insights/queue", requireAdminOrOrganiser, async (req, res) => {
  try {
    const shows = await prisma.show.findMany({
      where: showWhereForList(req),
      select: {
        id: true,
        title: true,
        date: true,
        showCapacity: true,
        ticketTypes: { select: { available: true } },
        venue: { select: { name: true } },
      },
    });

    if (!shows.length) return res.json({ ok: true, items: [] });

    const metricsMap = await computeShowMetricsBatch({ showIds: shows.map((s) => s.id) });
    const items = shows
      .map((show) => {
        const metrics = metricsMap.get(show.id);
        if (!metrics) return null;
        const forecasted = forecast(metrics);
        const risk = riskBadge(metrics);
        const recs = recommendations(metrics);
        const target = targetThresholds.find((t) => metrics.timeToShowDays <= t.days)?.pct ?? null;
        const capacityPct = metrics.capacityPct ?? 0;
        const riskScore =
          (risk.level === "At Risk" ? 100 : risk.level === "Stable" ? 60 : 30) +
          Math.max(0, (target ?? 0) - capacityPct) +
          Math.max(0, -metrics.wowPct);

        return {
          showId: show.id,
          title: show.title,
          date: show.date,
          risk,
          timeToShowDays: metrics.timeToShowDays,
          capacityPct: metrics.capacityPct,
          wowPct: metrics.wowPct,
          forecast: forecasted,
          targetPct: target,
          topAction: recs[0] || null,
          riskScore,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.riskScore - a.riskScore);

    res.json({ ok: true, items });
  } catch (err) {
    console.error("ai/insights/queue failed", err);
    res.status(500).json({ ok: false, error: "Failed to load insights queue" });
  }
});

router.get("/ai/insights/show/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const showId = String(req.params.id);
    const show = await prisma.show.findFirst({
      where: { id: showId, ...showWhereForList(req) },
      select: {
        id: true,
        title: true,
        date: true,
        showCapacity: true,
        venueId: true,
        venue: { select: { name: true, city: true } },
        ticketTypes: { select: { available: true } },
      },
    });
    if (!show) return res.status(404).json({ ok: false, error: "Show not found" });

    const metrics = await computeShowMetricsBatch({ showIds: [showId] });
    const metricsRow = metrics.get(showId);
    if (!metricsRow) return res.status(404).json({ ok: false, error: "Metrics unavailable" });

    const forecasted = forecast(metricsRow);
    const risk = riskBadge(metricsRow);
    const recs = recommendations(metricsRow);

    const now = new Date();
    const pastShows = await prisma.show.findMany({
      where: {
        ...showWhereForList(req),
        id: { not: showId },
        date: { lt: now },
      },
      select: {
        id: true,
        title: true,
        date: true,
        showCapacity: true,
        venueId: true,
        venue: { select: { name: true, city: true } },
      },
      take: 20,
    });

    const sameVenue = pastShows.filter((row) => row.venueId && row.venueId === show.venueId);
    const sameTown = pastShows.filter((row) =>
      row.venue?.city && show.venue?.city
        ? row.venue.city === show.venue.city
        : false
    );
    const capacityBand = show.showCapacity ? Math.round(show.showCapacity / 250) : 1;
    const similarCapacity = pastShows.filter((row) => {
      if (!row.showCapacity || !show.showCapacity) return false;
      return Math.round(row.showCapacity / 250) === capacityBand;
    });

    const comparableShows = (sameVenue.length ? sameVenue : sameTown.length ? sameTown : similarCapacity)
      .slice(0, 5);

    const compareIds = comparableShows.map((row) => row.id);
    const earliestWindow = comparableShows.reduce<Date | null>((acc, row) => {
      const d = new Date(row.date);
      d.setDate(d.getDate() - 14);
      if (!acc || d < acc) return d;
      return acc;
    }, null);

    const [totalSold, ticketOrders] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["showId"],
        where: { showId: { in: compareIds }, order: { is: { status: "PAID" } } },
        _sum: { quantity: true },
      }),
      prisma.ticket.findMany({
        where: {
          showId: { in: compareIds },
          order: { is: { status: "PAID", createdAt: earliestWindow ? { gte: earliestWindow } : undefined } },
        },
        select: {
          showId: true,
          quantity: true,
          order: { select: { createdAt: true } },
        },
      }),
    ]);

    const totalsMap = new Map(totalSold.map((row) => [row.showId, row._sum.quantity || 0]));

    const comparables = comparableShows.map((row) => {
      const sold = Number(totalsMap.get(row.id) || 0);
      const capacity = row.showCapacity || null;
      const capacityPct = capacity ? (sold / capacity) * 100 : null;
      const showDate = new Date(row.date);
      const t7 = new Date(showDate);
      t7.setDate(showDate.getDate() - 7);
      const t14 = new Date(showDate);
      t14.setDate(showDate.getDate() - 14);

      let last7 = 0;
      let prev7 = 0;
      ticketOrders.forEach((ticket) => {
        if (ticket.showId !== row.id) return;
        const createdAt = ticket.order?.createdAt;
        if (!createdAt) return;
        if (createdAt >= t7 && createdAt <= showDate) {
          last7 += ticket.quantity || 0;
        } else if (createdAt >= t14 && createdAt < t7) {
          prev7 += ticket.quantity || 0;
        }
      });

      const soldByT7 = ticketOrders
        .filter((ticket) => ticket.showId === row.id && ticket.order?.createdAt && ticket.order.createdAt <= t7)
        .reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);

      const wowPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;

      return {
        showId: row.id,
        title: row.title,
        date: row.date,
        venue: row.venue,
        soldByT7,
        finalCapacityPct: capacityPct,
        wowPct,
      };
    });

    const funnelWindows = [7, 14, 30];
    const funnel = await Promise.all(
      funnelWindows.map(async (days) => {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const counts = await prisma.showEvent.groupBy({
          by: ["type"],
          where: { showId, ts: { gte: since } },
          _count: { _all: true },
        });
        const map = new Map(counts.map((row) => [row.type, row._count._all]));
        return {
          windowDays: days,
          counts: {
            VIEW: map.get("VIEW") || 0,
            ADD_TO_CART: map.get("ADD_TO_CART") || 0,
            CHECKOUT_START: map.get("CHECKOUT_START") || 0,
            PAID: map.get("PAID") || 0,
          },
        };
      })
    );

    const latestFunnel = funnel[funnel.length - 1];
    const stageOrder = ["VIEW", "ADD_TO_CART", "CHECKOUT_START", "PAID"];
    let biggestDrop = { stage: "VIEW", drop: 0 };
    for (let i = 0; i < stageOrder.length - 1; i += 1) {
      const current = latestFunnel.counts[stageOrder[i] as keyof typeof latestFunnel.counts] || 0;
      const next = latestFunnel.counts[stageOrder[i + 1] as keyof typeof latestFunnel.counts] || 0;
      const drop = current > 0 ? ((current - next) / current) * 100 : 0;
      if (drop > biggestDrop.drop) {
        biggestDrop = { stage: stageOrder[i], drop };
      }
    }

    const funnelRecommendations: string[] = [];
    if (biggestDrop.stage === "VIEW") {
      funnelRecommendations.push("Strengthen the call-to-action and pricing clarity.");
    } else if (biggestDrop.stage === "ADD_TO_CART") {
      funnelRecommendations.push("Streamline checkout and reduce steps.");
    } else if (biggestDrop.stage === "CHECKOUT_START") {
      funnelRecommendations.push("Remind cart abandoners with urgency messaging.");
    }

    res.json({
      ok: true,
      show,
      metrics: metricsRow,
      forecast: forecasted,
      risk,
      recommendations: recs,
      comparables,
      funnel,
      funnelInsights: {
        biggestDrop,
        recommendations: funnelRecommendations,
      },
    });
  } catch (err) {
    console.error("ai/insights/show failed", err);
    res.status(500).json({ ok: false, error: "Failed to load show insights" });
  }
});

function applyTemplateTokens(text: string, data: Record<string, string>) {
  return Object.entries(data).reduce(
    (output, [token, value]) => output.replace(new RegExp(`\\{${token}\\}`, "g"), value),
    text
  );
}

function applyToneRules(content: string, rules: any) {
  let output = content;
  const required = Array.isArray(rules?.requiredPhrases) ? rules.requiredPhrases : [];
  const banned = Array.isArray(rules?.bannedPhrases) ? rules.bannedPhrases : [];
  required.forEach((phrase: string) => {
    if (phrase && !output.toLowerCase().includes(String(phrase).toLowerCase())) {
      output = `${output} ${phrase}`.trim();
    }
  });
  banned.forEach((phrase: string) => {
    if (phrase) {
      const regex = new RegExp(phrase, "gi");
      output = output.replace(regex, "").replace(/\s{2,}/g, " ").trim();
    }
  });
  const emojiLevel = String(rules?.emojiLevel || "none");
  const emoji = emojiLevel === "high" ? "🎉" : emojiLevel === "medium" ? "✨" : emojiLevel === "low" ? "•" : "";
  if (emoji && !output.includes(emoji)) {
    output = `${emoji} ${output}`.trim();
  }
  return output;
}

function templateMatchesConditions(template: any, metrics: any) {
  if (!template.conditions) return true;
  const conditions = template.conditions as Record<string, any>;
  const remaining = metrics.capacity !== null ? Math.max(0, metrics.capacity - metrics.soldCount) : null;
  if (conditions.remainingLt !== undefined && remaining !== null && remaining >= conditions.remainingLt) return false;
  if (conditions.remainingLte !== undefined && remaining !== null && remaining > conditions.remainingLte) return false;
  if (conditions.timeToShowDaysLte !== undefined && metrics.timeToShowDays > conditions.timeToShowDaysLte) return false;
  if (conditions.wowPctLte !== undefined && metrics.wowPct > conditions.wowPctLte) return false;
  if (conditions.capacityPctLte !== undefined && metrics.capacityPct !== null && metrics.capacityPct > conditions.capacityPctLte) return false;
  return true;
}

async function ensureStarterTemplates(organiserId: string) {
  const count = await prisma.marketingAiTemplate.count({ where: { organiserId } });
  if (count > 0) return;

  const seedTemplates = [
    {
      channel: "Social",
      objective: "Save the date",
      tone: "local pride",
      title: "Save the date for {HEADLINER}",
      body: "{TOWN} gets a big night out at {VENUE} on {DATE}. Tickets from {PRICE_FROM}. {BOOKING_LINK}",
    },
    {
      channel: "Email",
      objective: "Reminder",
      tone: "family",
      title: "Reminder: {HEADLINER} at {VENUE}",
      body: "Bring the crew to {VENUE} on {DATE}. Seats are moving fast — tickets from {PRICE_FROM}. {BOOKING_LINK}",
    },
    {
      channel: "PR",
      objective: "General promo",
      tone: "premium",
      title: "{HEADLINER} announces {TOWN} date",
      body: "{HEADLINER} lands at {VENUE} in {TOWN} on {DATE}. Early tickets start at {PRICE_FROM}. {BOOKING_LINK}",
    },
    {
      channel: "WhatsApp",
      objective: "Last chance",
      tone: "urgent",
      title: "Last tickets for {HEADLINER}",
      body: "Final tickets for {HEADLINER} on {DATE} at {VENUE}. {REMAINING} left — {BOOKING_LINK}",
      conditions: { timeToShowDaysLte: 7 },
    },
    {
      channel: "Social",
      objective: "Final tickets",
      tone: "cheeky",
      title: "Final tickets alert",
      body: "{HEADLINER} is nearly sold out. {REMAINING} tickets left — grab yours: {BOOKING_LINK}",
      conditions: { remainingLte: 30 },
    },
  ];

  await prisma.marketingAiTemplate.createMany({
    data: seedTemplates.map((template) => ({
      organiserId,
      channel: template.channel,
      objective: template.objective,
      tone: template.tone,
      title: template.title,
      body: template.body,
      conditions: template.conditions ?? Prisma.DbNull,
      approved: true,
      isDefault: false,
    })),
  });
}

async function generateDrafts(params: {
  organiserId: string;
  showId: string;
  channel: string;
  objective: string;
  tone: string;
  createdByUserId: string | null;
}) {
  const show = await prisma.show.findFirst({
    where: { id: params.showId, organiserId: params.organiserId },
    select: {
      id: true,
      title: true,
      date: true,
      showCapacity: true,
      venue: { select: { name: true, city: true } },
      ticketTypes: { select: { pricePence: true, available: true } },
    },
  });
  if (!show) throw new Error("Show not found");

  await ensureStarterTemplates(params.organiserId);

  const templates = await prisma.marketingAiTemplate.findMany({
    where: {
      organiserId: params.organiserId,
      channel: params.channel,
      objective: params.objective,
      tone: params.tone,
    },
    orderBy: [{ approved: "desc" }, { isDefault: "desc" }, { createdAt: "desc" }],
  });

  const metricsMap = await computeShowMetricsBatch({ showIds: [show.id] });
  const metrics = metricsMap.get(show.id);
  if (!metrics) throw new Error("Metrics unavailable");

  const dataTokens = {
    TOWN: show.venue?.city || "your town",
    VENUE: show.venue?.name || "the venue",
    DATE: formatDateShort(new Date(show.date)),
    HEADLINER: show.title || "the show",
    LINEUP: show.title || "",
    PRICE_FROM: formatCurrency(priceFrom(show.ticketTypes) || 0),
    REMAINING:
      metrics.capacity !== null
        ? `${Math.max(0, metrics.capacity - metrics.soldCount)} tickets`
        : "limited tickets",
    BOOKING_LINK: `/public/event/${show.id}`,
  };

  const tonePreset = await prisma.marketingAiTonePreset.findFirst({
    where: { organiserId: params.organiserId, name: params.tone, approved: true },
  });

  const candidateTemplates = templates.filter((template) => templateMatchesConditions(template, metrics));
  const selected = (candidateTemplates.length ? candidateTemplates : templates).slice(0, 5);

  const drafts = selected.map((template, index) => {
    const filledTitle = applyTemplateTokens(template.title, dataTokens);
    let content = applyTemplateTokens(template.body, dataTokens);
    if (tonePreset) {
      content = applyToneRules(content, tonePreset.rules || {});
    }
    return {
      title: filledTitle,
      content,
      sourceTemplateId: template.id,
      reason: template.conditions
        ? "Matched template conditions"
        : index === 0
          ? "Default template selection"
          : "Template match",
    };
  });

  const createdDrafts = await Promise.all(
    drafts.map((draft) =>
      prisma.marketingAiDraft.create({
        data: {
          organiserId: params.organiserId,
          showId: show.id,
          channel: params.channel,
          objective: params.objective,
          tone: params.tone,
          title: draft.title,
          content: draft.content,
          sourceTemplateId: draft.sourceTemplateId,
          createdByUserId: params.createdByUserId,
        },
      })
    )
  );

  return { drafts, createdDrafts };
}

router.post("/ai/insights/action", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const showId = String(req.body?.showId || "");
    const actionType = String(req.body?.actionType || "");
    if (!showId || !actionType) {
      return res.status(400).json({ ok: false, error: "showId and actionType required" });
    }

    const actionMap: Record<string, { channel: string; objective: string; tone: string }> = {
      email_campaign: { channel: "Email", objective: "Reminder", tone: "urgent" },
      paid_boost: { channel: "Social", objective: "General promo", tone: "cheeky" },
      final_tickets: { channel: "Social", objective: "Final tickets", tone: "urgent" },
    };

    const action = actionMap[actionType];
    if (!action) return res.status(400).json({ ok: false, error: "Unknown action" });

    const result = await generateDrafts({
      organiserId,
      showId,
      channel: action.channel,
      objective: action.objective,
      tone: action.tone,
      createdByUserId: organiserId,
    });

    res.json({ ok: true, drafts: result.createdDrafts });
  } catch (err) {
    console.error("ai/insights/action failed", err);
    res.status(500).json({ ok: false, error: "Failed to create drafts" });
  }
});

router.post("/ai/marketing/generate", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { showId, channel, objective, tone } = req.body || {};
    if (!showId || !channel || !objective || !tone) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const result = await generateDrafts({
      organiserId,
      showId: String(showId),
      channel: String(channel),
      objective: String(objective),
      tone: String(tone),
      createdByUserId: organiserId,
    });

    res.json({ ok: true, drafts: result.drafts, saved: result.createdDrafts });
  } catch (err) {
    console.error("ai/marketing/generate failed", err);
    res.status(500).json({ ok: false, error: "Failed to generate drafts" });
  }
});

router.get("/ai/marketing/drafts", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const where: any = { organiserId };
    if (req.query.showId) where.showId = String(req.query.showId);
    if (req.query.channel) where.channel = String(req.query.channel);
    if (req.query.objective) where.objective = String(req.query.objective);
    if (req.query.tone) where.tone = String(req.query.tone);

    const drafts = await prisma.marketingAiDraft.findMany({
      where,
      include: { performance: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, drafts });
  } catch (err) {
    console.error("ai/marketing/drafts list failed", err);
    res.status(500).json({ ok: false, error: "Failed to load drafts" });
  }
});

router.post("/ai/marketing/drafts", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const { id, showId, channel, objective, tone, title, content } = req.body || {};
    if (!channel || !objective || !tone || !title || !content) {
      return res.status(400).json({ ok: false, error: "Missing draft fields" });
    }

    if (showId) {
      const show = await prisma.show.findFirst({
        where: { id: String(showId), organiserId },
        select: { id: true },
      });
      if (!show) return res.status(404).json({ ok: false, error: "Show not found" });
    }

    const payload = {
      organiserId,
      showId: showId ? String(showId) : null,
      channel: String(channel),
      objective: String(objective),
      tone: String(tone),
      title: String(title),
      content: String(content),
      createdByUserId: organiserId,
    };

    if (id) {
      const existing = await prisma.marketingAiDraft.findFirst({
        where: { id: String(id), organiserId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ ok: false, error: "Draft not found" });
    }

    const draft = id
      ? await prisma.marketingAiDraft.update({ where: { id: String(id) }, data: payload })
      : await prisma.marketingAiDraft.create({ data: payload });

    res.json({ ok: true, draft });
  } catch (err) {
    console.error("ai/marketing/drafts save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save draft" });
  }
});

router.delete("/ai/marketing/drafts/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const draft = await prisma.marketingAiDraft.findFirst({
      where: { id: String(req.params.id), organiserId },
      select: { id: true },
    });
    if (!draft) return res.status(404).json({ ok: false, error: "Draft not found" });
    await prisma.marketingAiDraft.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    console.error("ai/marketing/drafts delete failed", err);
    res.status(500).json({ ok: false, error: "Failed to delete draft" });
  }
});

router.post("/ai/marketing/drafts/:id/performance", requireAdminOrOrganiser, async (req, res) => {
  try {
    const draftId = String(req.params.id);
    const organiserId = organiserIdFor(req);
    const existing = await prisma.marketingAiDraft.findFirst({
      where: { id: draftId, organiserId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "Draft not found" });
    const payload = {
      used: !!req.body?.used,
      usedAt: req.body?.usedAt ? new Date(req.body.usedAt) : null,
      platform: req.body?.platform ? String(req.body.platform) : null,
      metrics: req.body?.metrics ?? null,
      notes: req.body?.notes ? String(req.body.notes) : null,
    };

    const performance = await prisma.marketingAiDraftPerformance.upsert({
      where: { draftId },
      create: { draftId, ...payload },
      update: payload,
    });

    res.json({ ok: true, performance });
  } catch (err) {
    console.error("ai/marketing/performance failed", err);
    res.status(500).json({ ok: false, error: "Failed to save performance" });
  }
});

router.get("/ai/marketing/templates", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    await ensureStarterTemplates(organiserId);
    const templates = await prisma.marketingAiTemplate.findMany({
      where: { organiserId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, templates });
  } catch (err) {
    console.error("ai/marketing/templates list failed", err);
    res.status(500).json({ ok: false, error: "Failed to load templates" });
  }
});

router.post("/ai/marketing/templates", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const { id, channel, objective, tone, title, body, conditions, approved, isDefault } = req.body || {};

    const payload = {
      organiserId,
      channel: String(channel),
      objective: String(objective),
      tone: String(tone),
      title: String(title),
      body: String(body),
      conditions: conditions ?? null,
      approved: !!approved,
      isDefault: !!isDefault,
    };

    if (payload.isDefault) {
      await prisma.marketingAiTemplate.updateMany({
        where: { organiserId, channel: payload.channel, objective: payload.objective, tone: payload.tone },
        data: { isDefault: false },
      });
    }

    if (id) {
      const existing = await prisma.marketingAiTemplate.findFirst({
        where: { id: String(id), organiserId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ ok: false, error: "Template not found" });
    }

    const template = id
      ? await prisma.marketingAiTemplate.update({ where: { id: String(id) }, data: payload })
      : await prisma.marketingAiTemplate.create({ data: payload });

    res.json({ ok: true, template });
  } catch (err) {
    console.error("ai/marketing/templates save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save template" });
  }
});

router.delete("/ai/marketing/templates/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const existing = await prisma.marketingAiTemplate.findFirst({
      where: { id: String(req.params.id), organiserId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "Template not found" });
    await prisma.marketingAiTemplate.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    console.error("ai/marketing/templates delete failed", err);
    res.status(500).json({ ok: false, error: "Failed to delete template" });
  }
});

router.get("/ai/marketing/tone-presets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const presets = await prisma.marketingAiTonePreset.findMany({
      where: { organiserId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, presets });
  } catch (err) {
    console.error("ai/marketing/tone-presets list failed", err);
    res.status(500).json({ ok: false, error: "Failed to load tone presets" });
  }
});

router.post("/ai/marketing/tone-presets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const { id, name, rules, approved } = req.body || {};

    const payload = {
      organiserId,
      name: String(name),
      rules: rules ?? null,
      approved: !!approved,
    };

    if (id) {
      const existing = await prisma.marketingAiTonePreset.findFirst({
        where: { id: String(id), organiserId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ ok: false, error: "Tone preset not found" });
    }

    const preset = id
      ? await prisma.marketingAiTonePreset.update({ where: { id: String(id) }, data: payload })
      : await prisma.marketingAiTonePreset.create({ data: payload });

    res.json({ ok: true, preset });
  } catch (err) {
    console.error("ai/marketing/tone-presets save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save tone preset" });
  }
});

router.delete("/ai/marketing/tone-presets/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = organiserIdFor(req);
    const existing = await prisma.marketingAiTonePreset.findFirst({
      where: { id: String(req.params.id), organiserId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "Tone preset not found" });
    await prisma.marketingAiTonePreset.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    console.error("ai/marketing/tone-presets delete failed", err);
    res.status(500).json({ ok: false, error: "Failed to delete tone preset" });
  }
});

export default router;
