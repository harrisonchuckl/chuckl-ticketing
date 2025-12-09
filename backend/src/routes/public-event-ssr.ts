// backend/src/routes/public-event-ssr.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// --- formatting helpers ---
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

    if (!show) return res.status(404).send('Event ID not found');

    // Safe status check
    // @ts-ignore
    const status = (show as any).status as string;
    
    if (status !== 'LIVE' && status !== 'live') {
       return res.status(404).send(`Event is not LIVE (Status: ${status})`);
    }

    const venue = (show.venue || {}) as any;
    const ticketTypes = (show.ticketTypes || []) as any[];

    // Date Logic
    const dateObj = show.date ? new Date(show.date) : null;
    const whenISO = dateObj ? dateObj.toISOString() : undefined;
    
    // Formatting
    const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
    const dayNum = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric' }) : '';
    const monthName = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'long' }) : '';
    const yearNum = dateObj ? dateObj.toLocaleDateString('en-GB', { year: 'numeric' }) : '';
    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    
    const prettyDate = `${dayName} ${dayNum} ${monthName} ${yearNum}`;

    const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
    const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

    const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
    const poster = show.imageUrl || '';
    const desc = cleanDesc(show.description) || `Live event at ${venueLine}`;

    // Price Logic
    const cheapest = ticketTypes[0];
    const fromPrice = cheapest ? pFmt(cheapest.pricePence) : undefined;

    // Schema.org
    const offers = ticketTypes.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: pDec(t.pricePence),
      priceCurrency: 'GBP',
      availability: (t.available === null || t.available > 0) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut'
    }));

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
      offers,
      url: canonical,
    };

    const mapQuery = encodeURIComponent([venue.name, venue.address, venue.city, venue.postcode].filter(Boolean).join(', '));
    const mapLink = `https://maps.google.com/maps?q=${mapQuery}`;

    // --- RENDER HTML ---
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(show.title)} | Tickets</title>
  <meta name="description" content="${escAttr(desc)}" />
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800;900&display=swap" rel="stylesheet">

  <script type="application/ld+json">${escJSON(jsonLd)}</script>

  <style>
    :root {
      /* Refined Palette based on 'The Dukes' */
      --bg-page: #F3F4F6;
      --bg-surface: #FFFFFF;
      
      --primary: #0F172A; /* Slate 900 */
      --primary-hover: #1E293B;
      
      --brand: #E11D48; /* Vibrant Theatre Red */
      --brand-hover: #BE123C;
      
      --text-main: #111827;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      
      --radius-sm: 6px;
      --radius-md: 12px;
      --radius-lg: 16px;
      
      --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, .font-heading {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      line-height: 1.1;
      margin: 0;
    }

    a { color: inherit; text-decoration: none; transition: opacity 0.2s; }
    a:hover { opacity: 0.8; }

    /* --- HERO SECTION (Sharp, not blurred) --- */
    .hero {
      position: relative;
      background: var(--primary);
      color: white;
      min-height: 65vh; /* Taller, more dramatic */
      display: flex;
      flex-direction: column;
      justify-content: flex-end; /* Align content to bottom */
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background-image: url('${escAttr(poster)}');
      background-size: cover;
      background-position: center top;
      opacity: 0.9; /* SHARP image */
      transform: scale(1.02); /* Subtle zoom */
    }
    
    /* Complex Gradient Mask to make text readable */
    .hero-overlay {
      position: absolute;
      inset: 0;
      /* Left is dark (for text), Right is transparent (for image), Bottom is dark (for fade) */
      background: radial-gradient(circle at 70% 30%, transparent 20%, rgba(15,23,42,0.8) 70%),
                  linear-gradient(to right, rgba(15,23,42,1) 0%, rgba(15,23,42,0.8) 40%, rgba(15,23,42,0.1) 100%),
                  linear-gradient(to top, rgba(15,23,42,1) 0%, transparent 50%);
    }

    .hero-top-nav {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: 24px;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .breadcrumbs {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
      display: flex;
      gap: 8px;
    }
    .breadcrumbs span { opacity: 0.5; }

    .hero-content {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px 80px; /* Extra bottom padding to clear overlap */
      display: grid;
      gap: 20px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #fff;
      width: fit-content;
    }
    .status-dot { width: 8px; height: 8px; background: #10B981; border-radius: 50%; box-shadow: 0 0 8px #10B981; }

    .hero-title {
      font-size: clamp(2.5rem, 6vw, 5rem); /* Massive, cinematic text */
      font-weight: 800;
      line-height: 0.95;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      max-width: 800px;
      text-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-top: 16px;
      font-size: 1.1rem;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
    }
    .hero-meta-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .hero-meta-icon {
      color: var(--brand); /* Brand accent color for icons */
    }

    /* --- LAYOUT CONTAINER --- */
    .layout {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 80px;
      display: grid;
      gap: 48px;
      position: relative;
      z-index: 20;
    }

    @media (min-width: 960px) {
      .layout {
        grid-template-columns: 1fr 380px; /* Content | Sticky Booking */
        margin-top: -60px; /* Overlap effect */
      }
    }

    /* --- CONTENT COLUMN --- */
    .content-area {
      background: transparent;
      padding-top: 20px;
    }

    .section-label {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 16px;
      display: block;
      border-left: 3px solid var(--brand);
      padding-left: 12px;
    }

    .rich-text {
      font-size: 1.15rem;
      line-height: 1.7;
      color: #334155;
      margin-bottom: 48px;
    }
    .rich-text p { margin-bottom: 1.5em; }

    /* Gallery Grid (Placeholder) */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 48px;
    }
    .gallery-item {
      aspect-ratio: 16/9;
      background: #E2E8F0;
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .gallery-img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform 0.5s;
    }
    .gallery-item:hover .gallery-img { transform: scale(1.05); }

    /* Venue Card */
    .venue-card {
      background: white;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-card);
    }
    .venue-map-header {
      height: 120px;
      background: #CBD5E1;
      position: relative;
      background-image: url('https://maps.googleapis.com/maps/api/staticmap?center=${escAttr(venue.postcode)}&zoom=14&size=600x300&key=YOUR_API_KEY_HERE'); /* Optional */
      background-size: cover;
    }
    .venue-details { padding: 24px; }
    .venue-name { font-size: 1.4rem; margin-bottom: 8px; font-family: 'Outfit', sans-serif; }
    .venue-address { color: var(--text-muted); margin-bottom: 16px; }
    .btn-outline {
      display: inline-block;
      padding: 8px 16px;
      border: 2px solid var(--border);
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); background: #F8FAFC; }

    /* --- BOOKING COLUMN --- */
    .booking-area {
      position: relative;
    }

    .booking-widget {
      position: sticky;
      top: 24px;
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-float);
      border: 1px solid rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .widget-header {
      padding: 24px;
      border-bottom: 1px solid var(--border);
      background: #ffffff;
    }
    
    .widget-title { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
    .widget-subtitle { font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;}

    .ticket-list {
      padding: 8px;
    }

    .ticket-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding: 16px;
      border-radius: var(--radius-sm);
      transition: background 0.2s;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
    .ticket-row:hover { background: #F8FAFC; }

    .t-main { display: flex; flex-direction: column; }
    .t-name { font-weight: 700; color: var(--primary); font-size: 1rem; }
    .t-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }
    
    .t-action { text-align: right; }
    .t-price { font-weight: 700; color: var(--primary); font-size: 1.1rem; display: block; margin-bottom: 4px;}
    
    .btn-buy {
      background: var(--brand);
      color: white;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: background 0.2s;
    }
    .ticket-row:hover .btn-buy { background: var(--brand-hover); }
    
    .btn-sold {
      background: #F1F5F9; color: #94A3B8; cursor: not-allowed;
      font-size: 0.75rem; font-weight: 700; padding: 6px 10px; border-radius: 6px;
    }

    .widget-footer {
      background: #F8FAFC;
      padding: 16px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* --- MOBILE FOOTER --- */
    .mobile-bar {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: white;
      padding: 16px 20px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      z-index: 100;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
    }
    .mob-price { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .mob-val { font-size: 1.2rem; font-weight: 800; color: var(--primary); }
    
    .btn-mob-cta {
      background: var(--brand);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 1rem;
      box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
    }

    @media (max-width: 960px) {
      .hero { padding-bottom: 40px; justify-content: center; }
      .hero-title { font-size: 2.8rem; text-align: left; }
      .layout { display: block; margin-top: 0; }
      .booking-area { display: none; } /* Hide desktop booking on mobile */
      .mobile-bar { display: flex; } /* Show mobile bar */
      .content-col { padding-top: 0; }
      /* Reveal booking on anchor click if needed, or just redirect to checkout */
    }
  </style>
</head>
<body>

  <header class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>
    
    <div class="hero-top-nav">
      <div class="breadcrumbs">
        <span style="opacity:1">Home</span>
        <span>/</span>
        <span style="opacity:1">Events</span>
        <span>/</span>
        <span style="color:var(--brand); opacity:1;">${esc(show.title)}</span>
      </div>
    </div>

    <div class="hero-content">
      <div class="status-badge">
        <span class="status-dot"></span> Live Event
      </div>
      
      <h1 class="hero-title">${esc(show.title)}</h1>
      
      <div class="hero-meta">
        <div class="hero-meta-item">
          <span class="hero-meta-icon">📅</span>
          <span>${esc(prettyDate)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-icon">📍</span>
          <span>${esc(venue.name)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-icon">⏰</span>
          <span>${esc(timeStr)}</span>
        </div>
      </div>
    </div>
  </header>

  <div class="layout">
    
    <div class="content-area">
      <span class="section-label">Overview</span>
      <div class="rich-text">
        ${show.description ? show.description.replace(/\n/g, '<br/>') : '<p>Join us for an exciting event. Full details coming soon.</p>'}
      </div>

      ${poster ? `
      <span class="section-label">Gallery</span>
      <div class="gallery-grid">
        <div class="gallery-item"><img src="${escAttr(poster)}" class="gallery-img" alt="Gallery 1"></div>
        <div class="gallery-item"><img src="${escAttr(poster)}" class="gallery-img" alt="Gallery 2" style="filter:hue-rotate(20deg);"></div>
      </div>
      ` : ''}

      <span class="section-label">Location</span>
      <div class="venue-card">
        <div class="venue-map-header"></div>
        <div class="venue-details">
          <h3 class="venue-name">${esc(venue.name)}</h3>
          <p class="venue-address">${esc(fullAddress)}</p>
          <a href="${escAttr(mapLink)}" target="_blank" class="btn-outline">Open in Maps ↗</a>
        </div>
      </div>
    </div>

    <div class="booking-area" id="tickets">
      <div class="booking-widget">
        <div class="widget-header">
          <div class="widget-title">Select Tickets</div>
          <div class="widget-subtitle">${esc(dayName)}, ${esc(fullDate)} at ${esc(timeStr)}</div>
        </div>

        <div class="ticket-list">
          ${ticketTypes.length ? ticketTypes.map(t => {
             const avail = (t.available === null || t.available > 0);
             return `
             <a href="${avail ? `/checkout?showId=${encodeURIComponent(show.id)}&ticketId=${t.id}` : '#'}" class="ticket-row" ${!avail ? 'style="pointer-events:none; opacity:0.6;"' : ''}>
               <div class="t-main">
                 <div class="t-name">${esc(t.name)}</div>
                 <div class="t-desc">${avail ? 'Available' : 'Sold Out'}</div>
               </div>
               <div class="t-action">
                 <span class="t-price">${esc(pFmt(t.pricePence))}</span>
                 <span class="${avail ? 'btn-buy' : 'btn-sold'}">${avail ? 'Add' : 'Sold Out'}</span>
               </div>
             </a>
             `;
          }).join('') : '<div style="padding:20px; text-align:center; font-size:0.9rem; color:var(--text-muted);">Tickets coming soon</div>'}
        </div>

        <div class="widget-footer">
          🔒 Secure checkout powered by Chuckl.
        </div>
      </div>
    </div>

  </div>

  <div class="mobile-bar">
    <div>
      <div class="mob-price">From</div>
      <div class="mob-val">${fromPrice ? esc(fromPrice) : '£0.00'}</div>
    </div>
    <a href="/checkout?showId=${encodeURIComponent(show.id)}" class="btn-mob-cta">Get Tickets</a>
  </div>

</body>
</html>`);
  } catch (err: any) {
    console.error('[public-event-ssr] Error:', err);
    res.status(500).send('Server Error');
  }
});

export default router;
