// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Admin UI (light theme)
 * - Left sidebar with menu items
 * - Hash routing (#/dashboard, #/venues, #/shows, #/orders, #/tickets, #/marketing, #/customers, #/seating, #/finance, #/settings, #/help)
 * - Persists Admin Key in localStorage and sends it as x-admin-key
 * - Functional sections now: Venues (list/create), Shows (list latest/create)
 */
router.get('/ui', (_req: Request, res: Response) => {
  const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root{
    --bg:#f6f7fb;
    --panel:#ffffff;
    --border:#e5e7ef;
    --text:#0f172a;
    --muted:#6b7280;
    --brand:#4053ff;
    --brand-600:#2f41ee;
    --ok:#10b981;
    --warn:#f59e0b;
    --err:#ef4444;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--text);font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
  .layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
  .sidebar{background:#ffffff;border-right:1px solid var(--border);padding:14px}
  .brand{font-weight:800;letter-spacing:0.2px;margin:6px 8px 16px}
  .keybox{display:flex;gap:8px;padding:8px;border:1px solid var(--border);border-radius:10px;background:#fafbff;margin:0 8px 16px}
  .keybox input{flex:1;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px}
  .keybox button{border:0;border-radius:8px;background:var(--brand);color:#fff;padding:8px 10px;font-weight:600;cursor:pointer}
  nav{display:flex;flex-direction:column;gap:4px;margin:6px 4px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:#111827;text-decoration:none;cursor:pointer}
  .nav-item:hover{background:#eef2ff}
  .nav-item.active{background:#e0e7ff}
  .content{padding:24px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px}
  h1{margin:0 0 12px;font-size:22px}
  h2{margin:0 0 10px;font-size:18px}
  label{display:block;color:var(--muted);font-size:12px;margin:10px 0 6px}
  input[type=text],input[type=datetime-local],select,textarea{
    width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-size:14px
  }
  textarea{min-height:90px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .btn{appearance:none;border:0;border-radius:10px;background:var(--brand);color:#fff;font-weight:700;padding:10px 12px;cursor:pointer}
  .btn.secondary{background:#e5e7ef;color:#111827}
  .btn.warn{background:var(--warn)}
  .btn.ok{background:var(--ok)}
  .btn.err{background:var(--err)}
  .toolbar{display:flex;gap:8px;align-items:center}
  .list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
  .list-item{padding:12px;border:1px solid var(--border);border-radius:10px;background:#fff;display:flex;justify-content:space-between;align-items:center}
  .muted{color:var(--muted)}
  .hidden{display:none}
  .toast{position:fixed;right:16px;bottom:16px;background:#111827;color:#fff;padding:10px 12px;border-radius:10px;opacity:0.98}
  .grid{display:grid;gap:12px}
  @media (max-width:960px){
    .layout{grid-template-columns:1fr}
    .sidebar{border-right:0;border-bottom:1px solid var(--border)}
  }
</style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Chuckl. Admin</div>
      <div class="keybox">
        <input id="adminKey" placeholder="Admin Key (x-admin-key)" />
        <button id="saveKeyBtn">Save</button>
      </div>
      <nav id="nav">
        <a class="nav-item" data-route="#/dashboard">Dashboard</a>
        <a class="nav-item" data-route="#/shows">Shows</a>
        <a class="nav-item" data-route="#/venues">Venues</a>
        <a class="nav-item" data-route="#/orders">Orders</a>
        <a class="nav-item" data-route="#/tickets">Tickets</a>
        <a class="nav-item" data-route="#/marketing">Marketing</a>
        <a class="nav-item" data-route="#/customers">Customers</a>
        <a class="nav-item" data-route="#/seating">Seating</a>
        <a class="nav-item" data-route="#/finance">Finance</a>
        <a class="nav-item" data-route="#/settings">Settings</a>
        <a class="nav-item" data-route="#/help">Help</a>
      </nav>
    </aside>

    <main class="content">
      <!-- DASHBOARD -->
      <section id="view-dashboard" class="card">
        <h1>Dashboard</h1>
        <div class="toolbar">
          <button id="loadOverviewBtn" class="btn secondary">Load overview</button>
          <span id="overviewMsg" class="muted"></span>
        </div>
        <p class="muted" style="margin-top:10px">
          Quick links on the left. Use your Admin Key for all API calls. This is a light theme version inspired by Eventbrite-style panels.
        </p>
      </section>

      <!-- VENUES -->
      <section id="view-venues" class="hidden">
        <div class="card">
          <h1>Venues</h1>
          <div class="toolbar">
            <button id="refreshVenuesBtn" class="btn secondary">Refresh venues</button>
            <span id="venuesCount" class="muted"></span>
          </div>
          <div id="venuesList" class="list" style="margin-top:10px"></div>
        </div>

        <div class="card">
          <h2>Create Venue</h2>
          <div class="row-3">
            <div>
              <label>Venue Name</label>
              <input id="v_name" type="text" placeholder="e.g. The Forum Theatre">
            </div>
            <div>
              <label>Capacity (optional)</label>
              <input id="v_capacity" type="text" placeholder="e.g. 650">
            </div>
            <div>
              <label>City</label>
              <input id="v_city" type="text" placeholder="e.g. Malvern">
            </div>
          </div>
          <div class="row">
            <div>
              <label>Address (line)</label>
              <input id="v_address" type="text" placeholder="e.g. 123 High Street">
            </div>
            <div>
              <label>Postcode</label>
              <input id="v_postcode" type="text" placeholder="e.g. WR14 3HB">
            </div>
          </div>
          <div style="margin-top:12px" class="toolbar">
            <button id="createVenueBtn" class="btn">Create Venue</button>
            <span id="venueCreateMsg" class="muted"></span>
          </div>
        </div>
      </section>

      <!-- SHOWS -->
      <section id="view-shows" class="hidden">
        <div class="card">
          <h1>Shows</h1>
          <div class="toolbar">
            <button id="refreshShowsBtn" class="btn secondary">Load latest shows</button>
            <span id="showsCount" class="muted"></span>
          </div>
          <div id="showsList" class="list" style="margin-top:10px"></div>
        </div>

        <div class="card">
          <h2>Create Show</h2>
          <div class="row">
            <div>
              <label>Title</label>
              <input id="s_title" type="text" placeholder="e.g. Chuckl. Bridlington">
            </div>
            <div>
              <label>Date & Time</label>
              <input id="s_datetime" type="datetime-local">
            </div>
          </div>
          <div class="row">
            <div>
              <label>Venue</label>
              <select id="s_venue"></select>
            </div>
            <div>
              <label>Capacity Override (optional)</label>
              <input id="s_capacity" type="text" placeholder="leave blank to use venue capacity">
            </div>
          </div>
          <div class="row">
            <div>
              <label>Poster URL (optional)</label>
              <input id="s_posterUrl" type="text" placeholder="https://…">
            </div>
            <div>
              <label>Description (optional)</label>
              <input id="s_desc" type="text" placeholder="Short description…">
            </div>
          </div>
          <div style="margin-top:12px" class="toolbar">
            <button id="createShowBtn" class="btn">Create Show</button>
            <span id="showCreateMsg" class="muted"></span>
          </div>
        </div>
      </section>

      <!-- PLACEHOLDER SECTIONS -->
      <section id="view-orders" class="card hidden"><h1>Orders</h1><p class="muted">Manage orders, refunds, exports. (Placeholder)</p></section>
      <section id="view-tickets" class="card hidden"><h1>Tickets</h1><p class="muted">Ticket pools, allocations, scanning stats. (Placeholder)</p></section>
      <section id="view-marketing" class="card hidden"><h1>Marketing</h1><p class="muted">Email campaigns, segments, promo codes. (Placeholder)</p></section>
      <section id="view-customers" class="card hidden"><h1>Customers</h1><p class="muted">CRM, cohorts, repeats, GDPR tools. (Placeholder)</p></section>
      <section id="view-seating" class="card hidden"><h1>Seating</h1><p class="muted">Seat maps per venue, pricing zones. (Placeholder)</p></section>
      <section id="view-finance" class="card hidden"><h1>Finance</h1><p class="muted">Payouts, splits, settlements, fees. (Placeholder)</p></section>
      <section id="view-settings" class="card hidden"><h1>Settings</h1><p class="muted">Org, users, roles, webhooks. (Placeholder)</p></section>
      <section id="view-help" class="card hidden"><h1>Help</h1><p class="muted">Docs, support, system status. (Placeholder)</p></section>
    </main>
  </div>

  <div id="toast" class="toast hidden"></div>

<script>
  // --- Helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const toast = $('#toast');
  function showToast(msg){ toast.textContent = msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'), 1800); }

  function getKey(){ return localStorage.getItem('ch_admin_key') || ''; }
  function setKey(k){ localStorage.setItem('ch_admin_key', k || ''); }

  function authHeaders(){
    const k = getKey();
    return k ? { 'x-admin-key': k } : {};
  }

  async function jget(url){
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function jpost(url, body){
    const r = await fetch(url, {
      method:'POST',
      headers: Object.assign({ 'Content-Type':'application/json' }, authHeaders()),
      body: JSON.stringify(body || {})
    });
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try{ const j = await r.json(); msg = j.message || msg; }catch(e){}
      throw new Error(msg);
    }
    return r.json();
  }

  function setActive(route){
    $$('#nav .nav-item').forEach(a=>{
      if (a.getAttribute('data-route') === route) a.classList.add('active');
      else a.classList.remove('active');
    });
  }
  const views = ['dashboard','venues','shows','orders','tickets','marketing','customers','seating','finance','settings','help'];
  function showView(name){
    views.forEach(v=>{
      const el = document.getElementById('view-'+v);
      if (!el) return;
      if (v === name) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
  }

  function go(route){
    if (!route) route = '#/dashboard';
    const name = route.replace('#/','') || 'dashboard';
    setActive(route);
    showView(name);
    // first-load hooks
    if (name==='venues') refreshVenues();
    if (name==='shows'){ refreshVenuesSelect(); refreshShows(); }
  }

  // --- Sidebar nav ---
  $('#nav').addEventListener('click', (e)=>{
    const a = (e.target as HTMLElement).closest('.nav-item');
    if (!a) return;
    e.preventDefault();
    const r = a.getAttribute('data-route');
    if (r) location.hash = r;
  });

  window.addEventListener('hashchange', ()=> go(location.hash));
  // Load saved key
  const keyInput = $('#adminKey'); keyInput.value = getKey();
  $('#saveKeyBtn').addEventListener('click', ()=>{ setKey(keyInput.value.trim()); showToast('Key saved'); });

  // --- Dashboard sample ---
  $('#loadOverviewBtn').addEventListener('click', async ()=>{
    const msg = $('#overviewMsg');
    try{
      const ping = await jget('/admin/bootstrap/ping');
      msg.textContent = 'API OK • ' + new Date().toLocaleTimeString();
      showToast('Overview loaded');
    }catch(err){ msg.textContent = 'Error'; showToast('Failed to load'); }
  });

  // --- Venues ---
  async function refreshVenues(){
    const list = $('#venuesList'); const count = $('#venuesCount');
    list.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const j = await jget('/admin/venues');
      const venues = j.venues || [];
      count.textContent = venues.length + ' venues';
      list.innerHTML = '';
      if (!venues.length){ list.innerHTML = '<div class="muted">No venues yet.</div>'; return; }
      venues.forEach(v=>{
        const div = document.createElement('div'); div.className='list-item';
        const left = document.createElement('div');
        left.innerHTML = '<strong>'+ (v.name||'Untitled') + '</strong><div class="muted">'+ [v.address,v.city,v.postcode].filter(Boolean).join(', ') +'</div>';
        const right = document.createElement('div'); right.className='muted';
        right.textContent = (v.capacity ?? '—') + ' cap';
        div.appendChild(left); div.appendChild(right);
        list.appendChild(div);
      });
    }catch(err){ list.innerHTML = '<div class="muted">Error loading venues.</div>'; }
  }

  $('#refreshVenuesBtn').addEventListener('click', refreshVenues);
  $('#createVenueBtn').addEventListener('click', async ()=>{
    const body:any = {
      name: ($('#v_name') as HTMLInputElement).value.trim(),
      address: ($('#v_address') as HTMLInputElement).value.trim(),
      city: ($('#v_city') as HTMLInputElement).value.trim(),
      postcode: ($('#v_postcode') as HTMLInputElement).value.trim()
    };
    const cap = ($('#v_capacity') as HTMLInputElement).value.trim();
    if (cap) body.capacity = Number(cap);
    try{
      const j = await jpost('/admin/venues', body);
      $('#venueCreateMsg').textContent = 'Created: ' + (j.venue?.name || '');
      showToast('Venue created');
      // refresh both venues list and shows-venue select if user is on shows page later
      refreshVenues(); refreshVenuesSelect();
      // clear
      ['v_name','v_address','v_city','v_postcode','v_capacity'].forEach(id=>{ const el = document.getElementById(id) as HTMLInputElement; if (el) el.value=''; });
    }catch(err:any){ $('#venueCreateMsg').textContent = 'Error: ' + (err.message||''); showToast('Failed to create venue'); }
  });

  async function refreshVenuesSelect(){
    const sel = $('#s_venue') as HTMLSelectElement;
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    try{
      const j = await jget('/admin/venues');
      const venues = j.venues || [];
      sel.innerHTML = '<option value="">Select venue…</option>';
      venues.forEach(v=>{
        const opt = document.createElement('option');
        opt.value = v.id; opt.textContent = v.name || 'Untitled';
        sel.appendChild(opt);
      });
    }catch(err){ sel.innerHTML = '<option value="">Error loading venues</option>'; }
  }

  // --- Shows ---
  async function refreshShows(){
    const list = $('#showsList'); const count = $('#showsCount');
    list.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const j = await jget('/admin/shows/latest?limit=20');
      const shows = j.shows || [];
      count.textContent = shows.length + ' shows';
      list.innerHTML = '';
      if (!shows.length){ list.innerHTML='<div class="muted">No shows yet.</div>'; return; }
      shows.forEach(s=>{
        const div = document.createElement('div'); div.className='list-item';
        const left = document.createElement('div');
        const when = new Date(s.date).toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
        const venue = s.venue ? (s.venue.name || '') : '';
        left.innerHTML = '<strong>'+ s.title +'</strong><div class="muted">'+ when + (venue ? ' @ '+venue : '') +'</div>';
        const right = document.createElement('div'); right.className='muted';
        const stats = s._count ? ('tickets: '+ s._count.tickets + ' • orders: ' + s._count.orders) : '';
        right.textContent = stats;
        div.appendChild(left); div.appendChild(right);
        list.appendChild(div);
      });
    }catch(err){ list.innerHTML = '<div class="muted">Error loading shows.</div>'; }
  }
  $('#refreshShowsBtn').addEventListener('click', refreshShows);

  $('#createShowBtn').addEventListener('click', async ()=>{
    const title = ($('#s_title') as HTMLInputElement).value.trim();
    const dt = ($('#s_datetime') as HTMLInputElement).value;
    const venueId = ($('#s_venue') as HTMLSelectElement).value;
    const cap = ($('#s_capacity') as HTMLInputElement).value.trim();
    const desc = ($('#s_desc') as HTMLInputElement).value.trim();
    const posterUrl = ($('#s_posterUrl') as HTMLInputElement).value.trim();

    if (!title || !dt || !venueId){ $('#showCreateMsg').textContent = 'Title, Date/Time and Venue are required'; showToast('Missing fields'); return; }

    const body:any = { title, date: new Date(dt).toISOString(), venueId, description: desc || null, posterUrl: posterUrl || null };
    if (cap) body.capacityOverride = Number(cap);

    try{
      await jpost('/admin/shows', body);
      $('#showCreateMsg').textContent = 'Show created';
      showToast('Show created');
      refreshShows();
      // clear fields
      ['s_title','s_datetime','s_capacity','s_desc','s_posterUrl'].forEach(id=>{ const el = document.getElementById(id) as HTMLInputElement; if (el) el.value=''; });
      (document.getElementById('s_venue') as HTMLSelectElement).value='';
    }catch(err:any){
      $('#showCreateMsg').textContent = 'Error: ' + (err.message||'');
      showToast('Failed to create show');
    }
  });

  // Initial route
  if (!location.hash) location.hash = '#/dashboard';
  go(location.hash);
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
