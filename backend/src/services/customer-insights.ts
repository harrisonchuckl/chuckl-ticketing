import prisma from "../lib/prisma.js";
import { OrderStatus, Prisma } from "@prisma/client";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const PURCHASE_RECENCY_THRESHOLDS = [30, 90, 180, 365];
const FREQUENCY_THRESHOLDS = [2, 3, 6, 10];
const MONETARY_THRESHOLDS_PENCE = [5000, 10000, 25000, 50000];

export type CustomerInsightRule =
  | { type: "RFM_SEGMENT"; value: string }
  | { type: "RECENCY_SCORE_AT_LEAST"; score: number }
  | { type: "FREQUENCY_SCORE_AT_LEAST"; score: number }
  | { type: "MONETARY_SCORE_AT_LEAST"; score: number }
  | { type: "PURCHASE_COUNT_AT_LEAST"; count: number }
  | { type: "PURCHASE_COUNT_90D_AT_LEAST"; count: number }
  | { type: "MONETARY_VALUE_AT_LEAST"; amount: number }
  | { type: "MONETARY_VALUE_90D_AT_LEAST"; amount: number }
  | { type: "GROUP_BUYER"; value: boolean }
  | { type: "LAST_PURCHASE_WITHIN_DAYS"; days: number }
  | { type: "LAST_PURCHASE_OLDER_THAN"; days: number }
  | { type: "FAVOURITE_VENUE"; venueId: string }
  | { type: "TOP_VENUE_INCLUDES"; venueId: string }
  | { type: "FAVOURITE_CATEGORY_CONTAINS"; value: string }
  | { type: "FAVOURITE_EVENT_TYPE_CONTAINS"; value: string };

export type CustomerInsightRulesPayload = {
  rules?: CustomerInsightRule[];
  all?: CustomerInsightRule[];
};

type CustomerAggregate = {
  tenantId: string;
  email: string;
  customerAccountId: string | null;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  purchaseCount: number;
  purchaseCount90d: number;
  ticketsBoughtLifetime: number;
  monetaryValueLifetimePence: number;
  monetaryValue90dPence: number;
  venueCounts: Map<string, number>;
  categoryCounts: Map<string, number>;
  eventTypeCounts: Map<string, number>;
};

type OrderRow = {
  id: string;
  createdAt: Date;
  amountPence: number;
  quantity: number | null;
  email: string | null;
  shippingEmail: string | null;
  customerAccountId: string | null;
  show: {
    organiserId: string | null;
    venueId: string | null;
    eventCategory: string | null;
    eventType: string | null;
  } | null;
  _count: { tickets: number };
  user: { email: string | null } | null;
};

function normaliseEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function buildCustomerKey(tenantId: string, email: string, customerAccountId: string | null) {
  return `${tenantId}:${email}:${customerAccountId || "none"}`;
}

function addCount(map: Map<string, number>, value: string | null | undefined) {
  if (!value) return;
  const key = String(value);
  map.set(key, (map.get(key) || 0) + 1);
}

