// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

export const router = Router();

/**
 * Serves a single-page Admin UI with:
 * - Light theme (Eventbrite-style panels)
 * - Sidebar navigation (Dashboard, Shows, Venues, Orders, Tickets, Marketing, Customers, Seating, Finance, Settings, Help)
 * - Admin Key storage (localStorage) + ?k=KEY passthrough
 * - Hash routing (#/dashboard, #/shows, etc.)
 * - Working demo actions wired to your existing JSON endpoints:
 *    /admin/shows/latest  (GET)
 *    /admin/venues        (GET)
 *    /admin/orders/latest (GET)  ← if present; otherwise shows graceful error
 *
 * No external JS/CSS; inline, runs at end of <body>.
 */
router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root {
    --bg: #f6f7fb;
    --panel: #ffffff;
    --text: #0e1015;
    --muted: #6b7280;
    --border: #e5e7eb;
    --primary: #2563eb;
    --primary-600: #1d4ed8;
    --success: #16a34a;
    --error: #dc2626;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  }
  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
  }
  aside {
    padding: 16px 12px;
    border-right: 1px solid var(--border);
    background: #fff;
  }
  .brand {
    font-size: 18px;
    font-weight: 700;
    margin: 6px 8px 14px;
  }
  .adminkey {
    display: flex;
    gap: 8px;
    margin: 0 8px 16px;
  }
  .adminkey input {
    flex: 1;
    height: 34px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .btn {
    appearance: none;
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    background: var(--primary);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
  .btn:active { transform: translateY(1px); }
  .btn.secondary { background: #eef2ff; color: #1e3a8a; }
  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px;
  }
  .navlink {
    display: block;
    padding: 10px 12px;
    border-radius: 8px;
    color: #111827;
    text-decoration: none;
  }
  .navlink:hover { background: #f3f4f6; }
  .navlink.active { background: #e8efff; color: #1d4ed8; font-weight: 700; }

  main {
    padding: 20px 24px 60px;
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }
  .panel h2 {
    margin: 0 0 8px;
    font-size: 18px;
  }
  .muted { color: var(--muted); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .spacer { height: 14px; }
  input[type="text"], input[type="datetime-local"], select {
    height: 36px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
    background: #fff; color: var(--text);
  }
  textarea {
    width: 100%; min-height: 90px; padding: 10px; border: 1px solid var(--border); border-radius: 8px;
    background: #fff; color: var(--text); resize: vertical;
  }
  .grid { display: grid; gap: 12px; }
  .grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .list { margin: 8px 0 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .list-item { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .list-item:last-child { border-bottom: 0; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
  .toast {
    position: fixed; right: 16px; bottom: 16px; padding: 12px 14px; border-radius: 10px;
    color: #fff; background: #111827; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,.15);
  }
  .ok { background: var(--success); }
  .err { background: var(--error); }
</style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand">Chuckl. Admin</div>
      <div class="adminkey">
        <input id="adminkey" type="text" placeholder="Admin Key"/>
        <button class="btn" id="saveKeyBtn">Save</button>
      </div>
      <nav id="nav">
        <a class="navlink" href="#/dashboard">Dashboard</a>
        <a class="navlink" href="#/shows">Shows</a>
        <a class="navlink" href="#/venues">Venues</a>
        <a class="navlink" href="#/orders">Orders</a>
        <a class="navlink" href="#/tickets">Tickets</a>
        <a class="navlink" href="#/marketing">Marketing</a>
        <a class="navlink" href="#/customers">Customers</a>
        <a class="navlink" href="#/seating">Seating</a>
        <a class="navlink" href="#/finance">Finance</a>
        <a class="navlink" href="#/settings">Settings</a>
        <a class="navlink" href="#/help">Help</a>
      </nav>
    </aside>

    <main>
      <div id="view"></div>
    </main>
  </div>

  <div id="toast" class="toast" style="display:none"></div>

<script>
(function() {
  // --- tiny helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const toast = (msg, ok=true) => {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast ' + (ok ? 'ok' : 'err');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  };

  // Admin Key storage: localStorage "ch_admin_key"
  const KEY_NAME = 'ch_admin_key';
  const keyInput = $('#adminkey');
  const saveKeyBtn = $('#saveKeyBtn');

  function setKey(k) {
    localStorage.setItem(KEY_NAME, k || '');
    keyInput.value = k || '';
  }
  function getKey() {
    return localStorage.getItem(KEY_NAME) || '';
  }
  // Accept ?k=... once
  try {
    const params = new URLSearchParams(location.search);
    const k = params.get('k');
    if (k) {
      setKey(k);
      const url = new URL(location.href);
      url.searchParams.delete('k');
      history.replaceState({}, '', url.toString());
      toast('Admin key saved from URL');
    }
  } catch {}

  // init field
  keyInput.value = getKey();
  saveKeyBtn.addEventListener('click', () => {
    setKey(keyInput.value.trim());
    toast('Admin key saved');
  });

  // --- nav active state
  function setActive(href) {
    $$('#nav .navlink').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === href);
    });
  }

  // --- views
  const view = $('#view');

  function pageDashboard() {
    view.innerHTML = \`
      <div class="panel">
        <h2>Dashboard</h2>
        <div class="row">
          <button class="btn secondary" id="loadOverview">Load overview</button>
          <span class="muted">Quick links on the left. Use your Admin Key for all API calls.</span>
        </div>
        <div class="spacer"></div>
        <pre id="out" class="mono" style="white-space:pre-wrap"></pre>
      </div>\`;
    $('#loadOverview').addEventListener('click', async () => {
      const k = getKey();
      if (!k) return toast('Add Admin Key first', false);
      try {
        const [shows, venues] = await Promise.all([
          fetch('/admin/shows/latest?limit=5', { headers: { 'x-admin-key': k }}).then(r=>r.json()),
          fetch('/admin/venues', { headers: { 'x-admin-key': k }}).then(r=>r.json()),
        ]);
        $('#out').textContent = JSON.stringify({ shows, venues }, null, 2);
        toast('Loaded overview');
      } catch (e) {
        toast('Failed to load', false);
      }
    });
  }

  function listToHtml(items, render) {
    if (!items || !items.length) return '<div class="muted">No data</div>';
    return '<div class="list">' + items.map(render).join('') + '</div>';
  }

  function pageShows() {
    view.innerHTML = \`
      <div class="panel">
        <h2>Shows</h2>
        <div class="row">
          <button class="btn" id="loadShows">Load latest shows</button>
        </div>
        <div class="spacer"></div>
        <div id="shows"></div>
      </div>\`;
    $('#loadShows').addEventListener('click', async () => {
      const k = getKey(); if (!k) return toast('Add Admin Key first', false);
      try {
        const r = await fetch('/admin/shows/latest?limit=20', { headers: { 'x-admin-key': k }});
        const j = await r.json();
        if (!j.ok) throw new Error(j.message || 'Error');
        const html = listToHtml(j.shows, (s) => (
          \`<div class="list-item">
            <div><strong>\${s.title}</strong></div>
            <div class="muted">\${new Date(s.date).toLocaleString('en-GB')} – \${s.venue?.name || '—'}</div>
          </div>\`
        ));
        $('#shows').innerHTML = html;
        toast('Shows loaded');
      } catch (e) {
        toast('Failed to load shows', false);
      }
    });
  }

  function pageVenues() {
    view.innerHTML = \`
      <div class="panel">
        <h2>Venues</h2>
        <div class="row">
          <button class="btn" id="loadVenues">List venues</button>
        </div>
        <div class="spacer"></div>
        <div id="venues"></div>
      </div>\`;
    $('#loadVenues').addEventListener('click', async () => {
      const k = getKey(); if (!k) return toast('Add Admin Key first', false);
      try {
        const r = await fetch('/admin/venues', { headers: { 'x-admin-key': k }});
        const j = await r.json();
        if (!j.ok) throw new Error(j.message || 'Error');
        const html = listToHtml(j.venues, (v) => (
          \`<div class="list-item">
            <div><strong>\${v.name}</strong></div>
            <div class="muted">\${[v.address, v.city, v.postcode].filter(Boolean).join(', ')}</div>
          </div>\`
        ));
        $('#venues').innerHTML = html;
        toast('Venues loaded');
      } catch (e) {
        toast('Failed to load venues', false);
      }
    });
  }

  function pageOrders() {
    view.innerHTML = \`
      <div class="panel">
        <h2>Orders</h2>
        <div class="row">
          <button class="btn" id="loadOrders">Load latest orders</button>
        </div>
        <div class="spacer"></div>
        <div id="orders"></div>
      </div>\`;
    $('#loadOrders').addEventListener('click', async () => {
      const k = getKey(); if (!k) return toast('Add Admin Key first', false);
      try {
        const r = await fetch('/admin/orders/latest?limit=25', { headers: { 'x-admin-key': k }});
        const j = await r.json();
        if (!j.ok) throw new Error(j.message || 'Error');
        const html = listToHtml(j.orders, (o) => (
          \`<div class="list-item">
            <div><strong>\${o.email}</strong> – \${(o.amountPence/100).toFixed(2)} GBP – \${o.status}</div>
            <div class="muted">Show: \${o.show?.title || '—'} • \${new Date(o.createdAt).toLocaleString('en-GB')}</div>
          </div>\`
        ));
        $('#orders').innerHTML = html;
        toast('Orders loaded');
      } catch (e) {
        $('#orders').innerHTML = '<div class="muted">Orders API not available yet.</div>';
        toast('Orders endpoint not available', false);
      }
    });
  }

  function placeholder(title, body='Coming soon…') {
    view.innerHTML = \`
      <div class="panel">
        <h2>\${title}</h2>
        <div class="muted">\${body}</div>
      </div>\`;
  }

  // --- router
  const routes = {
    '/dashboard': pageDashboard,
    '/shows': pageShows,
    '/venues': pageVenues,
    '/orders': pageOrders,
    '/tickets': () => placeholder('Tickets', 'Scan, lists and exports will live here.'),
    '/marketing': () => placeholder('Marketing', 'Email journeys, ad pixels, UTM tracking.'),
    '/customers': () => placeholder('Customers', 'CRM + segments + exports.'),
    '/seating': () => placeholder('Seating', 'Seat maps per venue; allocations.'),
    '/finance': () => placeholder('Finance', 'Payouts, fees, settlements.'),
    '/settings': () => placeholder('Settings', 'Organisation & venue settings.'),
    '/help': () => placeholder('Help', 'Docs, contacts, FAQs.'),
  };

  function render() {
    const hash = location.hash || '#/dashboard';
    const path = hash.replace(/^#/, '');
    setActive('#' + path);
    const fn = routes[path] || routes['/dashboard'];
    fn();
  }

  window.addEventListener('hashchange', render);
  // initial render
  render();

})();
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
