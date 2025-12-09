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

    // FIX 1: Force status to string to avoid Enum comparison errors
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
    const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
    const dayNum = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric' }) : '';
    const monthName = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'short' }) : '';
    const yearNum = dateObj ? dateObj.toLocaleDateString('en-GB', { year: 'numeric' }) : '';
    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    
    const prettyDate = `${dayName} ${dayNum} ${monthName} ${yearNum}`;

    const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
    const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

    const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
    const poster = show.imageUrl || '';
    const desc = cleanDesc(show.description) || `Live event at ${venueLine}`;

    // FIX 2: Define fromPrice logic (missing in previous version)
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">

  <script type="application/ld+json">${escJSON(jsonLd)}</script>

  <style>
    :root {
      /* Palette inspired by 'The Dukes' & 'Reading Rep' */
      --bg-body: #FAF9F6; /* Theatre Cream */
      --bg-surface: #FFFFFF;
      --primary: #111827; /* Near Black */
      --accent: #E11D48; /* Vibrant Red/Pink for CTAs */
      --accent-hover: #BE123C;
      --text-main: #1F2937;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      
      --radius-sm: 8px;
      --radius-lg: 16px;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-body);
      color: var(--text-main);
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, .font-heading {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      line-height: 1.1;
      margin: 0;
    }

    /* --- HERO --- */
    .hero {
      position: relative;
      background: var(--primary);
      color: white;
      min-height: 70vh; /* Massive immersive hero */
      display: flex;
      align-items: flex-end;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background-image: url('${escAttr(poster)}');
      background-size: cover;
      background-position: center 20%; /* Focus on top-center usually */
      opacity: 0.6;
      transform: scale(1.05);
      filter: blur(8px); /* Artistic blur like Reading Rep */
    }
    
    /* Dramatic gradient overlay */
    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(17,24,39, 1) 0%, rgba(17,24,39, 0.8) 30%, rgba(17,24,39, 0.2) 100%);
    }

    .hero-content {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
      display: grid;
      gap: 24px;
    }

    .tag-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pill {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 6px 12px;
      border-radius: 99px;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .hero-title {
      font-size: clamp(2.5rem, 5vw, 4.5rem); /* Responsive giant text */
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
      max-width: 900px;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      font-size: 1.1rem;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
      margin-top: 8px;
    }
    
    .hero-meta div {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .hero-meta svg { opacity: 0.7; }

    /* --- LAYOUT GRID --- */
    .main-grid {
      display: grid;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 80px;
      gap: 48px;
      position: relative;
      z-index: 20;
    }

    @media (min-width: 900px) {
      .main-grid {
        grid-template-columns: 2fr 1.1fr; /* Content Left, Booking Right */
        margin-top: -60px; /* Overlap the hero slightly */
      }
    }

    /* --- LEFT COLUMN --- */
    .content-col {
      display: flex;
      flex-direction: column;
      gap: 40px;
      padding-top: 20px;
    }

    .rich-text {
      font-size: 1.125rem;
      line-height: 1.75;
      color: #374151;
    }
    .rich-text p { margin-bottom: 1.5em; }

    .venue-block {
      background: white;
      padding: 24px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }
    .venue-map {
      width: 100px;
      height: 100px;
      border-radius: 12px;
      background: #f3f4f6;
      object-fit: cover;
      flex-shrink: 0;
    }

    /* --- RIGHT COLUMN (STICKY BOOKING) --- */
    .booking-col {
      position: relative;
    }

    .booking-card {
      background: var(--bg-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-float);
      border: 1px solid var(--border);
      overflow: hidden;
      position: sticky;
      top: 24px; /* Sticky scroll */
    }

    .booking-header {
      background: var(--primary);
      color: white;
      padding: 20px;
    }
    
    .booking-title { font-size: 1.25rem; }
    .booking-subtitle { font-family: 'Inter', sans-serif; font-size: 0.9rem; opacity: 0.8; margin-top: 4px; }

    .ticket-list {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ticket-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      transition: all 0.2s;
      background: white;
    }

    .ticket-row:hover {
      border-color: #9CA3AF;
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .t-name { font-weight: 700; color: var(--primary); display: block; font-family: 'Outfit', sans-serif; }
    .t-status { font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;}
    .t-price { font-weight: 700; font-size: 1.1rem; color: var(--primary); }

    .btn-add {
      background: var(--primary);
      color: white;
      border: none;
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background 0.2s;
      margin-left: 12px;
      text-decoration: none;
    }
    .btn-add:hover { background: var(--accent); }
    
    .btn-soldout {
      background: #F3F4F6; color: #9CA3AF; cursor: not-allowed;
      font-size: 0.7rem; width: auto; height: auto; padding: 4px 8px; border-radius: 4px;
      font-weight: 700; text-transform: uppercase;
    }

    .checkout-bar {
      padding: 16px;
      border-top: 1px solid var(--border);
      background: #F9FAFB;
      text-align: center;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* --- MOBILE FIXED BOTTOM BAR --- */
    .mobile-cta {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: white;
      padding: 16px 24px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      z-index: 100;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
    }
    
    .mobile-btn {
      background: var(--accent);
      color: white;
      font-weight: 700;
      padding: 12px 32px;
      border-radius: 99px;
      text-decoration: none;
      font-family: 'Outfit', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @media (max-width: 900px) {
      .hero { min-height: auto; padding-bottom: 60px; }
      .hero-title { font-size: 2.5rem; }
      .main-grid { display: block; margin-top: 0; }
      .booking-card { margin-top: 40px; }
      .mobile-cta { display: flex; }
      .booking-col { display: none; } /* Hide sidebar on mobile, show generic CTA instead */
      /* Or keep sidebar but unsticky it. Let's keep it in flow for now */
      .booking-col { display: block; } 
      .booking-card { position: static; }
    }
  </style>
</head>
<body>

  <header class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>
    
    <div class="hero-content">
      <div class="tag-row">
        <span class="pill">Live Event</span>
        <span class="pill">Theatre</span>
      </div>
      
      <h1 class="hero-title">${esc(show.title)}</h1>
      
      <div class="hero-meta">
        <div>
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          ${esc(prettyDate)}
        </div>
        <div>
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${esc(timeStr)}
        </div>
        <div>
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          ${esc(venue.name)}
        </div>
      </div>
    </div>
  </header>

  <div class="main-grid">
    
    <div class="content-col">
      
      <div class="rich-text">
        ${show.description ? show.description.replace(/\n/g, '<br/>') : '<p>Join us for an unforgettable evening. Further details coming soon.</p>'}
      </div>

      <div style="border-top: 1px solid var(--border); margin: 20px 0;"></div>

      <div class="venue-block">
        <div style="background:var(--primary); width:60px; height:60px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; flex-shrink:0;">
           <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
        <div>
          <h3 style="margin-bottom:4px; font-size:1.2rem;">${esc(venue.name)}</h3>
          <p style="color:var(--text-muted); margin:0; font-size:0.95rem;">
            ${esc(fullAddress)}
          </p>
          <a href="${escAttr(mapLink)}" target="_blank" style="display:inline-block; margin-top:8px; color:var(--accent); text-decoration:none; font-weight:600; font-size:0.9rem;">
            Get Directions →
          </a>
        </div>
      </div>

    </div>

    <div class="booking-col" id="booking">
      <div class="booking-card">
        <div class="booking-header">
          <div class="booking-title font-heading">Book Tickets</div>
          <div class="booking-subtitle">${esc(prettyDate)} at ${esc(timeStr)}</div>
        </div>

        <div class="ticket-list">
          ${ticketTypes.length ? ticketTypes.map(t => {
             const avail = (t.available === null || t.available > 0);
             return `
             <div class="ticket-row">
               <div>
                 <span class="t-name">${esc(t.name)}</span>
                 <span class="t-status">${avail ? 'Available' : 'Sold Out'}</span>
               </div>
               <div style="display:flex; align-items:center;">
                 <span class="t-price">${esc(pFmt(t.pricePence))}</span>
                 ${avail 
                   ? `<a href="/checkout?showId=${encodeURIComponent(show.id)}&ticketId=${t.id}" class="btn-add">+</a>`
                   : `<span class="btn-soldout">Sold Out</span>`
                 }
               </div>
             </div>
             `;
          }).join('') : '<div style="text-align:center; padding:20px; color:#666;">Tickets coming soon</div>'}
        </div>

        <div class="checkout-bar">
          Secured by <strong>Chuckl.</strong>
        </div>
      </div>
    </div>

  </div>

  <div class="mobile-cta">
    <div>
      <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Starting from</div>
      <div style="font-size:1.2rem; font-weight:700; color:var(--primary);">${fromPrice ? esc(fromPrice) : '£0.00'}</div>
    </div>
    <a href="#booking" class="mobile-btn">Book Tickets</a>
  </div>

</body>
</html>`);
  } catch (err: any) {
    console.error('[public-event-ssr] Error:', err);
    res.status(500).send('Server Error');
  }
});

export default router;
