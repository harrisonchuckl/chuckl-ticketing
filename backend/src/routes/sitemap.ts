// backend/src/routes/sitemap.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * XML sitemap for public events.
 * URL: /public/sitemap.xml
 *
 * Notes:
 * - Uses only fields that exist in your Show model.
 * - Falls back to today's date for <lastmod>.
 * - Event URL pattern: /public/event/:id
 */
router.get('/sitemap.xml', async (_req, res) => {
  try {
    const shows = await prisma.show.findMany({
      where: {
        date: { gte: new Date() }, // upcoming
      },
      select: {
        id: true,
        title: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    const base = inferBaseUrlFromHeaders(_req.headers) || '';
    const urls = shows.map((s) => {
      const loc = `${base}/public/event/${encodeURIComponent(s.id)}`;
      const lastmod = (s.date ?? new Date()).toISOString().split('T')[0];
      return { loc, lastmod };
    });

    const xml = buildSitemap(urls);
    res.type('application/xml').send(xml);
  } catch (e) {
    // If anything goes wrong, return a minimal sitemap to avoid 500s in crawlers
    const xml = buildSitemap([]);
    res.type('application/xml').status(200).send(xml);
  }
});

function buildSitemap(items: { loc: string; lastmod: string }[]) {
  const body =
    items
      .map(
        (u) =>
          `<url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
      )
      .join('') || '';
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    body +
    `</urlset>`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Tries to build absolute base URL from proxy headers (Railway / reverse proxy)
function inferBaseUrlFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const proto =
    (headers['x-forwarded-proto'] as string) ||
    (headers['x-forwarded-protocol'] as string) ||
    'https';
  const host = (headers['x-forwarded-host'] as string) || (headers['host'] as string);
  if (!host) return null;
  return `${proto}://${host}`;
}

export default router;
