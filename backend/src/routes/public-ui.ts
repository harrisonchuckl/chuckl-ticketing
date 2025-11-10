// backend/src/routes/public-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * Minimal SPA for public browsing of events.
 * Routes it renders on the client:
 *  - /public/events         (list)
 *  - /public/event/:id      (detail)
 *
 * This file focuses on a clean <title> experience + sitemap link.
 */
router.get(['/events', '/event/:id'], (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Comedy Tickets</title>
  <link rel="sitemap" type="application/xml" href="/public/sitemap.xml" />
  <style>
    :root {
      --bg: #fff;
      --text: #0f172a;
      --muted:#475569;
      --border:#e2e8f0;
      --brand:#0ea5e9;
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:var(--text); background:var(--bg); }
    header { padding:16px; border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:center; }
    header a { color:var(--text); text-decoration:none; font-weight:600; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
    .card { border:1px solid var(--border); border-radius:12px; overflow:hidden; background:#fff; display:flex; flex-direction:column; }
    .poster { width:100%; aspect-ratio: 3/4; object-fit:cover; background:#f1f5f9; }
    .pad { padding:12px; }
    .muted { color:var(--muted); }
    .btn { display:inline-block; padding:10px 12px; border-radius:8px; border:1px solid var(--border); text-decoration:none; }
    .btn:hover { background:#f8fafc; }
    .cta { border-color: var(--brand); color:#0a0a0a; }
    .event-hero { display:grid; grid-template-columns: 1fr; gap:16px; }
    @media (min-width: 860px) {
      .event-hero { grid-template-columns: 1fr 1.2fr; }
    }
  </style>
</head>
<body>
  <header class="wrap">
    <a href="/public/events" id="brand">Comedy Tickets</a>
  </header>
  <main class="wrap" id="app">
    <div class="muted">Loading…</div>
  </main>

<script>
(function(){
  const el = (sel, root=document) => root.querySelector(sel);
  const els = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Basic router on pathname
  async function route() {
    const path = location.pathname;
    if (path === '/public/events') return renderList();
    const m = path.match(/^\\/public\\/event\\/([a-z0-9]+)$/i);
    if (m) return renderDetail(m[1]);
    // default: go to list
    history.replaceState(null, '', '/public/events');
    return renderList();
  }

  function setTitle(t) {
    document.title = t || 'Comedy Tickets';
  }

  function fmtP(p) { return '£' + (Number(p||0)/100).toFixed(2); }

  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // LIST
  async function renderList() {
    setTitle('Comedy Tickets – Upcoming Shows');
    el('#app').innerHTML = '<div class="muted">Loading…</div>';
    try {
      const j = await getJSON('/events/upcoming');
      if (!j.ok) throw new Error();
      const items = (j.items || []);
      el('#app').innerHTML = `
        <h1>Upcoming Comedy Shows</h1>
        <div class="grid">
          ${items.map(it => {
            const img = it.imageUrl || '';
            const dateStr = it.date ? new Date(it.date).toLocaleString() : '';
            const venueLine = [it.venue?.name, it.venue?.city].filter(Boolean).join(' — ');
            return `
              <article class="card">
                ${img ? `<img class="poster" src="${escapeAttr(img)}" alt="${escapeAttr(it.title)} poster" />` : `<div class="poster"></div>`}
                <div class="pad">
                  <div style="font-weight:700;">${escapeHtml(it.title || '')}</div>
                  <div class="muted">${escapeHtml(dateStr)}</div>
                  <div class="muted">${escapeHtml(venueLine)}</div>
                  <div style="height:8px;"></div>
                  <a class="btn cta" href="/public/event/${escapeAttr(it.id)}">View details</a>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `;
    } catch(e) {
      el('#app').innerHTML = '<div class="muted">Failed to load shows.</div>';
    }
  }

  // DETAIL
  async function renderDetail(id) {
    el('#app').innerHTML = '<div class="muted">Loading…</div>';
    try {
      const j = await getJSON('/events/' + encodeURIComponent(id));
      if (!j.ok || !j.show) throw new Error();
      const s = j.show;
      const dateStr = s.date ? new Date(s.date).toLocaleString() : '';
      const venueLine = [s.venue?.name, s.venue?.city].filter(Boolean).join(' — ');
      setTitle(`${s.title} – ${venueLine || 'Comedy Tickets'}`);

      const cheapest = (s.ticketTypes || []).slice().sort((a,b)=> (a.pricePence||0) - (b.pricePence||0))[0];
      const fromPrice = cheapest ? ('From ' + fmtP(cheapest.pricePence)) : '';
      const poster = s.imageUrl || '';

      el('#app').innerHTML = `
        <article>
          <div class="event-hero">
            <div>
              ${poster ? `<img class="poster" src="${escapeAttr(poster)}" alt="${escapeAttr(s.title)} poster" />` : `<div class="poster"></div>`}
            </div>
            <div>
              <h1>${escapeHtml(s.title || '')}</h1>
              <div class="muted">${escapeHtml(dateStr)}</div>
              <div class="muted">${escapeHtml(venueLine)}</div>
              <div style="height:8px;"></div>
              ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ''}
              ${fromPrice ? `<p><strong>${escapeHtml(fromPrice)}</strong></p>` : ''}
              <div style="height:12px;"></div>
              <a class="btn cta" href="/checkout?showId=${escapeAttr(s.id)}">Buy tickets</a>
            </div>
          </div>
        </article>
      `;
    } catch(e) {
      el('#app').innerHTML = '<div class="muted">Event not found.</div>';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.addEventListener('popstate', route);
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    // Intercept same-origin SPA links for /public only
    if (href.startsWith('/public/')) {
      e.preventDefault();
      history.pushState(null, '', href);
      route();
    }
  });

  route();
})();
</script>
</body>
</html>`);
});

export default router;