function scoreRecency(lastPurchaseAt: Date | null) {
  if (!lastPurchaseAt) return 1;
  const days = Math.floor((Date.now() - lastPurchaseAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= PURCHASE_RECENCY_THRESHOLDS[0]) return 5;
  if (days <= PURCHASE_RECENCY_THRESHOLDS[1]) return 4;
  if (days <= PURCHASE_RECENCY_THRESHOLDS[2]) return 3;
  if (days <= PURCHASE_RECENCY_THRESHOLDS[3]) return 2;
  return 1;
}

function scoreFrequency(purchaseCount: number) {
  if (purchaseCount >= FREQUENCY_THRESHOLDS[3]) return 5;
  if (purchaseCount >= FREQUENCY_THRESHOLDS[2]) return 4;
  if (purchaseCount >= FREQUENCY_THRESHOLDS[1]) return 3;
  if (purchaseCount >= FREQUENCY_THRESHOLDS[0]) return 2;
  return 1;
}

function scoreMonetary(totalPence: number) {
  if (totalPence >= MONETARY_THRESHOLDS_PENCE[3]) return 5;
  if (totalPence >= MONETARY_THRESHOLDS_PENCE[2]) return 4;
  if (totalPence >= MONETARY_THRESHOLDS_PENCE[1]) return 3;
  if (totalPence >= MONETARY_THRESHOLDS_PENCE[0]) return 2;
  return 1;
}

function resolveRfmSegment(recency: number, frequency: number, monetary: number) {
  if (recency >= 4 && frequency >= 4 && monetary >= 4) return "Champion";
  if (recency >= 4 && frequency >= 3) return "Loyal";
  if (recency <= 2 && frequency >= 3) return "At Risk";
  if (recency <= 1) return "Lapsed";
  if (recency >= 3) return "Potential";
  return "Needs Attention";
}

function selectTopKeys(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .sort((a, b) => {
      if (b[1] === a[1]) return a[0].localeCompare(b[0]);
      return b[1] - a[1];
    })
    .slice(0, limit)
    .map(([key]) => key);
}

function buildAggregateForOrder(order: OrderRow, cutoff90d: Date, existing?: CustomerAggregate) {
  const email = normaliseEmail(order.email || order.shippingEmail || order.user?.email || "");
  if (!email) return null;
  const organiserId = order.show?.organiserId;
  if (!organiserId) return null;

  const aggregate: CustomerAggregate = existing || {
    tenantId: organiserId,
    email,
    customerAccountId: order.customerAccountId,
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    purchaseCount: 0,
    purchaseCount90d: 0,
    ticketsBoughtLifetime: 0,
    monetaryValueLifetimePence: 0,
    monetaryValue90dPence: 0,
    venueCounts: new Map(),
    categoryCounts: new Map(),
    eventTypeCounts: new Map(),
  };

  aggregate.purchaseCount += 1;
  aggregate.monetaryValueLifetimePence += Number(order.amountPence || 0);

  const ticketCount = order._count.tickets || Number(order.quantity || 0) || 0;
  aggregate.ticketsBoughtLifetime += ticketCount;

  if (!aggregate.firstPurchaseAt || order.createdAt < aggregate.firstPurchaseAt) {
    aggregate.firstPurchaseAt = order.createdAt;
  }
  if (!aggregate.lastPurchaseAt || order.createdAt > aggregate.lastPurchaseAt) {
    aggregate.lastPurchaseAt = order.createdAt;
  }

  if (order.createdAt >= cutoff90d) {
    aggregate.purchaseCount90d += 1;
    aggregate.monetaryValue90dPence += Number(order.amountPence || 0);
  }

  addCount(aggregate.venueCounts, order.show?.venueId || undefined);
  addCount(aggregate.categoryCounts, order.show?.eventCategory || undefined);
  addCount(aggregate.eventTypeCounts, order.show?.eventType || undefined);

  return aggregate;
}

function buildInsightPayload(aggregate: CustomerAggregate) {
  const avgTicketsPerOrder = aggregate.purchaseCount
    ? aggregate.ticketsBoughtLifetime / aggregate.purchaseCount
    : 0;
  const groupBuyerScore = avgTicketsPerOrder >= 3;

  const recencyScore = scoreRecency(aggregate.lastPurchaseAt);
  const frequencyScore = scoreFrequency(aggregate.purchaseCount);
  const monetaryScore = scoreMonetary(aggregate.monetaryValueLifetimePence);
  const rfmSegment = resolveRfmSegment(recencyScore, frequencyScore, monetaryScore);

  const topVenueIds = selectTopKeys(aggregate.venueCounts, 3);
  const favouriteVenueId = topVenueIds[0] || null;
  const favouriteCategory = selectTopKeys(aggregate.categoryCounts, 1)[0] || null;
  const favouriteEventType = selectTopKeys(aggregate.eventTypeCounts, 1)[0] || null;

  return {
    tenantId: aggregate.tenantId,
    email: aggregate.email,
    customerAccountId: aggregate.customerAccountId,
    customerKey: buildCustomerKey(aggregate.tenantId, aggregate.email, aggregate.customerAccountId),
    firstPurchaseAt: aggregate.firstPurchaseAt,
    lastPurchaseAt: aggregate.lastPurchaseAt,
    purchaseCount: aggregate.purchaseCount,
    purchaseCount90d: aggregate.purchaseCount90d,
    ticketsBoughtLifetime: aggregate.ticketsBoughtLifetime,
    avgTicketsPerOrder,
    groupBuyerScore,
    monetaryValueLifetimePence: aggregate.monetaryValueLifetimePence,
    monetaryValue90dPence: aggregate.monetaryValue90dPence,
    recencyScore,
    frequencyScore,
    monetaryScore,
    rfmSegment,
    favouriteVenueId,
    topVenueIds,
    favouriteCategory,
    favouriteEventType,
  };
}

export async function rebuildAllCustomerInsights() {
  const batchSize = Number(process.env.CUSTOMER_INSIGHTS_BATCH_SIZE || 1000);
  const cutoff90d = new Date(Date.now() - NINETY_DAYS_MS);
  const aggregates = new Map<string, CustomerAggregate>();

  let cursor: string | undefined;
  while (true) {
    const orders = await prisma.order.findMany({
      where: { status: OrderStatus.PAID },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        amountPence: true,
        quantity: true,
        email: true,
        shippingEmail: true,
        customerAccountId: true,
        show: {
          select: {
            organiserId: true,
            venueId: true,
            eventCategory: true,
            eventType: true,
          },
        },
        _count: { select: { tickets: true } },
        user: { select: { email: true } },
      },
    });

    if (!orders.length) break;

    for (const order of orders) {
      const email = normaliseEmail(order.email || order.shippingEmail || order.user?.email || "");
      if (!email) continue;
      const organiserId = order.show?.organiserId;
      if (!organiserId) continue;
      const customerKey = buildCustomerKey(organiserId, email, order.customerAccountId);
      const existing = aggregates.get(customerKey);
      const aggregate = buildAggregateForOrder(order, cutoff90d, existing || undefined);
      if (!aggregate) continue;
      aggregates.set(customerKey, aggregate);
    }

    cursor = orders[orders.length - 1]?.id;
    if (orders.length < batchSize) break;
  }

  const payloads = Array.from(aggregates.values()).map(buildInsightPayload);
  const chunkSize = 200;
  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((payload) =>
        prisma.customerInsight.upsert({
          where: { customerKey: payload.customerKey },
          update: payload,
          create: payload,
        })
      )
    );
  }

  return payloads.length;
}

