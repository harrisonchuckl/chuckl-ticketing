import prisma from '../../lib/prisma.js';
import { OrderStatus } from '@prisma/client';

export type SegmentRule =
  | { type: 'HAS_TAG'; value: string }
  | { type: 'NOT_TAG'; value: string }
  | { type: 'LAST_PURCHASE_OLDER_THAN'; days: number }
  | { type: 'PURCHASE_COUNT_90D_AT_LEAST'; count: number }
  | { type: 'MONETARY_TIER'; metric: 'LIFETIME' | 'NINETY_DAYS'; tier: 'LOW' | 'MID' | 'HIGH' }
  | { type: 'AVG_TICKETS_PER_ORDER_AT_LEAST'; count: number }
  | { type: 'FAVOURITE_VENUE_ID'; venueId: string }
  | { type: 'PURCHASED_AT_VENUE'; venueId: string }
  | { type: 'FAVOURITE_CATEGORY_CONTAINS'; value: string }
  | { type: 'FAVOURITE_EVENT_TYPE_CONTAINS'; value: string }
  | { type: 'VIEWED_NO_PURCHASE_AFTER'; days: number }
  | { type: 'LIFECYCLE_STAGE'; value: 'NEW' | 'RETURNING' | 'LAPSED'; newWithinDays?: number; lapsedAfterDays?: number }
  | { type: 'CONSENT_STATUS_IS'; value: string }
  | { type: 'PREFERENCE_TOPIC_STATUS'; topicId: string; status: string }
  | { type: 'PURCHASED_CATEGORY_CONTAINS'; value: string }
  | { type: 'TOTAL_SPENT_AT_LEAST'; amount: number }
  | { type: 'ATTENDED_VENUE'; venueId: string };

export type SegmentRulesPayload = {
  rules?: SegmentRule[];
  all?: SegmentRule[];
};

export type SegmentContact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  consentStatus: string | null;
  tags: string[];
  preferences: Array<{ topicId: string; status: string }>;
};

export type SegmentOrderStats = {
  lastPurchase: Date | null;
  totalSpentPence: number;
  totalSpent90dPence: number;
  purchaseCount: number;
  purchaseCount90d: number;
  categories: Set<string>;
  venues: Set<string>;
  eventTypes: Set<string>;
};

type SegmentInsight = {
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
  purchaseCount: number;
  purchaseCount90d: number;
  avgTicketsPerOrder: number;
  monetaryValueLifetimePence: number;
  monetaryValue90dPence: number;
  favouriteVenueId: string | null;
  topVenueIds: string[];
  favouriteCategory: string | null;
  favouriteEventType: string | null;
};

type SegmentViewStats = {
  lastViewAt: Date | null;
};

function normaliseRules(input: unknown): SegmentRule[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as SegmentRule[];
  if (typeof input === 'object') {
    const anyInput = input as SegmentRulesPayload;
    if (Array.isArray(anyInput.rules)) return anyInput.rules as SegmentRule[];
    if (Array.isArray(anyInput.all)) return anyInput.all as SegmentRule[];
  }
  return [];
}

