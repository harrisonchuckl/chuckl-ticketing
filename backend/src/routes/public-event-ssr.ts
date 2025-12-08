// backend/src/routes/public-event-ssr.ts
import { Router } from 'express';
import { ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * Server-rendered Event Page
 * GET /public/event/:id
 *
 * Features:
 * - SEO meta (title/description/og/twitter)
 * - JSON-LD (Event + Offer)
 * - Ticket type list (links to /checkout?showId=...)
 * - Venue block with map embed (no API key needed)
 */
router.get('/event/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');
  if (!id) return res.status(404).send('Not found');

  try {
    const show = await prisma.show.findFirst({
      where: { id, OR: [{ status: ShowStatus.LIVE }, { status: null }] },
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        imageUrl: true, // optional field in your schema (ok if present)
        venue: {
          select: {
            name: true,
            address: true,
            city: true,
            postcode: true,
          },
        },
        ticketTypes: {
          select: { id: true, name: true, pricePence: true, available: true },
          orderBy: { pricePence: 'asc' },
        },
      },
    });

    if (!show) return res.status(404).send('Event not found');

    // Derived
    const whenISO = show.date ? new Date(show.date).toISOString() : undefined;
    const whenHuman = show.date ? new Date(show.date).toLocaleString() : '';
    const venueLine = [
      show.venue?.name,
      [show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' · ');

    const cheapest = (show.ticketTypes || [])[0];
    const fromPrice = cheapest ? pFmt(cheapest.pricePence) : undefined;

    const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
    const poster = show.imageUrl || ''; // optional
    const desc = cleanDesc(show.description) || `Stand-up comedy: ${show.title} — ${venueLine || 'Live show'}`;

    // JSON-LD
    const offers = (show.ticketTypes || []).map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: pDec(t.pricePence),
      priceCurrency: 'GBP',
      availability: t.available && t.available > 0 ? 'http://schema.org/InStock' : 'http://schema.org/LimitedAvailability',
      url: (base ? `${base}` : '') + `/checkout?showId=${encodeURIComponent(show.id)}`,
    }));

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: show.title,
      description: desc,
      startDate: whenISO,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: poster ? [poster] : undefined,
      location: {
        '@type': 'Place',
        name: show.venue?.name || 'Venue',
        address: {
          '@type': 'PostalAddress',
          streetAddress: show.venue?.address || '',
          addressLocality: show.venue?.city || '',
          postalCode: show.venue?.postcode || '',
          addressCountry: 'GB',
        },
      },
      offers,
      url: canonical,
    };

    // Simple Google Maps embed using query (no API key)
    const mapQuery = encodeURIComponent(
      [show.venue?.name, show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', ')
    );
    const mapEmbed = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

    // Render HTML
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <title>${esc(show.title)} – Comedy Tickets</title>
  <link rel="canonical" href="${escAttr(canonical)}" />

  <meta name="description" content="${escAttr(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escAttr(show.title)}" />
  <meta property="og:description" content="${escAttr(desc)}" />
  <meta property="og:url" content="${escAttr(canonical)}" />
  ${poster ? `<meta property="og:image" content="${escAttr(poster)}" />` : ''}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(show.title)}" />
  <meta name="twitter:description" content="${escAttr(desc)}" />
  ${poster ? `<meta name="twitter:image" content="${escAttr(poster)}" />` : ''}

  <script type="application/ld+json">${escJSON(jsonLd)}</script>

  <style>
    :root{
      --bg:#ffffff; --text:#0f172a; --muted:#475569; --border:#e2e8f0; --brand:#0ea5e9;
    }
    *{box-sizing:border-box}
    body{margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:var(--text); background:var(--bg);}
    header{padding:16px; border-bottom:1px solid var(--border);}
    .wrap{max-width:1100px; margin:0 auto; padding:16px;}
    a{color:inherit}
    .muted{color:var(--muted)}
    .grid{display:grid; gap:16px}
    @media (min-width:900px){ .grid{grid-template-columns: 1fr 1.2fr} }
    .poster{width:100%; aspect-ratio:3/4; object-fit:cover; border:1px solid var(--border); border-radius:12px; background:#f8fafc}
    .panel{border:1px solid var(--border); border-radius:12px; padding:16px; background:#fff}
    .btn{display:inline-block; border:1px solid var(--brand); color:#111; border-radius:10px; padding:10px 14px; text-decoration:none}
    .btn:hover{background:#e6f6fe}
    table{width:100%; border-collapse:collapse; font-size:14px}
    th,td{padding:10px; border-bottom:1px solid var(--border); text-align:left}
    th{background:#f8fafc}
    iframe{width:100%; height:320px; border:0; border-radius:12px}
    .crumbs{font-size:14px; margin-bottom:8px}
    .crumbs a{color:var(--muted); text-decoration:none}
    .crumbs a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <a href="/public/events" aria-label="Back to events">← Back to events</a>
    </div>
  </header>

  <main class="wrap">
    <nav class="crumbs">
      <a href="/public/events">Events</a> / <span>${esc(show.title)}</span>
    </nav>

    <h1 style="margin:0 0 6px 0;">${esc(show.title)}</h1>
    <div class="muted">${esc(whenHuman)}${venueLine ? ' · ' + esc(venueLine) : ''}</div>
    ${fromPrice ? `<div class="muted" style="margin-top:6px;">From ${esc(fromPrice)}</div>` : ''}

    <div class="grid" style="margin-top:16px;">
      <div>
        ${poster ? `<img class="poster" src="${escAttr(poster)}" alt="${escAttr(show.title)} poster" />` : `<div class="poster"></div>`}

        <div class="panel" style="margin-top:16px;">
          <h3 style="margin:0 0 8px 0;">About</h3>
          <div class="muted">${escHtml(show.description || 'A brilliant night of live stand-up comedy.')}</div>
        </div>
      </div>

      <div>
        <section class="panel">
          <h3 style="margin:0 0 8px 0;">Tickets</h3>
          ${
            show.ticketTypes && show.ticketTypes.length
              ? `
              <table>
                <thead><tr><th>Type</th><th>Price</th><th>Availability</th><th></th></tr></thead>
                <tbody>
                  ${show.ticketTypes
                    .map((t) => {
                      const avail = typeof t.available === 'number' ? (t.available > 0 ? `${t.available} left` : 'Limited') : '—';
                      return `<tr>
                        <td>${esc(t.name)}</td>
                        <td>${esc(pFmt(t.pricePence))}</td>
                        <td>${esc(avail)}</td>
                        <td><a class="btn" href="/checkout?showId=${encodeURIComponent(show.id)}">Buy now</a></td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>`
              : `<div class="muted">Tickets will be available soon.</div>`
          }
        </section>

        <section class="panel" style="margin-top:16px;">
          <h3 style="margin:0 0 8px 0;">Venue</h3>
          <div>${esc(show.venue?.name || '')}</div>
          <div class="muted">${esc([show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', '))}</div>
          <div style="height:10px"></div>
          <iframe src="${escAttr(mapEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" aria-label="Map"></iframe>
          <div style="height:10px"></div>
          <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" rel="noopener">Open in Google Maps</a>
        </section>
      </div>
    </div>
  </main>
</body>
</html>`);
  } catch (err) {
    console.error('public event ssr error', err);
    res.status(500).send('Server error');
  }
});

// Helpers
function esc(s: any) { return String(s ?? '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c] as string)); }
function escHtml(s: any) { return esc(s).replace(/\\n/g,'<br/>'); }
function escAttr(s: any) { return esc(s).replace(/"/g,'&quot;'); }
function escJSON(obj: any) { return JSON.stringify(obj).replace(/</g,'\\u003c'); }
function pFmt(p?: number | null) { return '£' + (Number(p || 0) / 100).toFixed(2); }
function pDec(p?: number | null) { return (Number(p || 0) / 100).toFixed(2); }
function cleanDesc(s?: string | null) {
  if (!s) return '';
  return s.replace(/\\s+/g, ' ').trim().slice(0, 300);
}

export default router;
