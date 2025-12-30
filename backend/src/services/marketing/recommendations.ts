import prisma from '../../lib/prisma.js';

const MIN_RECS = 3;
const MAX_RECS = 6;

function formatShowDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseUrl() {
  return (
    process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000'
  ).replace(/\/+$/, '');
}

export async function buildRecommendedShowsHtml(tenantId: string, email: string): Promise<string | null> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const lastOrder = await prisma.order.findFirst({
    where: {
      status: 'PAID',
      email: normalizedEmail,
      show: { organiserId: tenantId },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      show: {
        select: {
          eventCategory: true,
          venueId: true,
        },
      },
    },
  });

  const category = lastOrder?.show?.eventCategory || null;
  const venueId = lastOrder?.show?.venueId || null;

  const upcoming = await prisma.show.findMany({
    where: {
      organiserId: tenantId,
      status: 'LIVE',
      date: { gte: new Date() },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      eventCategory: true,
      venueId: true,
      venue: { select: { name: true, city: true } },
    },
    take: 40,
  });

  if (!upcoming.length) return null;

  const scored = upcoming
    .map((show) => {
      let score = 0;
      if (category && show.eventCategory && show.eventCategory === category) score += 2;
      if (venueId && show.venueId && show.venueId === venueId) score += 1;
      return { show, score };
    })
    .sort((a, b) => b.score - a.score || a.show.date.getTime() - b.show.date.getTime());

  const picked = scored.slice(0, MAX_RECS).map((item) => item.show);
  if (picked.length < MIN_RECS) {
    const fill = upcoming
      .filter((show) => !picked.find((existing) => existing.id === show.id))
      .slice(0, MIN_RECS - picked.length);
    picked.push(...fill);
  }

  if (!picked.length) return null;

  const cards = picked
    .map((show) => {
      const url = `${baseUrl()}/public/event/${encodeURIComponent(show.id)}`;
      const venueLabel = [show.venue?.name, show.venue?.city].filter(Boolean).join(' • ');
      return `
        <a href="${url}" style="text-decoration:none;color:inherit;display:block;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(show.title || 'Untitled show')}</div>
          <div style="color:#6b7280;font-size:13px;">${escapeHtml(formatShowDate(show.date))}${venueLabel ? ` • ${escapeHtml(venueLabel)}` : ''}</div>
        </a>
      `;
    })
    .join('');

  return `
    <div style="margin-top:20px;">
      <h3 style="margin:0 0 12px 0;font-size:16px;">Recommended shows</h3>
      ${cards}
    </div>
  `;
}
