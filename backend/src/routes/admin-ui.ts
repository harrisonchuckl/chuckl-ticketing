// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

/**
 * Lightweight, dependency-free SPA served as one HTML file.
 * - Tailwind via CDN for Eventbrite-like light UI.
 * - Hash router (#/dashboard, #/shows, etc).
 * - Admin key stored in localStorage (ck_admin_key) and sent as x-admin-key.
 */

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Chuckl. Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --brand:#111827;        /* slate-900 for headings */
      --ink:#0f172a;          /* slate-900 text */
      --muted:#475569;        /* slate-600 */
      --line:#e2e8f0;         /* slate-200 borders */
      --bg:#f8fafc;           /* slate-50 app bg */
      --card:#ffffff;         /* white cards */
      --primary:#2563eb;      /* blue-600 (buttons/links) */
      --primary-ink:#ffffff;  /* on-primary text */
    }
    html,body { height:100% }
    body { background:var(--bg); color:var(--ink) }
    .sidebar a.active { background:#eef2ff; color:#3730a3; } /* indigo-800-ish */
    .card { background:var(--card); border:1px solid var(--line); border-radius:12px }
    .btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem .9rem; border-radius:.6rem; border:1px solid var(--line); background:#fff; }
    .btn-primary{ background:var(--primary); color:var(--primary-ink); border-color:var(--primary) }
    .btn-light{ background:#fff }
    .kbd{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; background:#f1f5f9; border:1px solid var(--line); border-bottom-width:2px; padding:.1rem .35rem; border-radius:.35rem; font-size:.8rem }
    .input, select, textarea { border:1px solid var(--line); border-radius:.6rem; padding:.55rem .7rem; background:#fff }
    .table th{ text-align:left; font-weight:600; color:var(--muted); font-size:.85rem; border-bottom:1px solid var(--line); padding:.6rem .75rem }
    .table td{ border-bottom:1px solid var(--line); padding:.7rem .75rem; }
    .badge{ display:inline-block; padding:.15rem .5rem; border-radius:999px; background:#eef2ff; color:#3730a3; font-size:.75rem }
    .subtle{ color:var(--muted) }
    .hint{ font-size:.8rem; color:var(--muted) }
    .ghost-link{ color:var(--muted); text-decoration:underline }
  </style>
</head>
<body class="min-h-full">
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="sidebar w-60 shrink-0 border-r border-slate-200 bg-white">
      <div class="p-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-black"></div>
          <div>
            <div class="font-semibold text-slate-900">Chuckl. Admin</div>
            <div class="text-xs text-slate-500">Organiser Console</div>
          </div>
        </div>
      </div>

      <div class="p-4 space-y-3">
        <div class="space-y-2">
          <div class="text-xs uppercase tracking-wide text-slate-500">API</div>
          <div class="flex gap-2">
            <input id="adminKey" class="input w-full" placeholder="Admin Key" />
            <button id="saveKeyBtn" class="btn btn-light">Save</button>
          </div>
          <div class="hint">Saved as <span class="font-mono">ck_admin_key</span>. Sent on requests as <span class="font-mono">x-admin-key</span>.</div>
        </div>

        <nav class="pt-2 grid gap-1 text-sm">
          <a href="#/dashboard" class="px-3 py-2 rounded-md hover:bg-slate-50">Dashboard</a>
          <a href="#/shows" class="px-3 py-2 rounded-md hover:bg-slate-50">Shows</a>
          <a href="#/tickets" class="px-3 py-2 rounded-md hover:bg-slate-50">Tickets</a>
          <a href="#/orders" class="px-3 py-2 rounded-md hover:bg-slate-50">Orders</a>
          <a href="#/marketing" class="px-3 py-2 rounded-md hover:bg-slate-50">Marketing</a>
          <a href="#/customers" class="px-3 py-2 rounded-md hover:bg-slate-50">Customers</a>
          <a href="#/seating" class="px-3 py-2 rounded-md hover:bg-slate-50">Seating</a>
          <a href="#/reports" class="px-3 py-2 rounded-md hover:bg-slate-50">Reports</a>
          <a href="#/finance" class="px-3 py-2 rounded-md hover:bg-slate-50">Finance</a>
          <a href="#/access" class="px-3 py-2 rounded-md hover:bg-slate-50">Access Control</a>
          <a href="#/settings" class="px-3 py-2 rounded-md hover:bg-slate-50">Settings</a>
          <a href="#/help" class="px-3 py-2 rounded-md hover:bg-slate-50">Help</a>
        </nav>
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto">
      <header class="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
        <div class="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <h1 id="pageTitle" class="text-xl font-semibold text-slate-900">Dashboard</h1>
          <div class="flex items-center gap-2">
            <button id="reloadBtn" class="btn">Reload</button>
            <a href="#/shows/new" class="btn btn-primary">Create Show</a>
          </div>
        </div>
      </header>

      <section id="page" class="mx-auto max-w-6xl p-6">
        <!-- content swaps here -->
      </section>

      <footer class="mx-auto max-w-6xl px-6 pb-8 text-xs text-slate-500">
        Inspired by Eventbrite & SeeTickets consoles • UI shell v1.0
      </footer>
    </main>
  </div>

  <template id="tpl-dashboard">
    <div class="grid md:grid-cols-3 gap-4">
      <div class="card p-4">
        <div class="text-sm subtle">Total Tickets (last 7 days)</div>
        <div class="text-2xl font-semibold mt-1" id="dashTickets">—</div>
        <div class="hint mt-2">Loaded from <span class="font-mono">/admin/shows/latest</span></div>
      </div>
      <div class="card p-4">
        <div class="text-sm subtle">Upcoming Shows</div>
        <div class="text-2xl font-semibold mt-1" id="dashShows">—</div>
        <div class="hint mt-2">Next 20 by date</div>
      </div>
      <div class="card p-4">
        <div class="text-sm subtle">Status</div>
        <div class="mt-2"><span id="dashStatus" class="badge">Waiting for data…</span></div>
      </div>
    </div>

    <div class="card p-4 mt-6">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Quick Links</h2>
        <div class="text-sm">
          Press <span class="kbd">R</span> to reload
        </div>
      </div>
      <ul class="mt-3 text-sm list-disc pl-6 space-y-1">
        <li><a class="text-blue-700 underline" href="#/shows">Manage Shows</a></li>
        <li><a class="text-blue-700 underline" href="#/tickets">Ticket Types</a></li>
        <li><a class="text-blue-700 underline" href="#/orders">Order Management</a></li>
        <li><a class="text-blue-700 underline" href="#/marketing">Marketing Tools</a></li>
        <li><a class="text-blue-700 underline" href="#/reports">Reports & Analytics</a></li>
        <li><a class="text-blue-700 underline" href="#/finance">Payouts</a></li>
      </ul>
    </div>
  </template>

  <template id="tpl-shows">
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Shows</h2>
        <a href="#/shows/new" class="btn btn-primary">New Show</a>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button id="btnLoadShows" class="btn">Load latest shows</button>
        <div class="hint">GET <span class="font-mono">/admin/shows/latest?limit=20</span></div>
      </div>
      <div class="overflow-x-auto mt-4">
        <table class="table w-full">
          <thead><tr>
            <th>Title</th><th>Date</th><th>Venue</th><th>Tickets</th><th>Actions</th>
          </tr></thead>
          <tbody id="showsTbody"><tr><td colspan="5" class="py-8 text-center text-slate-500">No data yet.</td></tr></tbody>
        </table>
      </div>
    </div>
  </template>

  <template id="tpl-show-new">
    <div class="card p-4">
      <h2 class="font-semibold">Create Show</h2>
      <div class="grid md:grid-cols-2 gap-4 mt-3">
        <div class="space-y-2">
          <label class="text-sm subtle">Title</label>
          <input id="newTitle" class="input w-full" placeholder="e.g. Chuckl. Cheltenham" />
        </div>
        <div class="space-y-2">
          <label class="text-sm subtle">Date & Time</label>
          <input id="newDate" type="datetime-local" class="input w-full" />
        </div>
        <div class="space-y-2">
          <label class="text-sm subtle">Venue</label>
          <select id="newVenue" class="input w-full"></select>
          <div class="hint">Can’t find it? <a href="#/settings/venues" class="text-blue-700 underline">Create a venue</a>.</div>
        </div>
        <div class="space-y-2">
          <label class="text-sm subtle">Capacity Override (optional)</label>
          <input id="newCap" type="number" min="0" class="input w-full" placeholder="leave blank to use venue capacity" />
        </div>
        <div class="md:col-span-2 space-y-2">
          <label class="text-sm subtle">Description (optional)</label>
          <textarea id="newDesc" rows="4" class="input w-full" placeholder="Short description…"></textarea>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-4">
        <button id="btnCreateShow" class="btn btn-primary">Create Show</button>
        <a href="#/shows" class="btn">Cancel</a>
      </div>
      <div id="newShowMsg" class="mt-3 hint"></div>
    </div>
  </template>

  <template id="tpl-tickets">
    <div class="card p-4">
      <h2 class="font-semibold">Ticket Types</h2>
      <div class="grid md:grid-cols-3 gap-3 mt-3">
        <div><label class="text-sm subtle">Select a Show</label>
          <select id="ticketsShowSel" class="input w-full"></select>
        </div>
        <div class="md:col-span-2 flex items-end gap-2">
          <button id="btnLoadTicketTypes" class="btn">Load ticket types</button>
          <span class="hint">Placeholders wired for /admin/tickettypes (next step)</span>
        </div>
      </div>

      <div class="overflow-x-auto mt-4">
        <table class="table w-full">
          <thead><tr><th>Name</th><th>Price</th><th>Available</th><th></th></tr></thead>
          <tbody id="ticketTypesTbody">
            <tr><td colspan="4" class="py-8 text-center text-slate-500">No show selected.</td></tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6">
        <h3 class="font-semibold">Create a Ticket Type</h3>
        <div class="grid md:grid-cols-4 gap-3 mt-2">
          <input id="ttName" class="input" placeholder="General Admission" />
          <input id="ttPrice" class="input" type="number" placeholder="Price (pence)" />
          <input id="ttAvail" class="input" type="number" placeholder="Available" />
          <button id="btnCreateTT" class="btn btn-primary">Add Ticket</button>
        </div>
        <div class="hint mt-2">This posts to <span class="font-mono">/admin/tickettypes/:showId</span> (we’ll enable after you confirm routes).</div>
      </div>
    </div>
  </template>

  <template id="tpl-orders">
    <div class="card p-4">
      <h2 class="font-semibold">Order Management</h2>
      <div class="grid md:grid-cols-3 gap-3 mt-3">
        <input id="orderQuery" class="input" placeholder="Search order #, buyer or email" />
        <select id="orderScope" class="input">
          <option value="buyer">Buyer</option>
          <option value="email">Email</option>
          <option value="order">Order #</option>
        </select>
        <button id="btnLoadOrders" class="btn">Load Orders</button>
      </div>
      <div class="hint mt-2">Eventbrite-style: edit buyer info, resend tickets, refunds (placeholders for now).</div>
      <div class="overflow-x-auto mt-4">
        <table class="table w-full">
          <thead><tr><th>When</th><th>Order #</th><th>Buyer</th><th>Show</th><th>Total</th><th>Status</th></tr></thead>
          <tbody id="ordersTbody"><tr><td colspan="6" class="py-8 text-center text-slate-500">Not loaded.</td></tr></tbody>
        </table>
      </div>
    </div>
  </template>

  <template id="tpl-marketing">
    <div class="card p-4">
      <h2 class="font-semibold">Marketing Tools</h2>
      <p class="hint mt-1">Placeholders for: Email Campaigns, Social Push, Paid Ads, Promotions, URL Shortener, Link Builder.</p>

      <div class="grid md:grid-cols-3 gap-4 mt-4">
        <div class="card p-4">
          <h3 class="font-semibold">Email Campaigns</h3>
          <p class="hint">Create & schedule emails to tagged audiences (Comedy, Theatre, Music…).</p>
          <button class="btn mt-3">Open Email Composer</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Social Media</h3>
          <p class="hint">Quick shares for Facebook/Instagram; pull assets from show.</p>
          <button class="btn mt-3">Share Show</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Paid Ads</h3>
          <p class="hint">Boost events with pre-filled audiences (meta pixel ready).</p>
          <button class="btn mt-3">Create Campaign</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Promotions</h3>
          <p class="hint">Offer codes, presales, allocations by partner.</p>
          <button class="btn mt-3">New Promotion</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">URL Shortener</h3>
          <p class="hint">Generate short tracking links for shows.</p>
          <button class="btn mt-3">Shorten URL</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Link Generator</h3>
          <p class="hint">Build campaign links with UTM tags (FB/IG/Email).</p>
          <button class="btn mt-3">Generate Link</button>
        </div>
      </div>
    </div>
  </template>

  <template id="tpl-customers">
    <div class="card p-4">
      <h2 class="font-semibold">Customers</h2>
      <p class="hint">Audience manager: search, segments, tags, import/export (placeholders).</p>
      <div class="grid md:grid-cols-3 gap-3 mt-3">
        <input class="input" placeholder="Search name or email…" />
        <select class="input"><option>All segments</option><option>Comedy</option><option>Theatre</option></select>
        <button class="btn">Search</button>
      </div>
      <div class="mt-4 hint">Future: import CSV, dedupe, category tags auto-applied on purchase.</div>
    </div>
  </template>

  <template id="tpl-seating">
    <div class="card p-4">
      <h2 class="font-semibold">Seating / Area Config</h2>
      <p class="hint">SeeTickets-style access control configs (placeholders).</p>
      <div class="mt-4">
        <button class="btn">Create Area Configuration</button>
      </div>
    </div>
  </template>

  <template id="tpl-reports">
    <div class="card p-4">
      <h2 class="font-semibold">Reports & Analytics</h2>
      <div class="grid md:grid-cols-3 gap-4 mt-4">
        <div class="card p-4">
          <h3 class="font-semibold">Sales</h3>
          <p class="hint">Overview of ticket sales by event.</p>
          <button class="btn mt-2">Open Sales Report</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Orders</h3>
          <p class="hint">Buyer details incl. fees & tax breakdown.</p>
          <button class="btn mt-2">Open Orders Report</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Audit</h3>
          <p class="hint">Sold/available seats snapshot.</p>
          <button class="btn mt-2">Open Audit</button>
        </div>
      </div>
    </div>
  </template>

  <template id="tpl-finance">
    <div class="card p-4">
      <h2 class="font-semibold">Finance</h2>
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <div class="card p-4">
          <h3 class="font-semibold">Payouts</h3>
          <p class="hint">View settlement batches, export CSV.</p>
          <button class="btn mt-2">View Payouts</button>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Charges & Credits</h3>
          <p class="hint">Adjustments, refunds, PRS exemptions (placeholder).</p>
          <button class="btn mt-2">Open Adjustments</button>
        </div>
      </div>
    </div>
  </template>

  <template id="tpl-access">
    <div class="card p-4">
      <h2 class="font-semibold">Access Control</h2>
      <p class="hint">Scanner dashboard, device config, external barcodes, max scan adjustments, feedback (placeholders).</p>
      <div class="mt-4">
        <button class="btn">Open Scanner Dashboard</button>
        <button class="btn">Manage Devices</button>
      </div>
    </div>
  </template>

  <template id="tpl-settings">
    <div class="card p-4">
      <h2 class="font-semibold">Settings</h2>
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <div class="card p-4">
          <h3 class="font-semibold">Venues</h3>
          <p class="hint">Create & manage venues used across shows.</p>
          <a href="#/settings/venues" class="btn mt-2">Manage Venues</a>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold">Organisation</h3>
          <p class="hint">Brand, logos, email domains, payout details.</p>
          <button class="btn mt-2">Open Org Profile</button>
        </div>
      </div>
    </div>
  </template>

  <template id="tpl-settings-venues">
    <div class="card p-4">
      <h2 class="font-semibold">Venues</h2>
      <div class="grid md:grid-cols-5 gap-3 mt-3">
        <input id="vName" class="input" placeholder="Venue Name" />
        <input id="vCap" type="number" class="input" placeholder="Capacity" />
        <input id="vAddr" class="input" placeholder="Address line" />
        <input id="vCity" class="input" placeholder="City" />
        <input id="vPost" class="input" placeholder="Postcode" />
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button id="btnCreateVenue" class="btn btn-primary">Create Venue</button>
        <button id="btnLoadVenues" class="btn">Load Venues</button>
      </div>
      <div class="overflow-x-auto mt-4">
        <table class="table w-full">
          <thead><tr><th>Name</th><th>City</th><th>Postcode</th><th>Capacity</th></tr></thead>
          <tbody id="venuesTbody"><tr><td colspan="4" class="py-8 text-center text-slate-500">No data.</td></tr></tbody>
        </table>
      </div>
    </div>
  </template>

  <template id="tpl-help">
    <div class="card p-4">
      <h2 class="font-semibold">Help</h2>
      <p class="hint">Docs, FAQs, support contact. Keyboard: <span class="kbd">R</span> reload, <span class="kbd">/</span> focus nav.</p>
    </div>
  </template>

  <script>
    // ---------- tiny helpers ----------
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

    const api = {
      key() { return localStorage.getItem('ck_admin_key') || ''; },
      headers() { return { 'x-admin-key': this.key(), 'content-type': 'application/json' }; },
      async get(path) {
        const res = await fetch(path, { headers: this.headers() });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      },
      async post(path, body) {
        const res = await fetch(path, { method:'POST', headers: this.headers(), body: JSON.stringify(body||{}) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }
    };

    // ---------- state ----------
    let showsCache = [];

    // ---------- routing ----------
    const routes = {
      '#/dashboard': renderDashboard,
      '#/shows': renderShows,
      '#/shows/new': renderShowNew,
      '#/tickets': renderTickets,
      '#/orders': renderOrders,
      '#/marketing': renderMarketing,
      '#/customers': renderCustomers,
      '#/seating': renderSeating,
      '#/reports': renderReports,
      '#/finance': renderFinance,
      '#/access': renderAccess,
      '#/settings': renderSettings,
      '#/settings/venues': renderSettingsVenues,
      '#/help': renderHelp
    };

    function setTitle(t){ $('#pageTitle').textContent = t; }

    function mount(tplId){
      const node = document.importNode($(tplId).content, true);
      const page = $('#page'); page.innerHTML = ''; page.appendChild(node);
      highlightActive();
    }

    function highlightActive(){
      $$('.sidebar a').forEach(a => a.classList.remove('active'));
      const a = $('.sidebar a[href="'+location.hash+'"]');
      if (a) a.classList.add('active');
    }

    function ensureKeyUI(){
      const input = $('#adminKey');
      input.value = api.key();
      $('#saveKeyBtn').onclick = () => {
        localStorage.setItem('ck_admin_key', input.value.trim());
        alert('Saved admin key.');
      };
    }

    // ---------- pages ----------
    async function renderDashboard(){
      setTitle('Dashboard');
      mount('#tpl-dashboard');
      try{
        const data = await api.get('/admin/shows/latest?limit=20');
        showsCache = data.shows || [];
        $('#dashShows').textContent = showsCache.length;
        const totalTickets = showsCache.reduce((n,s)=> n + ((s._count && s._count.tickets) || 0), 0);
        $('#dashTickets').textContent = totalTickets;
        $('#dashStatus').textContent = 'Connected';
        $('#dashStatus').className = 'badge';
      }catch(e){
        $('#dashStatus').textContent = 'Unauthorized / Error';
        $('#dashStatus').className = 'badge';
      }
    }

    async function renderShows(){
      setTitle('Shows');
      mount('#tpl-shows');
      $('#btnLoadShows').onclick = async () => {
        try{
          const data = await api.get('/admin/shows/latest?limit=20');
          showsCache = data.shows || [];
          const tbody = $('#showsTbody'); tbody.innerHTML = '';
          if (showsCache.length===0){
            tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500">No shows found.</td></tr>';
            return;
          }
          for (const s of showsCache){
            const tr = document.createElement('tr');
            const tickets = (s._count && s._count.tickets) || 0;
            tr.innerHTML = \`
              <td>\${s.title}</td>
              <td>\${new Date(s.date).toLocaleString()}</td>
              <td>\${s.venue?.name || '-'}</td>
              <td>\${tickets}</td>
              <td><a class="text-blue-700 underline" href="#/tickets" title="Manage tickets">Manage tickets</a></td>
            \`;
            tbody.appendChild(tr);
          }
        }catch(e){
          alert('Failed to load shows. Is your admin key correct?');
        }
      };
    }

    async function renderShowNew(){
      setTitle('Create Show');
      mount('#tpl-show-new');
      // load venues for dropdown
      try{
        const venues = await api.get('/admin/venues');
        const sel = $('#newVenue'); sel.innerHTML = '';
        for(const v of venues){
          const opt = document.createElement('option');
          opt.value = v.id; opt.textContent = v.name + (v.city? ' – ' + v.city : '');
          sel.appendChild(opt);
        }
      }catch(e){
        $('#newShowMsg').textContent = 'Could not load venues. Create one in Settings > Venues.';
      }

      $('#btnCreateShow').onclick = async ()=>{
        const title = $('#newTitle').value.trim();
        const date  = $('#newDate').value;
        const venueId = $('#newVenue').value;
        const cap = $('#newCap').value;
        const description = $('#newDesc').value.trim();
        if (!title || !date || !venueId) { alert('Please fill Title, Date & Venue.'); return; }
        try{
          const payload:any = { title, date, venueId, description };
          if (cap) payload.capacityOverride = Number(cap);
          const res = await api.post('/admin/shows', payload);
          $('#newShowMsg').textContent = 'Show created. Return to Shows to view.';
        }catch(e){
          $('#newShowMsg').textContent = 'Failed to create show (check key/inputs).';
        }
      };
    }

    async function renderTickets(){
      setTitle('Tickets');
      mount('#tpl-tickets');
      // load shows into select
      try{
        if (!showsCache.length){
          const data = await api.get('/admin/shows/latest?limit=50');
          showsCache = data.shows || [];
        }
        const sel = $('#ticketsShowSel'); sel.innerHTML = '';
        for (const s of showsCache){
          const opt = document.createElement('option');
          opt.value = s.id; opt.textContent = s.title + ' – ' + new Date(s.date).toLocaleDateString();
          sel.appendChild(opt);
        }
      }catch(e){ /* ignore */ }

      $('#btnLoadTicketTypes').onclick = async ()=>{
        const showId = ($('#ticketsShowSel') as HTMLSelectElement).value;
        if (!showId){ alert('Pick a show'); return; }
        // Placeholder: render nothing yet, ready for your /admin-tickettypes routes.
        const tbody = $('#ticketTypesTbody');
        tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-500">Ticket API not wired yet. Ready for next step.</td></tr>';
      };

      $('#btnCreateTT').onclick = async ()=>{
        alert('This will POST to /admin/tickettypes/:showId in the next step.');
      };
    }

    function renderOrders(){
      setTitle('Orders');
      mount('#tpl-orders');
      $('#btnLoadOrders').onclick = ()=>{
        $('#ordersTbody').innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">Orders API coming next.</td></tr>';
      };
    }

    function renderMarketing(){ setTitle('Marketing'); mount('#tpl-marketing'); }
    function renderCustomers(){ setTitle('Customers'); mount('#tpl-customers'); }
    function renderSeating(){ setTitle('Seating / Area Config'); mount('#tpl-seating'); }
    function renderReports(){ setTitle('Reports & Analytics'); mount('#tpl-reports'); }
    function renderFinance(){ setTitle('Finance'); mount('#tpl-finance'); }
    function renderAccess(){ setTitle('Access Control'); mount('#tpl-access'); }
    function renderSettings(){ setTitle('Settings'); mount('#tpl-settings'); }

    async function renderSettingsVenues(){
      setTitle('Settings · Venues');
      mount('#tpl-settings-venues');

      $('#btnLoadVenues').onclick = async ()=>{
        try{
          const venues = await api.get('/admin/venues');
          const tbody = $('#venuesTbody'); tbody.innerHTML = '';
          if (!venues || !venues.length){
            tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-500">No venues yet.</td></tr>';
            return;
          }
          for (const v of venues){
            const tr = document.createElement('tr');
            tr.innerHTML = \`<td>\${v.name}</td><td>\${v.city||'-'}</td><td>\${v.postcode||'-'}</td><td>\${v.capacity??'-'}</td>\`;
            tbody.appendChild(tr);
          }
        }catch(e){ alert('Failed to load venues'); }
      };

      $('#btnCreateVenue').onclick = async ()=>{
        const name  = $('#vName').value.trim();
        const cap   = $('#vCap').value.trim();
        const addr  = $('#vAddr').value.trim();
        const city  = $('#vCity').value.trim();
        const post  = $('#vPost').value.trim();
        if(!name){ alert('Venue name required'); return; }
        try{
          await api.post('/admin/venues', {
            name, capacity: cap ? Number(cap) : null, address: addr, city, postcode: post
          });
          alert('Venue created.');
        }catch(e){ alert('Failed to create venue'); }
      };
    }

    function renderHelp(){ setTitle('Help'); mount('#tpl-help'); }

    // ---------- boot ----------
    function boot(){
      ensureKeyUI();
      $('#reloadBtn').onclick = ()=> route();
      window.addEventListener('hashchange', route);
      window.addEventListener('keydown', (e)=>{
        if (e.key==='r' || e.key==='R') route();
        if (e.key==='/') { e.preventDefault(); $('.sidebar nav a')?.focus(); }
      });
      if (!location.hash) location.hash = '#/dashboard';
      route();
    }

    function route(){
      const h = location.hash;
      (routes[h] || renderDashboard)();
      highlightActive();
    }

    boot();
  </script>
</body>
</html>`;

router.get(['/ui', '/ui/'], (_req: Request, res: Response) => {
  res.status(200).type('html').send(html);
});

export default router;
