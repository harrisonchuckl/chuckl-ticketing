// backend/src/routes/public-meta.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * SEO preview for an event.
 * GET /public/event/:id/preview
 *
 * - Outputs server-rendered <title>, OG/Twitter meta, JSON-LD
 * - Meta-refreshes humans to the SPA URL
 * - Bots get full markup without JS
 *
 * Optional ENV:
 *   SITE_BASE_URL (e.g. https://tickets.example.com)
 */
router.get('/event/:id/preview', async (req, res) => {
  const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');
  const id = String(req.params.id || '');
  if (!id) return res.status(400).send('Missing id');

  try {
    const show = await prisma.show.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        imageUrl: true,
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            postcode: true,
          },
        },
        ticketTypes: {
          select: { pricePence: true, name: true },
          orderBy: { pricePence: 'asc' },
        },
      },
    });

    if (!show) return res.status(404).send('Event not found');

    // Derived bits
    const cheapest = show.ticketTypes?.[0];
    const fromPrice = typeof cheapest?.pricePence === 'number'
      ? `From £${(cheapest.pricePence / 100).toFixed(2)}`
      : null;

    const whenISO = show.date.toISOString();
    const whenHuman = new Date(show.date).toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const venueLine = [show.venue?.name, show.venue?.city].filter(Boolean).join(' — ');
    const addrLine = [show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', ');

    const canonicalPath = `/public/event/${show.id}`;
    const canonicalURL = base ? `${base}${canonicalPath}` : canonicalPath;
    const spaURL = `${canonicalPath}`; // we serve SPA on same path already

    // Compose meta
    const title = [show.title, venueLine].filter(Boolean).join(' | ') || 'Event';
    const descParts = [
      show.description?.replace(/\s+/g, ' ').trim(),
      whenHuman ? `When: ${whenHuman}` : null,
      venueLine ? `Where: ${venueLine}` : null,
      fromPrice ? `${fromPrice} • Book now` : null,
    ].filter(Boolean);
    const description = (descParts.join(' • ') || 'Book tickets now').slice(0, 300);

    // Image — prefer poster, else a simple fallback (solid color PNG)
    const fallbackImg = `${base || ''}/public-fallback.png`;
    const image = show.imageUrl || (base ? fallbackImg : '');

    // JSON-LD (Event Schema)
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: show.title,
      description: show.description || undefined,
      startDate: whenISO,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: show.venue?.name || undefined,
        address: addrLine || undefined,
      },
      image: image ? [image] : undefined,
      offers: cheapest
        ? {
            '@type': 'Offer',
            priceCurrency: 'GBP',
            price: (cheapest.pricePence / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
            url: base ? canonicalURL : undefined,
          }
        : undefined,
      url: base ? canonicalURL : undefined,
    };

    // Render lightweight HTML with meta + refresh to SPA
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeAttr(canonicalURL)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  ${image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : ''}
  <meta property="og:url" content="${escapeAttr(canonicalURL)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeAttr(image)}" />` : ''}

  <!-- JSON-LD -->
  <script type="application/ld+json">${escapeHtml(JSON.stringify(jsonLd))}</script>

  <!-- Humans: forward to SPA -->
  <meta http-equiv="refresh" content="0; url=${escapeAttr(spaURL)}" />
  <style>body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;padding:24px;color:#111}</style>
</head>
<body>
  <p>Redirecting to event… If nothing happens, <a href="${escapeAttr(spaURL)}">click here</a>.</p>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// tiny HTML escapers
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

export default router;
