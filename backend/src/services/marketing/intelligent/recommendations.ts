import { OrderStatus } from '@prisma/client';
import prisma from '../../../lib/prisma.js';

type UpcomingShow = {
  id: string;
  title: string | null;
  date: Date;
  slug: string | null;
  eventCategory: string | null;
  eventType: string | null;
  imageUrl: string | null;
  externalTicketUrl: string | null;
  usesExternalTicketing: boolean;
  venueId: string | null;
  venue: {
    name: string;
    city: string | null;
    county: string | null;
    imageUrl?: string | null;
  } | null;
  organiser: {
    id: string;
    storefrontSlug: string | null;
  } | null;
};

type ContactPurchaseSignals = {
  email: string;
  totalOrders: number;
  purchasedShowIds: string[];
  categories: Record<string, number>;
  eventTypes: Record<string, number>;
  venueCities: Record<string, number>;
  venueCounties: Record<string, number>;
  venueIds: Record<string, number>;
  insight: {
    favouriteVenueId: string | null;
    topVenueIds: string[];
    favouriteCategory: string | null;
    favouriteEventType: string | null;
  } | null;
};

type RankOptions = {
  limit?: number;
};

type RankedShow = {
  showId: string;
  title: string;
  date: Date;
  venueName: string;
  town: string;
  county: string;
  imageUrl: string | null;
  bookingUrl: string;
  reason: string;
};

const LOG_PREFIX = '[marketing:intelligent:recommendations]';
const DEFAULT_HORIZON_DAYS = 90;
const DEFAULT_LIMIT = 6;

function normaliseEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function baseUrl() {
  return (
    process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000'
  ).replace(/\/+$/, '');
}

function resolveBookingUrl(show: UpcomingShow) {
  if (show.usesExternalTicketing && show.externalTicketUrl) {
    return show.externalTicketUrl;
  }
  const slug = show.slug && show.organiser
    ? `/public/${encodeURIComponent(show.organiser.storefrontSlug || show.organiser.id)}/${encodeURIComponent(show.slug)}`
    : null;
  return `${baseUrl()}${slug || `/public/event/${encodeURIComponent(show.id)}`}`;
}

function bump(map: Record<string, number>, key?: string | null, increment = 1) {
  if (!key) return;
  const trimmed = key.trim();
  if (!trimmed) return;
  map[trimmed] = (map[trimmed] || 0) + increment;
}

function topKey(map: Record<string, number>) {
  const entries = Object.entries(map);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0]?.[0] || null;
}

export async function getTenantUpcomingShows(tenantId: string, horizonDays = DEFAULT_HORIZON_DAYS) {
  const now = new Date();
  const horizonMs = Math.max(0, Number(horizonDays) || 0) * 24 * 60 * 60 * 1000;
  const horizonDate = new Date(now.getTime() + horizonMs);

  const shows = await prisma.show.findMany({
    where: {
      organiserId: tenantId,
      status: 'LIVE',
      date: { gte: now, lte: horizonDate },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      eventCategory: true,
      eventType: true,
      imageUrl: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      venueId: true,
      venue: { select: { name: true, city: true, county: true, imageUrl: true } },
      organiser: { select: { id: true, storefrontSlug: true } },
    },
  });

  console.log(`${LOG_PREFIX} getTenantUpcomingShows`, {
    tenantId,
    horizonDays,
    count: shows.length,
  });

  return shows;
}

