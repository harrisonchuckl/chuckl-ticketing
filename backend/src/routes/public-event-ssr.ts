// backend/src/routes/public-event-ssr.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function pFmt(p: number | null | undefined) {
  return '£' + (Number(p || 0) / 100).toFixed(2);
}
function pDec(p: number | null | undefined) {
  return (Number(p || 0) / 100).toFixed(2);
}
function cleanDesc(s: string | null | undefined) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().slice(0, 300);
}
function esc(s: any) {
  return String(s ?? '').replace(/[<>&]/g, c => ({'<':'<','>':'>','&':'&'}[c] as string));
}
function escAttr(s: any) {
  return esc(s).replace(/"/g,'"');
}
function escJSON(obj: any) {
  return JSON.stringify(obj).replace(/</g,'\\u003c');
}

router.get('/event/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');

  if (!id) return res.status(404).send('Not found');

  try {
    const show = await prisma.show.findFirst({
      where: { id },
      include: {
        venue: {
          select: { name: true, address: true, city: true, postcode: true },
        },
        ticketTypes: {
          select: { id: true, name: true, pricePence: true, available: true },
          orderBy: { pricePence: 'asc' },
        },
      },
    });

    if (!show) {
       return res.status(404).send('Event ID not found');
    }

    // @ts-ignore
    const status = show['status'];
    if (status !== 'LIVE' && status !== 'live') {
       return res.status(404).send(`Event is not LIVE (Status: ${status})`);
    }

    const venue = (show.venue || {}) as any;
    const ticketTypes = (show.ticketTypes || []) as any[];

    // Date Logic
    const dateObj = show.date ? new Date(show.date) : null;
    const whenISO = dateObj ? dateObj.toISOString() : undefined;
    
    // Nice formats
    const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
    const fullDate = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

    const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
    const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

    const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
    const poster = show.imageUrl || '';
    const desc = cleanDesc(show.description) || `Live event at ${venueLine}`;

    // Map URL
    const mapQuery = encodeURIComponent(fullAddress || venueLine);
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    // JSON-LD for SEO
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: show.title,
      description: desc,
      startDate: whenISO,
      image: poster ? [poster] : undefined,
      location: {
        '@type': 'Place',
        name: venue.name || 'Venue',
        address: venue.address
      },
      offers: ticketTypes.map((t) => ({
        '@type': 'Offer',
        name: t.name,
        price: pDec(t.pricePence),
        priceCurrency: 'GBP',
        availability: (t.available === null || t.available > 0) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut'
      }))
    };

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(show.title)} | Tickets</title>
  <meta name="description" content="${escAttr(desc)}" />
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <script type="application/ld+json">${escJSON(jsonLd)}</script>

  <style>
    :root {
      --primary: #111827; /* Dark Navy/Black */
      --accent: #E11D48; /* Brand Red/Pink Accent */
      --bg-page: #F9FAFB;
      --bg-panel: #FFFFFF;
      --text-main: #1F2937;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      --radius: 12px;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      line-height: 1.5;
    }

    /* --- HERO SECTION --- */
    .hero {
      position: relative;
      background-color: var(--primary);
      color: white;
      padding: 40px 20px 80px; /* Extra bottom padding for overlap */
      overflow: hidden;
    }
    
    /* Blurred backdrop effect */
    .hero-bg {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: url('${escAttr(poster)}');
      background-size: cover;
      background-position: center;
      opacity: 0.2;
      filter: blur(20px);
      transform: scale(1.1);
    }
    .hero-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, rgba(17,24,39,0.8), rgba(17,24,39,1));
    }

    .hero-content {
      position: relative;
      max-width: 1100px;
      margin: 0 auto;
      z-index: 2;
      text-align: center;
    }

    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 24px;
      font-size: 1.1rem;
      color: #D1D5DB;
      font-weight: 500;
    }

    .hero-meta span {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* --- MAIN LAYOUT --- */
    .container {
      max-width: 1100px;
      margin: -60px auto 40px; /* Negative margin to pull up over hero */
      padding: 0 20px;
      position: relative;
      z-index: 10;
      display: grid;
      gap: 32px;
    }

    @media (min-width: 900px) {
      .container {
        grid-template-columns: 350px 1fr; /* Sidebar Left, Content Right */
      }
      h1 { font-size: 3.5rem; }
    }

    /* --- SIDEBAR (STICKY POSTER) --- */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .poster-card {
      background: white;
      padding: 8px;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .poster-img {
      width: 100%;
      aspect-ratio: 2/3;
      object-fit: cover;
      border-radius: 8px;
      display: block;
      background: #f3f4f6;
    }

    /* --- MAIN CONTENT PANEL --- */
    .content-panel {
      background: var(--bg-panel);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 32px;
      border: 1px solid var(--border);
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 20px 0;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--bg-page);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* --- TICKET LIST --- */
    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ticket-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: all 0.2s;
    }

    .ticket-card:hover {
      border-color: #9CA3AF;
      background: #F9FAFB;
    }

    .ticket-info h4 {
      margin: 0 0 4px 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .ticket-status {
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 8px; height: 8px;
      background: #10B981; /* Green */
      border-radius: 50%;
    }
    .status-dot.sold-out { background: #EF4444; }

    .ticket-price {
      font-weight: 700;
      font-size: 1.1rem;
      margin-right: 16px;
    }

    .btn-book {
      background: var(--primary);
      color: white;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95rem;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .btn-book:hover {
      background: #374151;
    }
    .btn-disabled {
      background: #E5E7EB;
      color: #9CA3AF;
      cursor: not-allowed;
    }

    /* --- DESCRIPTION TEXT --- */
    .description {
      font-size: 1.05rem;
      color: #374151;
      line-height: 1.7;
    }
    .description p { margin-bottom: 1.5em; }

    /* --- INFO GRID --- */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
      background: #F3F4F6;
      padding: 20px;
      border-radius: 8px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 4px;
      font-weight: 600;
    }
    .info-val {
      font-weight: 600;
      color: var(--primary);
    }

    /* --- MOBILE STICKY FOOTER (if needed) --- */
    @media (max-width: 600px) {
      .hero { padding-bottom: 40px; }
      .container { grid-template-columns: 1fr; margin-top: 0; }
      .poster-card { display: none; } /* Hide poster in sidebar on mobile, show in hero instead? */
      h1 { font-size: 2rem; }
    }
  </style>
</head>
<body>

  <header class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>
    
    <div class="hero-content">
      <div class="badge">Live Event</div>
      <h1>${esc(show.title)}</h1>
      
      <div class="hero-meta">
        <span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          ${esc(dayName)}, ${esc(fullDate)}
        </span>
        <span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${esc(timeStr)}
        </span>
        <span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          ${esc(venue.name)}
        </span>
      </div>
    </div>
  </header>

  <div class="container">
    
    <aside class="sidebar">
      <div class="poster-card">
        ${poster 
          ? `<img class="poster-img" src="${escAttr(poster)}" alt="${escAttr(show.title)}" />`
          : `<div class="poster-img" style="display:flex;align-items:center;justify-content:center;color:#ccc">No Image</div>`
        }
      </div>
      
      <a href="${escAttr(mapLink)}" target="_blank" style="display:block; text-align:center; padding:12px; background:white; border-radius:8px; border:1px solid var(--border); text-decoration:none; color:var(--text-main); font-weight:500; font-size:0.9rem;">
        📍 View Venue Map
      </a>
    </aside>

    <main class="content-panel">
      
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Date</span>
          <span class="info-val">${esc(fullDate)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Time</span>
          <span class="info-val">${esc(timeStr)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Venue</span>
          <span class="info-val">${esc(venue.city || 'TBC')}</span>
        </div>
      </div>

      <div class="section-title">About the Event</div>
      <div class="description">
        ${show.description ? show.description.replace(/\n/g, '<br/>') : '<p>No description available.</p>'}
      </div>

      <div style="margin: 40px 0; border-top: 1px solid var(--border);"></div>

      <div class="section-title">
        <span>Select Tickets</span>
      </div>

      ${ticketTypes.length ? `
        <div class="ticket-list">
          ${ticketTypes.map((t) => {
            const avail = typeof t.available === 'number' ? (t.available > 0) : true;
            return `
            <div class="ticket-card">
              <div class="ticket-info">
                <h4>${esc(t.name)}</h4>
                <div class="ticket-status">
                  <span class="status-dot ${avail ? '' : 'sold-out'}"></span>
                  ${avail ? 'Available' : 'Sold Out'}
                </div>
              </div>
              <div style="display:flex; align-items:center;">
                <div class="ticket-price">${esc(pFmt(t.pricePence))}</div>
                ${avail 
                  ? `<a class="btn-book" href="/checkout?showId=${encodeURIComponent(show.id)}&ticketId=${t.id}">Book</a>`
                  : `<span class="btn-book btn-disabled">Sold Out</span>`
                }
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
        <div style="padding:20px; text-align:center; color:var(--text-muted); background:#F3F4F6; border-radius:8px;">
          Tickets will be available soon.
        </div>
      `}

    </main>
  </div>

</body>
</html>`);
  } catch (err: any) {
    console.error('[public-event-ssr] Error:', err);
    res.status(500).send('Server Error');
  }
});

export default router;