export async function evaluateSegmentContacts(
  tenantId: string,
  rulesInput: unknown
): Promise<SegmentContact[]> {
  const rules = normaliseRules(rulesInput);
  const contacts = await prisma.marketingContact.findMany({
    where: { tenantId },
    include: {
      tags: { include: { tag: true } },
      consents: true,
      preferences: true,
    },
  });

  const contactRecords = contacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    consentStatus: contact.consents[0]?.status || null,
    tags: contact.tags.map((t) => t.tag.name),
    preferences: contact.preferences.map((pref) => ({
      topicId: pref.topicId,
      status: String(pref.status || ''),
    })),
  }));

  const needsInsightData = rules.some((rule) =>
    [
      'LAST_PURCHASE_OLDER_THAN',
      'PURCHASE_COUNT_90D_AT_LEAST',
      'MONETARY_TIER',
      'AVG_TICKETS_PER_ORDER_AT_LEAST',
      'FAVOURITE_VENUE_ID',
      'FAVOURITE_CATEGORY_CONTAINS',
      'FAVOURITE_EVENT_TYPE_CONTAINS',
      'VIEWED_NO_PURCHASE_AFTER',
      'LIFECYCLE_STAGE',
    ].includes(rule.type)
  );

  const needsOrderData = rules.some((rule) =>
    [
      'LAST_PURCHASE_OLDER_THAN',
      'PURCHASED_CATEGORY_CONTAINS',
      'TOTAL_SPENT_AT_LEAST',
      'ATTENDED_VENUE',
      'PURCHASED_AT_VENUE',
      'VIEWED_NO_PURCHASE_AFTER',
    ].includes(rule.type)
  );

  const orderStats = new Map<
    string,
    SegmentOrderStats
  >();

  const insightMap = new Map<string, SegmentInsight>();

  if (needsInsightData && contactRecords.length) {
    const emails = contactRecords.map((c) => c.email);
    const insights = await prisma.customerInsight.findMany({
      where: { tenantId, email: { in: emails } },
    });
    for (const insight of insights) {
      const email = String(insight.email || '').toLowerCase();
      if (!email) continue;
      insightMap.set(email, {
        firstPurchaseAt: insight.firstPurchaseAt,
        lastPurchaseAt: insight.lastPurchaseAt,
        purchaseCount: insight.purchaseCount,
        purchaseCount90d: insight.purchaseCount90d,
        avgTicketsPerOrder: insight.avgTicketsPerOrder,
        monetaryValueLifetimePence: insight.monetaryValueLifetimePence,
        monetaryValue90dPence: insight.monetaryValue90dPence,
        favouriteVenueId: insight.favouriteVenueId,
        topVenueIds: insight.topVenueIds,
        favouriteCategory: insight.favouriteCategory,
        favouriteEventType: insight.favouriteEventType,
      });
    }
  }

  const needsViewData = rules.some((rule) => rule.type === 'VIEWED_NO_PURCHASE_AFTER');
  const viewStats = new Map<string, SegmentViewStats>();

  if (needsViewData && contactRecords.length) {
    const emails = contactRecords.map((c) => c.email);
    const maxViewDays = rules
      .filter((rule) => rule.type === 'VIEWED_NO_PURCHASE_AFTER')
      .map((rule) => Number(rule.days || 0))
      .reduce((max, days) => (days > max ? days : max), 0);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (maxViewDays || 30));

    const views = await prisma.customerShowView.findMany({
      where: {
        createdAt: { gte: cutoff },
        show: { organiserId: tenantId },
        customerAccount: { email: { in: emails } },
      },
      select: {
        createdAt: true,
        customerAccount: { select: { email: true } },
      },
    });

    for (const view of views) {
      const email = String(view.customerAccount?.email || '').toLowerCase();
      if (!email) continue;
      const existing = viewStats.get(email) || { lastViewAt: null };
      if (!existing.lastViewAt || view.createdAt > existing.lastViewAt) {
        existing.lastViewAt = view.createdAt;
      }
      viewStats.set(email, existing);
    }
  }

  if (needsOrderData && contactRecords.length) {
    const emails = contactRecords.map((c) => c.email);
    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        email: { in: emails },
        show: { organiserId: tenantId },
      },
      select: {
        email: true,
        amountPence: true,
        createdAt: true,
        show: { select: { eventCategory: true, eventType: true, tags: true, venueId: true } },
      },
    });

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const order of orders) {
      const email = String(order.email || '').toLowerCase();
      if (!email) continue;
      const existing = orderStats.get(email) || {
        lastPurchase: null,
        totalSpentPence: 0,
        totalSpent90dPence: 0,
        purchaseCount: 0,
        purchaseCount90d: 0,
        categories: new Set<string>(),
        venues: new Set<string>(),
        eventTypes: new Set<string>(),
      };
      existing.totalSpentPence += Number(order.amountPence || 0);
      existing.purchaseCount += 1;
      if (!existing.lastPurchase || order.createdAt > existing.lastPurchase) {
        existing.lastPurchase = order.createdAt;
      }
      if (order.createdAt >= ninetyDaysAgo) {
        existing.totalSpent90dPence += Number(order.amountPence || 0);
        existing.purchaseCount90d += 1;
      }
      if (order.show?.eventCategory) {
        existing.categories.add(String(order.show.eventCategory).toLowerCase());
      }
      if (order.show?.eventType) {
        existing.eventTypes.add(String(order.show.eventType).toLowerCase());
      }
      if (Array.isArray(order.show?.tags)) {
        for (const tag of order.show?.tags || []) {
          existing.categories.add(String(tag).toLowerCase());
        }
      }
      if (order.show?.venueId) {
        existing.venues.add(String(order.show.venueId));
      }
      orderStats.set(email, existing);
    }
  }

  const matches = (contact: SegmentContact) => {
    const emailKey = contact.email.toLowerCase();
    const stats = orderStats.get(emailKey) || null;
    const insight = insightMap.get(emailKey) || null;
    const views = viewStats.get(emailKey) || null;
    return matchesSegmentRules(contact, rules, stats, insight, views);
  };

  return contactRecords.filter(matches);
}