export async function buildContactPurchaseSignals(tenantId: string, email: string): Promise<ContactPurchaseSignals> {
  const normalizedEmail = normaliseEmail(email);
  if (!normalizedEmail) {
    console.log(`${LOG_PREFIX} buildContactPurchaseSignals missing email`, { tenantId });
    return {
      email: '',
      totalOrders: 0,
      purchasedShowIds: [],
      categories: {},
      eventTypes: {},
      venueCities: {},
      venueCounties: {},
      venueIds: {},
      insight: null,
    };
  }

  const [orders, insight] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        show: { organiserId: tenantId },
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { shippingEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        ],
      },
      select: {
        show: {
          select: {
            id: true,
            eventCategory: true,
            eventType: true,
            venueId: true,
            venue: { select: { city: true, county: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerInsight.findFirst({
      where: { tenantId, email: normalizedEmail },
      select: {
        favouriteVenueId: true,
        topVenueIds: true,
        favouriteCategory: true,
        favouriteEventType: true,
      },
    }),
  ]);

  const categories: Record<string, number> = {};
  const eventTypes: Record<string, number> = {};
  const venueCities: Record<string, number> = {};
  const venueCounties: Record<string, number> = {};
  const venueIds: Record<string, number> = {};
  const purchasedShowIds = new Set<string>();

  for (const order of orders) {
    if (!order.show) continue;
    purchasedShowIds.add(order.show.id);
    bump(categories, order.show.eventCategory);
    bump(eventTypes, order.show.eventType);
    bump(venueIds, order.show.venueId);
    bump(venueCities, order.show.venue?.city);
    bump(venueCounties, order.show.venue?.county);
  }

  const payload: ContactPurchaseSignals = {
    email: normalizedEmail,
    totalOrders: orders.length,
    purchasedShowIds: Array.from(purchasedShowIds),
    categories,
    eventTypes,
    venueCities,
    venueCounties,
    venueIds,
    insight: insight
      ? {
          favouriteVenueId: insight.favouriteVenueId,
          topVenueIds: insight.topVenueIds,
          favouriteCategory: insight.favouriteCategory,
          favouriteEventType: insight.favouriteEventType,
        }
      : null,
  };

  console.log(`${LOG_PREFIX} buildContactPurchaseSignals`, {
    tenantId,
    email: normalizedEmail,
    orders: orders.length,
    categories: Object.keys(categories).length,
    eventTypes: Object.keys(eventTypes).length,
    venueCities: Object.keys(venueCities).length,
    venueCounties: Object.keys(venueCounties).length,
  });

  return payload;
}

export async function rankShowsForContact(
  contact: { tenantId: string; email: string },
  shows: UpcomingShow[],
  options: RankOptions = {}
): Promise<RankedShow[]> {
  const signals = await buildContactPurchaseSignals(contact.tenantId, contact.email);
  const limit = Math.max(1, Math.min(DEFAULT_LIMIT, options.limit || DEFAULT_LIMIT));

  const topCategory = signals.insight?.favouriteCategory || topKey(signals.categories);
  const topEventType = signals.insight?.favouriteEventType || topKey(signals.eventTypes);
  const topVenueId = signals.insight?.favouriteVenueId || topKey(signals.venueIds);
  const topCity = topKey(signals.venueCities);
  const topCounty = topKey(signals.venueCounties);

  const scored = shows.map((show) => {
    let score = 0;
    const reasons: string[] = [];

    if (topCategory && show.eventCategory && show.eventCategory === topCategory) {
      score += 4;
      reasons.push(`Matches your favourite category (${topCategory})`);
    }

    if (topEventType && show.eventType && show.eventType === topEventType) {
      score += 3;
      reasons.push(`Matches your favourite event type (${topEventType})`);
    }

    if (topVenueId && show.venueId && show.venueId === topVenueId) {
      score += 2;
      reasons.push('Hosted at a venue you visit often');
    }

    if (topCity && show.venue?.city && show.venue.city === topCity) {
      score += 2;
      reasons.push(`Near you in ${topCity}`);
    }

    if (topCounty && show.venue?.county && show.venue.county === topCounty) {
      score += 1;
      reasons.push(`In ${topCounty}`);
    }

    if (!reasons.length) {
      reasons.push('Popular upcoming show');
    }

    return { show, score, reason: reasons[0] };
  });

  scored.sort((a, b) => b.score - a.score || a.show.date.getTime() - b.show.date.getTime());

  const ranked = scored.slice(0, limit).map(({ show, reason }) => ({
    showId: show.id,
    title: show.title || 'Untitled show',
    date: show.date,
    venueName: show.venue?.name || 'Venue TBA',
    town: show.venue?.city || '',
    county: show.venue?.county || '',
    imageUrl: show.imageUrl || show.venue?.imageUrl || null,
    bookingUrl: resolveBookingUrl(show),
    reason,
  }));

  console.log(`${LOG_PREFIX} rankShowsForContact`, {
    tenantId: contact.tenantId,
    email: normaliseEmail(contact.email),
    shows: shows.length,
    ranked: ranked.length,
  });

  return ranked;
}
