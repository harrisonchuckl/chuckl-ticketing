// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Admin UI (multi-section SPA with sidebar)
 * - Hash routing (#/shows, #/venues, etc.)
 * - Admin Key saved to localStorage and sent as x-admin-key
 * - Real calls wired for Venues (GET/POST) and Shows (list/create) if available
 * - Everything else is a “coming soon” placeholder tab (ready for future wiring)
 */
router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root{--bg:#f6f7fb;--panel:#ffffff;--border:#e5e7ef;--ink:#0e1328;--muted:#6b7280;--brand:#4053ff;--brand-ink:#fff;--ok:#0f5132;--ok-ink:#d1f7e3;--err:#511f20;--err-ink:#ffd7d9}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
  .layout{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
  .side{background:#0f1220;color:#e8ebf7;padding:16px 12px;display:flex;flex-direction:column}
  .brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:18px;letter-spacing:.2px;margin:6px 8px 14px}
  .nav{display:flex;flex-direction:column;gap:4px}
  .nav a{display:flex;align-items:center;gap:10px;color:#cfd5ff;text-decoration:none;padding:10px 12px;border-radius:10px;font-weight:600}
  .nav a:hover{background:#151935}
  .nav a.active{background:#1a1f47;color:#fff}
  .main{padding:24px}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px}
  .hstack{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .stack{display:flex;flex-direction:column;gap:10px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .label{font-size:12px;color:var(--muted);margin-bottom:4px}
  input,select,textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--ink);font-size:14px}
  textarea{min-height:110px;resize:vertical}
  button{appearance:none;border:0;border-radius:10px;padding:10px 14px;background:var(--brand);color:var(--brand-ink);font-weight:700;cursor:pointer}
  button.ghost{background:transparent;color:var(--ink);border:1px solid var(--border)}
  button.secondary{background:#e9ecff;color:#1b2ae6}
  .table{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .table th,.table td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;font-size:14px}
  .muted{color:var(--muted)}
  .note{font-size:12px;color:var(--muted)}
  .toolbar{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-bottom:12px}
  .toolbar .actions{display:flex;gap:8px}
  .hide{display:none !important}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:700}
  .toast.ok{background:var(--ok);color:var(--ok-ink)}
  .toast.err{background:var(--err);color:var(--err-ink)}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 8px;border-radius:999px;border:1px solid var(--border);background:#fff}
  .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .kpi .card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px}
  .kpi .metric{font-size:12px;color:var(--muted)}
  .kpi .value{font-size:22px;font-weight:800;margin-top:6px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .heading{font-size:20px;font-weight:800}
  .sub{font-size:12px;color:var(--muted)}
  .danger{background:#ffe8ea;color:#7e0e1a;border-color:#ffd2d7}
  .success{background:#e9fbef;color:#0a5c32;border-color:#c8f4d7}
  .badge{display:inline-block;font-size:11px;padding:4px 8px;border-radius:999px;background:#eef1ff;color:#2332e8;font-weight:700}
  .divider{height:1px;background:var(--border);margin:12px 0}
</style>
</head>
<body>
<div class="layout">
  <aside class="side">
    <div class="brand">Chuckl. Admin</div>
    <div class="nav" id="nav">
      <a href="#/dashboard" data-view="dashboard">Dashboard</a>
      <a href="#/shows" data-view="shows">Shows</a>
      <a href="#/venues" data-view="venues">Venues</a>
      <a href="#/tickets" data-view="tickets">Ticket Types</a>
      <a href="#/orders" data-view="orders">Orders</a>
      <a href="#/customers" data-view="customers">Customers / CRM</a>
      <a href="#/discounts" data-view="discounts">Discounts & Vouchers</a>
      <a href="#/marketing" data-view="marketing">Marketing Automations</a>
      <a href="#/seating" data-view="seating">Seating Maps</a>
      <a href="#/merch" data-view="merch">Merchandise</a>
      <a href="#/affiliates" data-view="affiliates">Affiliates & Local Deals</a>
      <a href="#/analytics" data-view="analytics">Analytics</a>
      <a href="#/settings" data-view="settings">Settings</a>
    </div>
    <div style="margin-top:auto;padding:8px 8px 0" class="note">© Chuckl.</div>
  </aside>

  <main class="main">
    <!-- GLOBAL KEY BAR -->
    <div class="panel stack" style="margin-bottom:14px">
      <div class="header">
        <div>
          <div class="heading">Admin Key</div>
          <div class="sub">Stored locally and sent as <code>x-admin-key</code> on API calls.</div>
        </div>
        <div class="actions hstack">
          <button id="btnLoad" class="secondary">Load venues & shows</button>
        </div>
      </div>
      <div class="grid3">
        <div>
          <div class="label">Admin Key</div>
          <input id="adminkey" placeholder="enter your admin key"/>
        </div>
        <div class="stack" style="align-self:end">
          <button id="btnSaveKey" class="ghost">Save key</button>
        </div>
        <div class="stack" style="align-self:end">
          <span class="pill"><span id="envBadge">Production</span></span>
        </div>
      </div>
    </div>

    <!-- VIEWS -->
    <section id="view-dashboard" class="panel stack">
      <div class="header">
        <div>
          <div class="heading">Dashboard</div>
          <div class="sub">High-level snapshot (placeholders; wire up later).</div>
        </div>
      </div>
      <div class="kpi">
        <div class="card"><div class="metric">Tickets sold (7d)</div><div class="value">—</div></div>
        <div class="card"><div class="metric">Revenue (7d)</div><div class="value">—</div></div>
        <div class="card"><div class="metric">Upcoming shows</div><div class="value">—</div></div>
        <div class="card"><div class="metric">Refund rate</div><div class="value">—</div></div>
      </div>
      <div class="divider"></div>
      <div class="stack">
        <div class="label">Recent activity</div>
        <div class="note">Feed placeholder — actions, allocations, marketing sends, etc.</div>
      </div>
    </section>

    <section id="view-shows" class="panel stack hide">
      <div class="header">
        <div>
          <div class="heading">Shows</div>
          <div class="sub">Create shows and view the latest.</div>
        </div>
        <div class="actions hstack">
          <button id="btnRefreshShows" class="secondary">Refresh shows</button>
        </div>
      </div>

      <!-- Create Show -->
      <div class="stack">
        <div class="label">Create Show</div>
        <div class="grid3">
          <div><div class="label">Title</div><input id="showTitle" placeholder="e.g. Chuckl. Bridlington"/></div>
          <div><div class="label">Date & Time</div><input id="showDate" type="datetime-local"/></div>
          <div><div class="label">Venue</div><select id="showVenue"></select></div>
        </div>
        <div class="grid3">
          <div><div class="label">Capacity Override (optional)</div><input id="showCap" placeholder="leave blank to use venue capacity"/></div>
          <div><div class="label">Poster URL (optional)</div><input id="showPoster" placeholder="https://…"/></div>
          <div></div>
        </div>
        <div><div class="label">Description (optional)</div><textarea id="showDesc" placeholder="Short description…"></textarea></div>
        <div class="hstack">
          <button id="btnCreateShow">Create Show</button>
          <button id="btnResetShow" class="ghost">Reset</button>
          <span class="note">Uploads to S3 coming soon; paste a poster URL for now.</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Latest list -->
      <div class="stack">
        <div class="label">Latest Shows</div>
        <table class="table" id="tblShows">
          <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="note">This calls <code>/admin/shows/latest?limit=20</code>.</div>
      </div>
    </section>

    <section id="view-venues" class="panel stack hide">
      <div class="header">
        <div>
          <div class="heading">Venues</div>
          <div class="sub">Create and list venues (used by show creation).</div>
        </div>
        <div class="actions hstack">
          <button id="btnRefreshVenues" class="secondary">Refresh venues</button>
        </div>
      </div>

      <div class="grid3">
        <div><div class="label">Venue Name</div><input id="venueName" placeholder="e.g. The Forum Theatre"/></div>
        <div><div class="label">Capacity (optional)</div><input id="venueCap" placeholder="e.g. 650"/></div>
        <div><div class="label">Address (line)</div><input id="venueAddr" placeholder="e.g. 123 High Street"/></div>
      </div>
      <div class="grid3">
        <div><div class="label">City</div><input id="venueCity" placeholder="e.g. Malvern"/></div>
        <div><div class="label">Postcode</div><input id="venuePost" placeholder="e.g. WR14 3HB"/></div>
        <div class="stack" style="align-self:end"><button id="btnCreateVenue">Create Venue</button></div>
      </div>

      <div class="divider"></div>

      <div class="stack">
        <div class="label">All Venues</div>
        <table class="table" id="tblVenues">
          <thead><tr><th>Name</th><th>City</th><th>Postcode</th><th>Capacity</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- Placeholder views to be wired later -->
    <section id="view-tickets" class="panel stack hide">
      <div class="heading">Ticket Types</div>
      <div class="sub">Define GA / VIP / Early Bird etc. per show.</div>
      <div class="divider"></div>
      <div class="note">Planned: per-show ticket type editor, price/allocations, fees, visibility windows.</div>
    </section>

    <section id="view-orders" class="panel stack hide">
      <div class="heading">Orders</div>
      <div class="sub">Search, export CSV, refund actions.</div>
      <div class="divider"></div>
      <div class="note">Planned: filters (status/date/show), receipt resend, refund/void, payout summaries.</div>
    </section>

    <section id="view-customers" class="panel stack hide">
      <div class="heading">Customers / CRM</div>
      <div class="sub">Venue-centric audience with tags and segments.</div>
      <div class="divider"></div>
      <ul>
        <li>Customer profiles with show history</li>
        <li>Tagging by categories (stand-up, music, family)</li>
        <li>Mailing list sync with built-in “Mailchimp-esque” campaigns</li>
      </ul>
    </section>

    <section id="view-discounts" class="panel stack hide">
      <div class="heading">Discounts & Vouchers</div>
      <div class="sub">Codes, campaigns, partner links.</div>
      <div class="divider"></div>
      <div class="note">Planned: single-use/multi-use, validity windows, per-ticket-type limits, reporting.</div>
    </section>

    <section id="view-marketing" class="panel stack hide">
      <div class="heading">Marketing Automations</div>
      <div class="sub">Pre-show reminders, “doors open”, “thank you”, upsells, next-show nudges.</div>
      <div class="divider"></div>
      <ul>
        <li>Templates per venue and per category</li>
        <li>Smart send windows and suppression (e.g., don’t email day-after if customer refunded)</li>
        <li>Performance dashboard and A/B tests</li>
      </ul>
    </section>

    <section id="view-seating" class="panel stack hide">
      <div class="heading">Seating Maps</div>
      <div class="sub">Per-venue seat maps with zones, holds, and allocations.</div>
      <div class="divider"></div>
      <div class="note">Planned: seat designer, row/seat import, ADA holds, price zones, map previews.</div>
    </section>

    <section id="view-merch" class="panel stack hide">
      <div class="heading">Merchandise</div>
      <div class="sub">Add-ons at checkout and post-purchase offers.</div>
      <div class="divider"></div>
      <div class="note">Planned: per-show merch SKUs, inventory, fulfilment notes, pickup QR.</div>
    </section>

    <section id="view-affiliates" class="panel stack hide">
      <div class="heading">Affiliates & Local Deals</div>
      <div class="sub">Venue-specific offers shown in customer accounts (USP).</div>
      <div class="divider"></div>
      <div class="note">Planned: affiliate links, deal cards on venue portal, rev-share tracking.</div>
    </section>

    <section id="view-analytics" class="panel stack hide">
      <div class="heading">Analytics</div>
      <div class="sub">Sales curves, demand heatmap, campaign attribution.</div>
      <div class="divider"></div>
      <div class="note">Planned: cohort charts, county/venue comparisons, action timeline overlays.</div>
    </section>

    <section id="view-settings" class="panel stack hide">
      <div class="heading">Settings</div>
      <div class="sub">Org, venues, payouts, taxes/fees, API keys.</div>
      <div class="divider"></div>
      <div class="note">Planned: white-label theming, custom domains, user roles, webhook keys.</div>
    </section>

  </main>
</div>

<div id="toast" class="toast hide"></div>

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const toast = $('#toast');

  function showToast(msg, ok=true, ms=2500){
    toast.textContent = msg;
    toast.className = 'toast ' + (ok ? 'ok' : 'err');
    toast.classList.remove('hide');
    setTimeout(()=>toast.classList.add('hide'), ms);
  }

  // ROUTING
  const views = {
    dashboard: $('#view-dashboard'),
    shows: $('#view-shows'),
    venues: $('#view-venues'),
    tickets: $('#view-tickets'),
    orders: $('#view-orders'),
    customers: $('#view-customers'),
    discounts: $('#view-discounts'),
    marketing: $('#view-marketing'),
    seating: $('#view-seating'),
    merch: $('#view-merch'),
    affiliates: $('#view-affiliates'),
    analytics: $('#view-analytics'),
    settings: $('#view-settings'),
  };

  function setActive(view){
    Object.values(views).forEach(v => v.classList.add('hide'));
    (views[view] || views.dashboard).classList.remove('hide');
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  }

  function parseHash(){
    const h = location.hash.replace(/^#\\//,'');
    return h || 'dashboard';
  }

  window.addEventListener('hashchange', ()=> setActive(parseHash()));
  setActive(parseHash());

  // ADMIN KEY
  const keyEl = $('#adminkey');
  keyEl.value = localStorage.getItem('chuckl_admin_key') || '';
  $('#btnSaveKey').addEventListener('click', ()=>{
    localStorage.setItem('chuckl_admin_key', keyEl.value.trim());
    showToast('Key saved');
  });

  // Simple env badge
  $('#envBadge').textContent = location.hostname.includes('railway') ? 'Production (Railway)' : 'Local';

  // API helpers
  function headers(){
    const k = keyEl.value.trim();
    const h = { 'Content-Type': 'application/json' };
    if (k) h['x-admin-key'] = k;
    return h;
  }
  async function getJSON(url){
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  async function postJSON(url, body){
    const r = await fetch(url, { method:'POST', headers: headers(), body: JSON.stringify(body||{}) });
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  // VENUES
  const tblVenues = $('#tblVenues tbody');
  const venueSel = $('#showVenue');
  async function loadVenues(){
    tblVenues.innerHTML = '';
    venueSel.innerHTML = '<option value="">Select a venue…</option>';
    try{
      const data = await getJSON('/admin/venues');
      (data.venues || []).forEach(v=>{
        // table
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${v.name||'—'}</td><td>\${v.city||'—'}</td><td>\${v.postcode||'—'}</td><td>\${v.capacity ?? '—'}</td>\`;
        tblVenues.appendChild(tr);
        // select
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name + (v.city ? ' — '+v.city : '');
        venueSel.appendChild(opt);
      });
      showToast('Venues loaded');
    }catch(e){
      showToast('Failed to load venues', false);
    }
  }
  $('#btnRefreshVenues').addEventListener('click', loadVenues);

  $('#btnCreateVenue').addEventListener('click', async ()=>{
    const name = $('#venueName').value.trim();
    const capacity = Number($('#venueCap').value.trim()) || null;
    const address = $('#venueAddr').value.trim() || null;
    const city = $('#venueCity').value.trim() || null;
    const postcode = $('#venuePost').value.trim() || null;
    if(!name){ showToast('Venue name required', false); return; }
    try{
      const r = await postJSON('/admin/venues', { name, capacity, address, city, postcode });
      if(r && r.ok){ showToast('Venue created'); await loadVenues(); }
      else showToast(r.message || 'Could not create venue', false);
    }catch(e){ showToast('Error creating venue', false); }
  });

  // SHOWS
  const tblShows = $('#tblShows tbody');
  async function loadShows(){
    tblShows.innerHTML = '';
    try{
      const data = await getJSON('/admin/shows/latest?limit=20');
      (data.shows || []).forEach(s=>{
        const when = new Date(s.date).toLocaleString('en-GB');
        const venue = s.venue?.name || '—';
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${s.title}</td><td>\${when}</td><td>\${venue}</td><td>\${s._count?.tickets ?? '—'}</td><td>\${s._count?.orders ?? '—'}</td>\`;
        tblShows.appendChild(tr);
      });
      showToast('Shows loaded');
    }catch(e){
      showToast('Failed to load shows', false);
    }
  }
  $('#btnRefreshShows').addEventListener('click', loadShows);

  $('#btnCreateShow').addEventListener('click', async ()=>{
    const title = $('#showTitle').value.trim();
    const date = $('#showDate').value;
    const venueId = $('#showVenue').value;
    const description = $('#showDesc').value.trim() || null;
    const capacityOverride = Number($('#showCap').value.trim()) || null;
    const posterUrl = $('#showPoster').value.trim() || null;

    if(!title || !date || !venueId){
      showToast('Title, date and venue are required', false);
      return;
    }
    try{
      const body = { title, date: new Date(date).toISOString(), venueId, description, capacityOverride, posterUrl };
      const r = await postJSON('/admin/shows', body);
      if(r && r.ok){ 
        showToast('Show created');
        $('#showTitle').value = '';
        $('#showDate').value = '';
        $('#showVenue').value = '';
        $('#showDesc').value = '';
        $('#showCap').value = '';
        $('#showPoster').value = '';
        await loadShows();
      }else{
        showToast(r.message || 'Could not create show', false);
      }
    }catch(e){ showToast('Error creating show', false); }
  });

  $('#btnResetShow').addEventListener('click', ()=>{
    $('#showTitle').value = '';
    $('#showDate').value = '';
    $('#showVenue').value = '';
    $('#showDesc').value = '';
    $('#showCap').value = '';
    $('#showPoster').value = '';
  });

  // global load button
  $('#btnLoad').addEventListener('click', async ()=>{
    await loadVenues();
    await loadShows();
  });

  // If key already present, auto-load lists once
  if (keyEl.value.trim()){
    loadVenues().then(loadShows);
  }
})();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
