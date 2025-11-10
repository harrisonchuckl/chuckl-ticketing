// backend/src/routes/sitemap.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * XML sitemap for public pages
 * GET /public/sitemap.xml
 *
 * Requires SITE_BASE_URL for absolute URLs (recommended).
 * Falls back to relative paths if not provided (less ideal for SEO).
 */
router.get('/sitemap.xml', async (_req, res) => {
  const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');

  try {
    // Grab upcoming + recent shows (you can widen/narrow as you like)
    const shows = await prisma.show.findMany({
      select: { id: true, date: true },
      orderBy: { date: 'desc' },
      take: 2000, // safety cap
    });

    // Helpers
    const url = (path: string) => (base ? `${base}${path}` : path);
    const toISO = (d?: Date | null) => (d ? new Date(d).toISOString() : undefined);

    const pages: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
      { loc: url('/public/events'), changefreq: 'daily', priority: '0.8' },
      // You can add the venue index here later (e.g., /public/venues)
    ];

    for (const s of shows) {
      pages.push({
        loc: url(`/public/event/${s.id}`),
        lastmod: toISO(s.date), // use event date as a reasonable lastmod
        changefreq: 'weekly',
        priority: '0.6',
      });
    }

    // Emit XML
    res.type('application/xml').send(renderSitemap(pages));
  } catch (err) {
    console.error('sitemap error', err);
    res.status(500).send('<!-- sitemap error -->');
  }
});

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSitemap(items: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }>) {
  const urls = items
    .map((i) => {
      const parts = [
        `<loc>${escapeXml(i.loc)}</loc>`,
        i.lastmod ? `<lastmod>${escapeXml(i.lastmod)}</lastmod>` : '',
        i.changefreq ? `<changefreq>${escapeXml(i.changefreq)}</changefreq>` : '',
        i.priority ? `<priority>${escapeXml(i.priority)}</priority>` : '',
      ].filter(Boolean);
      return `<url>\n  ${parts.join('\n  ')}\n</url>`;
    })
    .join('\n');

  // Note: If you later add images, consider the image sitemap namespace.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export default router;