export async function recomputeCustomerInsightForCustomer(
  tenantId: string,
  email: string,
  customerAccountId: string | null
) {
  const cutoff90d = new Date(Date.now() - NINETY_DAYS_MS);
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAID,
      show: { organiserId: tenantId },
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { shippingEmail: { equals: email, mode: "insensitive" } },
      ],
      ...(customerAccountId ? { customerAccountId } : { customerAccountId: null }),
    },
    select: {
      id: true,
      createdAt: true,
      amountPence: true,
      quantity: true,
      email: true,
      shippingEmail: true,
      customerAccountId: true,
      show: {
        select: {
          organiserId: true,
          venueId: true,
          eventCategory: true,
          eventType: true,
        },
      },
      _count: { select: { tickets: true } },
      user: { select: { email: true } },
    },
  });

  if (!orders.length) return null;

  let aggregate: CustomerAggregate | null = null;
  for (const order of orders) {
    aggregate = buildAggregateForOrder(order, cutoff90d, aggregate || undefined);
  }
  if (!aggregate) return null;

  const payload = buildInsightPayload(aggregate);
  return prisma.customerInsight.upsert({
    where: { customerKey: payload.customerKey },
    update: payload,
    create: payload,
  });
}

export async function refreshCustomerInsightForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      email: true,
      shippingEmail: true,
      customerAccountId: true,
      show: { select: { organiserId: true } },
    },
  });
  const tenantId = order?.show?.organiserId;
  const email = normaliseEmail(order?.email || order?.shippingEmail || "");
  if (!tenantId || !email) return null;
  return recomputeCustomerInsightForCustomer(tenantId, email, order?.customerAccountId || null);
}

function normaliseInsightRules(input: unknown): CustomerInsightRule[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as CustomerInsightRule[];
  if (typeof input === "object") {
    const payload = input as CustomerInsightRulesPayload;
    if (Array.isArray(payload.rules)) return payload.rules as CustomerInsightRule[];
    if (Array.isArray(payload.all)) return payload.all as CustomerInsightRule[];
  }
  return [];
}