export function matchesSegmentRules(
  contact: SegmentContact,
  rules: SegmentRule[],
  stats: SegmentOrderStats | null,
  insight: SegmentInsight | null,
  views: SegmentViewStats | null
) {
  const resolveLastPurchase = () => insight?.lastPurchaseAt || stats?.lastPurchase || null;
  const resolveFirstPurchase = () => insight?.firstPurchaseAt || null;
  const resolvePurchaseCount90d = () => insight?.purchaseCount90d ?? stats?.purchaseCount90d ?? 0;
  const resolveMonetary = (metric: 'LIFETIME' | 'NINETY_DAYS') => {
    if (metric === 'NINETY_DAYS') {
      return insight?.monetaryValue90dPence ?? stats?.totalSpent90dPence ?? 0;
    }
    return insight?.monetaryValueLifetimePence ?? stats?.totalSpentPence ?? 0;
  };
  const resolveMonetaryTier = (amountPence: number) => {
    if (amountPence >= 25000) return 'HIGH';
    if (amountPence >= 10000) return 'MID';
    return 'LOW';
  };

  return rules.every((rule) => {
    switch (rule.type) {
      case 'HAS_TAG':
        return contact.tags.map((t) => t.toLowerCase()).includes(String(rule.value || '').toLowerCase());
      case 'NOT_TAG':
        return !contact.tags.map((t) => t.toLowerCase()).includes(String(rule.value || '').toLowerCase());
      case 'LAST_PURCHASE_OLDER_THAN': {
        const lastPurchase = resolveLastPurchase();
        if (!lastPurchase) return false;
        const days = Number(rule.days || 0);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return lastPurchase < cutoff;
      }
      case 'PURCHASE_COUNT_90D_AT_LEAST': {
        const count = Number(rule.count || 0);
        return resolvePurchaseCount90d() >= count;
      }
      case 'MONETARY_TIER': {
        const tier = rule.tier || 'LOW';
        const metric = rule.metric || 'LIFETIME';
        const amount = resolveMonetary(metric);
        return resolveMonetaryTier(amount) === tier;
      }
      case 'AVG_TICKETS_PER_ORDER_AT_LEAST': {
        const min = Number(rule.count || 0);
        return (insight?.avgTicketsPerOrder || 0) >= min;
      }
      case 'FAVOURITE_VENUE_ID': {
        const venueId = String(rule.venueId || '');
        if (!venueId) return false;
        if (insight?.favouriteVenueId === venueId) return true;
        return (insight?.topVenueIds || []).includes(venueId);
      }
      case 'PURCHASED_AT_VENUE': {
        const venueId = String(rule.venueId || '');
        if (!venueId) return false;
        if (stats?.venues.has(venueId)) return true;
        return (insight?.topVenueIds || []).includes(venueId);
      }
      case 'FAVOURITE_CATEGORY_CONTAINS': {
        const value = String(rule.value || '').toLowerCase();
        const category = String(insight?.favouriteCategory || '').toLowerCase();
        return category.includes(value);
      }
      case 'FAVOURITE_EVENT_TYPE_CONTAINS': {
        const value = String(rule.value || '').toLowerCase();
        const eventType = String(insight?.favouriteEventType || '').toLowerCase();
        return eventType.includes(value);
      }
      case 'VIEWED_NO_PURCHASE_AFTER': {
        const days = Number(rule.days || 0);
        const lastViewAt = views?.lastViewAt || null;
        if (!lastViewAt) return false;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        if (lastViewAt < cutoff) return false;
        const lastPurchase = resolveLastPurchase();
        return !lastPurchase || lastPurchase < lastViewAt;
      }
      case 'LIFECYCLE_STAGE': {
        const stage = rule.value;
        const newWithinDays = Number(rule.newWithinDays || 30);
        const lapsedAfterDays = Number(rule.lapsedAfterDays || 180);
        const firstPurchase = resolveFirstPurchase();
        const lastPurchase = resolveLastPurchase();
        const now = new Date();
        if (!lastPurchase && stage !== 'LAPSED') return false;
        if (stage === 'NEW') {
          if (!firstPurchase) return false;
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - newWithinDays);
          return firstPurchase >= cutoff;
        }
        if (stage === 'LAPSED') {
          if (!lastPurchase) return true;
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - lapsedAfterDays);
          return lastPurchase < cutoff;
        }
        if (!firstPurchase || !lastPurchase) return false;
        const newCutoff = new Date(now);
        newCutoff.setDate(newCutoff.getDate() - newWithinDays);
        const lapsedCutoff = new Date(now);
        lapsedCutoff.setDate(lapsedCutoff.getDate() - lapsedAfterDays);
        return firstPurchase < newCutoff && lastPurchase >= lapsedCutoff;
      }
      case 'CONSENT_STATUS_IS': {
        return String(contact.consentStatus || '').toUpperCase() === String(rule.value || '').toUpperCase();
      }
      case 'PREFERENCE_TOPIC_STATUS': {
        const topicId = String(rule.topicId || '');
        const status = String(rule.status || '').toUpperCase();
        return contact.preferences.some(
          (pref) => pref.topicId === topicId && String(pref.status || '').toUpperCase() === status
        );
      }
      case 'PURCHASED_CATEGORY_CONTAINS': {
        if (!stats) return false;
        const value = String(rule.value || '').toLowerCase();
        for (const cat of stats.categories) {
          if (cat.includes(value)) return true;
        }
        return false;
      }
      case 'TOTAL_SPENT_AT_LEAST': {
        if (!stats && !insight) return false;
        const amount = Number(rule.amount || 0) * 100;
        return resolveMonetary('LIFETIME') >= amount;
      }
      case 'ATTENDED_VENUE': {
        if (!stats && !insight) return false;
        const venueId = String(rule.venueId || '');
        if (stats?.venues.has(venueId)) return true;
        return (insight?.topVenueIds || []).includes(venueId);
      }
      default:
        return true;
    }
  });
}

export async function estimateSegment(tenantId: string, rulesInput: unknown) {
  const contacts = await evaluateSegmentContacts(tenantId, rulesInput);
  return {
    count: contacts.length,
    sample: contacts.slice(0, 20).map((c) => c.email),
  };
}
