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

router.get('/checkout/success', async (req, res) => {
  const orderId = String(req.query.orderId || '').trim();
  const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');

  if (!orderId) return res.status(400).send('Missing orderId');

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        show: {
          include: {
            venue: { select: { name: true, address: true, city: true, postcode: true } },
          },
        },
      },
    });

    if (!order || !order.show) return res.status(404).send('Order not found');

    const show: any = order.show as any;
    const venue: any = (show.venue || {}) as any;

    const dateObj = show.date ? new Date(show.date) : null;
    const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
    const fullDate = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

    const title = String(show.title || 'Your event');
    const poster = show.imageUrl || '';
    const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
    const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

    const canonical = base ? `${base}/public/checkout/success?orderId=${encodeURIComponent(orderId)}` : `/public/checkout/success?orderId=${encodeURIComponent(orderId)}`;

    const amountPounds = (Number((order as any).amountPence || 0) / 100).toFixed(2);
    const qty = Number((order as any).quantity || 0);
    const status = String((order as any).status || '');

    // If webhook hasn’t flipped it to PAID yet, refresh a few times.
    const shouldRefresh = status !== 'PAID';

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Payment successful | ${esc(title)}</title>
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="${escAttr(canonical)}" />

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800;900&display=swap" rel="stylesheet">

  ${shouldRefresh ? `<meta http-equiv="refresh" content="3">` : ''}

  <style>
    :root {
      --bg-page: #F3F4F6;
      --bg-surface: #FFFFFF;
      --primary: #0F172A;
      --brand: #0056D2;
      --brand-hover: #0044A8;
      --text-main: #111827;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      --radius-lg: 16px;
      --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family:'Inter', sans-serif; background: var(--bg-page); color: var(--text-main); }
    h1,h2,.font-heading { font-family:'Outfit', sans-serif; margin:0; line-height:1.1; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px 16px 70px; }
    .hero {
      background: var(--primary);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-float);
      border: 1px solid rgba(255,255,255,0.06);
      position: relative;
      min-height: 280px;
      display:flex;
      align-items:flex-end;
    }
    .hero-bg {
      position:absolute; inset:0;
      background-image: url('${escAttr(poster)}');
      background-size: cover;
      background-position: center;
      opacity: 0.9;
    }
    .hero-overlay {
      position:absolute; inset:0;
      background:
        linear-gradient(to right, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.55) 55%, rgba(15,23,42,0.25) 100%),
        linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.3) 55%, rgba(15,23,42,0.1) 100%);
    }
    .hero-inner { position:relative; z-index:2; padding: 26px; color:#fff; width:100%; }
    .pill {
      display:inline-block; padding: 6px 10px; border-radius: 999px;
      background: rgba(0,86,210,0.18); border: 1px solid rgba(0,86,210,0.35);
      color: rgba(255,255,255,0.9); font-weight:700; font-size: 12px; letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .title { margin-top: 10px; font-size: clamp(2rem, 3vw, 2.7rem); font-weight: 900; text-transform: uppercase; }
    .sub { margin-top: 10px; color: rgba(255,255,255,0.9); font-weight: 600; }
    .grid { display:grid; gap: 16px; margin-top: 18px; grid-template-columns: 1fr; }
    @media (min-width: 900px) { .grid { grid-template-columns: 1.2fr 0.8fr; } }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-float);
      padding: 18px;
    }
    .kv { margin-top: 6px; }
    .kv div { margin: 8px 0; color: var(--text-muted); }
    .kv strong { color: var(--text-main); }
    .warn { margin-top: 10px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 12px; border-radius: 10px; font-weight: 600; }
    .btns { display:flex; flex-wrap:wrap; gap: 10px; margin-top: 12px; }
    a.btn {
      display:inline-block; padding: 10px 14px; border-radius: 10px; font-weight: 800; text-decoration:none;
      text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.85rem;
    }
    a.primary { background: var(--brand); color: #fff; }
    a.primary:hover { background: var(--brand-hover); }
    a.ghost { background: #fff; border: 2px solid var(--border); color: var(--primary); }
    a.ghost:hover { border-color: var(--brand); color: var(--brand); }
    .small { margin-top: 10px; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        <div class="pill">${status === 'PAID' ? 'Payment confirmed' : 'Payment received'}</div>
        <h1 class="title">You’re booked in!</h1>
        <div class="sub">Order reference: <strong>${esc(orderId)}</strong></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2 class="font-heading" style="font-size:1.25rem;">Your tickets</h2>

        ${shouldRefresh ? `<div class="warn">We’re just confirming your payment… this page will refresh automatically.</div>` : ''}

        <div class="kv">
          <div><strong>Event:</strong> ${esc(title)}</div>
          <div><strong>When:</strong> ${esc(dayName)} ${esc(fullDate)} at ${esc(timeStr)}</div>
          <div><strong>Venue:</strong> ${esc(venueLine)}</div>
          <div><strong>Address:</strong> ${esc(fullAddress)}</div>
          <div><strong>Tickets:</strong> ${esc(qty)}</div>
          <div><strong>Total paid:</strong> £${esc(amountPounds)}</div>
        </div>

        <div class="btns">
          <a class="btn ghost" href="/public/event/${escAttr(show.id)}">Back to event page</a>
        </div>

        <div class="small">
          You’ll also receive a confirmation email with your ticket(s). If it doesn’t arrive within a couple of minutes, check your spam folder.
        </div>
      </div>

      <div class="card">
        <h2 class="font-heading" style="font-size:1.25rem;">Create an account</h2>
        <div class="small">
          Create an account to access tickets, manage bookings, and re-book faster next time.
        </div>

        <div class="btns">
          <a class="btn primary" href="/signup">Sign up</a>
          <a class="btn ghost" href="/login">Log in</a>
        </div>

        <div class="small">
          (If your auth routes aren’t <code>/signup</code> and <code>/login</code>, tell me your exact paths and I’ll patch this precisely.)
        </div>
      </div>
    </div>

  </div>
</body>
</html>`);
  } catch (err: any) {
    console.error('[public-checkout-success] Error:', err);
    res.status(500).send('Server Error');
  }
});

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

    // FIX: Status check (explicit string cast)
    // @ts-ignore
    const status = (show as any).status as string;
    
    if (status !== 'LIVE' && status !== 'live') {
       return res.status(404).send(`Event is not LIVE (Status: ${status})`);
    }

    const venue = (show.venue || {}) as any;
    const ticketTypes = (show.ticketTypes || []) as any[];

    // --- DATE VARIABLES ---
    const dateObj = show.date ? new Date(show.date) : null;
    const whenISO = dateObj ? dateObj.toISOString() : undefined;
    
    const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
    const dayNum = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric' }) : '';
    const monthName = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'long' }) : '';
    const yearNum = dateObj ? dateObj.toLocaleDateString('en-GB', { year: 'numeric' }) : '';
    const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    
    const fullDate = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
    const prettyDate = `${dayName} ${dayNum} ${monthName} ${yearNum}`;

    const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
    const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

    const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
    const poster = show.imageUrl || '';
    const desc = cleanDesc(show.description) || `Live event at ${venueLine}`;

    // --- PRICE VARIABLES ---
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
    // Using an embed iframe URL instead of a direct link for the preview
    const mapEmbedUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    const mapLink = `https://maps.google.com/maps?q=${mapQuery}`;

    // Helper to generate ticket list HTML
    const renderTicketList = (isMainColumn = false) => {
        if (!ticketTypes.length) {
            return '<div style="padding:20px; text-align:center; font-size:0.9rem; color:var(--text-muted);">Tickets coming soon</div>';
        }
        return ticketTypes.map(t => {
             const avail = (t.available === null || t.available > 0);
             const rowClass = isMainColumn ? 'ticket-row main-col-row' : 'ticket-row widget-row';
             
             return `
             <a href="${avail ? `/checkout?showId=${encodeURIComponent(show.id)}&ticketId=${t.id}` : '#'}" class="${rowClass}" ${!avail ? 'style="pointer-events:none; opacity:0.6;"' : ''}>
               <div class="t-main">
                 <div class="t-name">${esc(t.name)}</div>
                 <div class="t-desc">${avail ? 'Available' : 'Sold Out'}</div>
               </div>
               <div class="t-action">
                 <span class="t-price">${esc(pFmt(t.pricePence))}</span>
                 <span class="${avail ? 'btn-buy' : 'btn-sold'}">${avail ? 'BOOK TICKETS' : 'Sold Out'}</span>
               </div>
             </a>
             `;
          }).join('');
    };


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
      /* TiXALL Blue Palette */
      --bg-page: #F3F4F6;
      --bg-surface: #FFFFFF;
      --primary: #0F172A;
      --brand: #0056D2; 
      --brand-hover: #0044A8;
      --text-main: #111827;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      --radius-md: 12px;
      --radius-lg: 16px;
      --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-page); color: var(--text-main); -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, .font-heading { font-family: 'Outfit', sans-serif; font-weight: 700; line-height: 1.1; margin: 0; }
    a { color: inherit; text-decoration: none; transition: opacity 0.2s; }
    a:hover { opacity: 0.8; }

    /* --- HERO SECTION --- */
    .hero {
      position: relative; background: var(--primary); color: white; min-height: 50vh;
      display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
    }
    .hero-bg {
      position: absolute; inset: 0; background-image: url('${escAttr(poster)}');
      background-size: cover; background-position: center center; opacity: 1; 
    }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to right, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.4) 50%, transparent 100%),
                  linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 40%);
    }
    .hero-top-nav { position: absolute; top: 0; left: 0; right: 0; padding: 24px; z-index: 20; }
    .breadcrumbs {
      font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      display: flex; gap: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.5); color: rgba(255,255,255,0.8);
    }
    .hero-content {
      position: relative; z-index: 10; width: 100%; max-width: 1200px; margin: 0 auto;
      padding: 40px 24px 50px; display: grid; gap: 16px;
    }
    .hero-title {
      font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 800; line-height: 1; text-transform: uppercase;
      letter-spacing: -0.02em; max-width: 800px; text-shadow: 0 4px 30px rgba(0,0,0,0.6);
    }
    .hero-meta {
      display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px; font-size: 1.05rem; font-weight: 500;
      color: rgba(255,255,255,0.95); text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .hero-meta-item { display: flex; align-items: center; gap: 8px; }
    .hero-meta-icon { color: var(--brand); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }

    /* --- LAYOUT CONTAINER --- */
    .layout {
      max-width: 1200px; margin: 0 auto; padding: 0 24px 80px;
      display: grid; gap: 48px; position: relative; z-index: 20;
    }
    @media (min-width: 960px) {
      .layout {
        grid-template-columns: 1fr 380px;
        margin-top: -24px; /* Reduced overlap for more space */
      }
    }

    /* --- MAIN CONTENT COLUMN --- */
    .content-area {
      display: flex; flex-direction: column; gap: 48px;
      padding-top: 64px; /* INCREASED PADDING for defined space */
    }

    .section-label {
      font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;
      color: var(--text-muted); margin-bottom: 16px; display: block;
      border-left: 4px solid var(--brand); padding-left: 12px;
    }
    .rich-text { font-size: 1.1rem; line-height: 1.7; color: #334155; }
    .rich-text p { margin-bottom: 1.5em; }
    .rich-text p:last-child { margin-bottom: 0; }

    /* Gallery Grid */
    .gallery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
    .gallery-item { aspect-ratio: 16/9; background: #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .gallery-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
    .gallery-item:hover .gallery-img { transform: scale(1.05); }

    /* Venue Map Styles (Updated for Iframe) */
    .venue-map-container { margin-top: 24px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .venue-map-header {
      position: relative; height: 220px; /* Taller for better map view */ background: #E2E8F0;
    }
    .venue-map-iframe {
        position: absolute; top:0; left:0; width:100%; height:100%; border:0;
        filter: grayscale(100%); transition: filter 0.3s; /* Grayscale until hover */
    }
    .venue-map-header:hover .venue-map-iframe { filter: grayscale(0%); }

    .venue-details { padding: 20px; background: #fff; position: relative; z-index: 2;}
    .venue-name { font-size: 1.3rem; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
    .venue-address { color: var(--text-muted); margin-bottom: 16px; }
    .btn-outline {
      display: inline-block; padding: 8px 16px; border: 2px solid var(--border);
      border-radius: 6px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; background: #fff;
    }
    .btn-outline:hover { border-color: var(--brand); color: var(--brand); background: #F8FAFC; }

    /* --- BOOKING WIDGET (Sidebar) --- */
    .booking-widget {
      position: sticky; top: 24px; background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-float); border: 1px solid var(--border); overflow: hidden;
    }
    .widget-header { padding: 24px; border-bottom: 1px solid var(--border); background: #fff; }
    .widget-title { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
    .widget-subtitle { font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;}
    .widget-footer { background: #F8FAFC; padding: 16px; border-top: 1px solid var(--border); text-align: center; font-size: 0.8rem; color: var(--text-muted); }

    /* --- TICKET LIST STYLES --- */
    .ticket-list-container { padding: 8px; }
    .ticket-row {
      display: grid; grid-template-columns: 1fr auto; align-items: center;
      padding: 16px; border-radius: 8px; transition: background 0.2s, box-shadow 0.2s;
      cursor: pointer; text-decoration: none; color: inherit;
    }
    .widget-row { padding: 12px 16px; }
    .widget-row:hover { background: #F8FAFC; }
    .main-col-row { background: #fff; border: 1px solid var(--border); margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .main-col-row:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-color: #d1d5db; }

    .t-main { display: flex; flex-direction: column; }
    .t-name { font-weight: 700; color: var(--primary); font-size: 1rem; }
    .t-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }
    .t-action { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;}
    .t-price { font-weight: 700; color: var(--primary); font-size: 1.1rem; }
    .btn-buy {
      background: var(--brand); color: white; font-size: 0.85rem; font-weight: 700;
      padding: 8px 16px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;
      transition: background 0.2s; white-space: nowrap;
    }
    .ticket-row:hover .btn-buy { background: var(--brand-hover); box-shadow: 0 2px 8px rgba(0, 86, 210, 0.3); }
    .btn-sold {
      background: #F1F5F9; color: #94A3B8; cursor: not-allowed;
      font-size: 0.85rem; font-weight: 700; padding: 8px 16px; border-radius: 6px; text-transform: uppercase;
    }

    /* --- MOBILE FOOTER --- */
    .mobile-bar {
      display: none; position: fixed; bottom: 0; left: 0; right: 0;
      background: white; padding: 16px 20px; box-shadow: 0 -4px 20px rgba(0,0,0,0.1); z-index: 100;
      align-items: center; justify-content: space-between; border-top: 1px solid var(--border);
    }
    .mob-price { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .mob-val { font-size: 1.2rem; font-weight: 800; color: var(--primary); }
    .btn-mob-cta {
      background: var(--brand); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 1rem;
    }

    @media (max-width: 960px) {
      .hero { min-height: 45vh; }
      .hero-title { font-size: 2.8rem; text-align: left; }
      .layout { display: block; margin-top: -20px; gap: 40px; }
      .content-area { padding-top: 40px; }
      .booking-area { display: none; }
      .mobile-bar { display: flex; }
    }
  </style>
</head>
<body>

  <header class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>
    <div class="hero-top-nav">
      <div class="breadcrumbs">
        <span>Home</span> <span>/</span> <span>Events</span> <span>/</span>
        <span style="color:var(--brand);">${esc(show.title)}</span>
      </div>
    </div>
    <div class="hero-content">
      <h1 class="hero-title">${esc(show.title)}</h1>
      <div class="hero-meta">
        <div class="hero-meta-item">
          <span class="hero-meta-icon">📅</span> <span>${esc(prettyDate)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-icon">📍</span> <span>${esc(venue.name)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-icon">⏰</span> <span>${esc(timeStr)}</span>
        </div>
      </div>
    </div>
  </header>

  <div class="layout">
    
    <div class="content-area">
      
      <div>
          <span class="section-label">Overview</span>
          <div class="rich-text">
            ${show.description ? show.description.replace(/\n/g, '<br/>') : '<p>Full details coming soon.</p>'}
          </div>
          ${poster ? `
          <div class="gallery-grid">
            <div class="gallery-item"><img src="${escAttr(poster)}" class="gallery-img" alt="Gallery 1"></div>
            <div class="gallery-item"><img src="${escAttr(poster)}" class="gallery-img" alt="Gallery 2" style="filter:hue-rotate(20deg);"></div>
          </div>
          ` : ''}
      </div>

      <div>
          <span class="section-label">Location</span>
          <div class="venue-map-container">
            <div class="venue-map-header">
                <iframe class="venue-map-iframe" src="${mapEmbedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
            <div class="venue-details">
              <h3 class="venue-name">${esc(venue.name)}</h3>
              <p class="venue-address">${esc(fullAddress)}</p>
              <a href="${escAttr(mapLink)}" target="_blank" class="btn-outline">Open in Maps ↗</a>
            </div>
          </div>
      </div>

      <div id="main-tickets">
          <span class="section-label">Tickets</span>
          <div class="ticket-list-container" style="padding:0;">
              ${renderTicketList(true)}
          </div>
      </div>

    </div>


    <div class="booking-area">
      <div class="booking-widget">
        <div class="widget-header">
          <div class="widget-title">Select Tickets</div>
          <div class="widget-subtitle">${esc(dayName)}, ${esc(fullDate)} at ${esc(timeStr)}</div>
        </div>
        <div class="ticket-list-container">
          ${renderTicketList(false)}
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
    <a href="#main-tickets" class="btn-mob-cta">BOOK TICKETS</a>
  </div>

</body>
</html>`);
  } catch (err: any) {
    console.error('[public-event-ssr] Error:', err);
    res.status(500).send('Server Error');
  }
});

export default router;
