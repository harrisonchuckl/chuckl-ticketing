// backend/src/routes/sitemap.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /public/sitemap.xml
 * Lists public event pages (and the listing page).
 */
router.get('/sitemap.xml', async (_req, res) => {
  try {
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const now = new Date();

    const shows = await prisma.show.findMany({
      where: { date: { gte: now } },
      select: { id: true, date: true },
      orderBy: { date: 'asc' },
    });

    const urls = [
      urlTag(urlJoin(base, '/public/events'), new Date(), 'daily', '0.6'),
      ...shows.map(s =>
        urlTag(urlJoin(base, `/public/event/${s.id}`), s.date || new Date(), 'weekly', '0.8')
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to generate sitemap');
  }
});

function urlTag(loc: string, lastmod: Date, freq: string, prio: string) {
  const l = escapeXml(loc);
  const d = lastmod.toISOString();
  return `<url><loc>${l}</loc><lastmod>${d}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;
}
function urlJoin(base: string, path: string) {
  if (!base) return path;
  return base.replace(/\/+$/, '') + path;
}
function escapeXml(s: string){ return s.replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]!)); }

export default router;