function buildInsightWhere(rules: CustomerInsightRule[]) {
  const and: Prisma.CustomerInsightWhereInput[] = [];
  const now = Date.now();

  for (const rule of rules) {
    switch (rule.type) {
      case "RFM_SEGMENT":
        if (rule.value) and.push({ rfmSegment: rule.value });
        break;
      case "RECENCY_SCORE_AT_LEAST":
        and.push({ recencyScore: { gte: Number(rule.score || 0) } });
        break;
      case "FREQUENCY_SCORE_AT_LEAST":
        and.push({ frequencyScore: { gte: Number(rule.score || 0) } });
        break;
      case "MONETARY_SCORE_AT_LEAST":
        and.push({ monetaryScore: { gte: Number(rule.score || 0) } });
        break;
      case "PURCHASE_COUNT_AT_LEAST":
        and.push({ purchaseCount: { gte: Number(rule.count || 0) } });
        break;
      case "PURCHASE_COUNT_90D_AT_LEAST":
        and.push({ purchaseCount90d: { gte: Number(rule.count || 0) } });
        break;
      case "MONETARY_VALUE_AT_LEAST":
        and.push({ monetaryValueLifetimePence: { gte: Math.round(Number(rule.amount || 0) * 100) } });
        break;
      case "MONETARY_VALUE_90D_AT_LEAST":
        and.push({ monetaryValue90dPence: { gte: Math.round(Number(rule.amount || 0) * 100) } });
        break;
      case "GROUP_BUYER":
        and.push({ groupBuyerScore: Boolean(rule.value) });
        break;
      case "LAST_PURCHASE_WITHIN_DAYS": {
        const days = Number(rule.days || 0);
        const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
        and.push({ lastPurchaseAt: { gte: cutoff } });
        break;
      }
      case "LAST_PURCHASE_OLDER_THAN": {
        const days = Number(rule.days || 0);
        const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
        and.push({ lastPurchaseAt: { lte: cutoff } });
        break;
      }
      case "FAVOURITE_VENUE":
        if (rule.venueId) and.push({ favouriteVenueId: rule.venueId });
        break;
      case "TOP_VENUE_INCLUDES":
        if (rule.venueId) and.push({ topVenueIds: { has: rule.venueId } });
        break;
      case "FAVOURITE_CATEGORY_CONTAINS":
        if (rule.value) {
          and.push({ favouriteCategory: { contains: rule.value, mode: "insensitive" } });
        }
        break;
      case "FAVOURITE_EVENT_TYPE_CONTAINS":
        if (rule.value) {
          and.push({ favouriteEventType: { contains: rule.value, mode: "insensitive" } });
        }
        break;
      default:
        break;
    }
  }

  return and.length ? { AND: and } : {};
}

export async function queryCustomerInsights(tenantId: string, rulesInput: unknown, limit = 100) {
  const rules = normaliseInsightRules(rulesInput);
  const where = buildInsightWhere(rules);

  const items = await prisma.customerInsight.findMany({
    where: {
      tenantId,
      ...where,
    },
    orderBy: { lastPurchaseAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });

  return {
    count: items.length,
    items,
  };
}

export async function runCustomerInsightsJob() {
  const startedAt = new Date();
  await prisma.customerInsightsWorkerState.upsert({
    where: { id: "global" },
    update: { lastRunAt: startedAt, lastError: null },
    create: { id: "global", lastRunAt: startedAt, lastProcessedCount: 0, lastError: null },
  });

  try {
    const processed = await rebuildAllCustomerInsights();
    const completedAt = new Date();
    await prisma.customerInsightsWorkerState.update({
      where: { id: "global" },
      data: {
        lastRunCompletedAt: completedAt,
        lastProcessedCount: processed,
        lastError: null,
      },
    });
    return { processed, completedAt };
  } catch (error: any) {
    const completedAt = new Date();
    await prisma.customerInsightsWorkerState.update({
      where: { id: "global" },
      data: {
        lastRunCompletedAt: completedAt,
        lastError: String(error?.message || error),
      },
    });
    throw error;
  }
}
