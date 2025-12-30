import prisma from '../../lib/prisma.js';
import { OrderStatus } from '@prisma/client';

export type SegmentRule =
  | { type: 'HAS_TAG'; value: string }
  | { type: 'NOT_TAG'; value: string }
  | { type: 'LAST_PURCHASE_OLDER_THAN'; days: number }
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
};

export type SegmentOrderStats = {
  lastPurchase: Date | null;
  totalSpentPence: number;
  categories: Set<string>;
  venues: Set<string>;
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
      consents: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
  });

  const contactRecords = contacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    consentStatus: contact.consents[0]?.status || null,
    tags: contact.tags.map((t) => t.tag.name),
  }));

  const needsOrderData = rules.some((rule) =>
    ['LAST_PURCHASE_OLDER_THAN', 'PURCHASED_CATEGORY_CONTAINS', 'TOTAL_SPENT_AT_LEAST', 'ATTENDED_VENUE'].includes(
      rule.type
    )
  );

  const orderStats = new Map<
    string,
    { lastPurchase: Date | null; totalSpentPence: number; categories: Set<string>; venues: Set<string> }
  >();

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
        show: { select: { eventCategory: true, tags: true, venueId: true } },
      },
    });

    for (const order of orders) {
      const email = String(order.email || '').toLowerCase();
      if (!email) continue;
      const existing = orderStats.get(email) || {
        lastPurchase: null,
        totalSpentPence: 0,
        categories: new Set<string>(),
        venues: new Set<string>(),
      };
      existing.totalSpentPence += Number(order.amountPence || 0);
      if (!existing.lastPurchase || order.createdAt > existing.lastPurchase) {
        existing.lastPurchase = order.createdAt;
      }
      if (order.show?.eventCategory) {
        existing.categories.add(String(order.show.eventCategory).toLowerCase());
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
    const stats = orderStats.get(contact.email) || null;
    return matchesSegmentRules(contact, rules, stats);
  };

  return contactRecords.filter(matches);
}

export function matchesSegmentRules(
  contact: SegmentContact,
  rules: SegmentRule[],
  stats: SegmentOrderStats | null
) {
  return rules.every((rule) => {
    switch (rule.type) {
      case 'HAS_TAG':
        return contact.tags.map((t) => t.toLowerCase()).includes(String(rule.value || '').toLowerCase());
      case 'NOT_TAG':
        return !contact.tags.map((t) => t.toLowerCase()).includes(String(rule.value || '').toLowerCase());
      case 'LAST_PURCHASE_OLDER_THAN': {
        if (!stats?.lastPurchase) return false;
        const days = Number(rule.days || 0);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return stats.lastPurchase < cutoff;
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
        if (!stats) return false;
        const amount = Number(rule.amount || 0) * 100;
        return stats.totalSpentPence >= amount;
      }
      case 'ATTENDED_VENUE': {
        if (!stats) return false;
        return stats.venues.has(String(rule.venueId || ''));
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
