// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * Admin UI (hash router). Pure JS in <script> (no TS assertions).
 * Views: #home #shows #orders #venues #analytics #audiences #email #account
 */
router.get('/ui', requireAdminOrOrganiser, async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Organiser Console</title>
  <style>
    :root {
      --bg: #f7f8fb;
      --panel: #ffffff;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
    }
    html, body { margin:0; padding:0; height:100%; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); background: var(--bg); }
    .wrap { display:flex; min-height:100vh; }
    .sidebar { width: 220px; background:#fff; border-right:1px solid var(--border); padding:16px 12px; position:sticky; top:0; height:100vh; box-sizing:border-box; }
    .sb-group { font-size:12px; letter-spacing:.04em; color:var(--muted); margin:14px 8px 6px; text-transform:uppercase; }
    .sb-link { display:block; padding:10px 12px; margin:4px 4px; border-radius:8px; color:#111827; text-decoration:none; }
    .sb-link.active, .sb-link:hover { background:#f1f5f9; }
    .content { flex:1; padding:20px; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .title { font-weight:600; }
    .muted { color:var(--muted); }
    .kpis { display:grid; grid-template-columns: repeat(4, minmax(160px,1fr)); gap:12px; }
    .kpi { background:#fff; border:1px solid var(--border); border-radius:12px; padding:12px; }
    .kpi .label { font-size:12px; color:var(--muted); }
    .kpi .value { font-size:20px; font-weight:700; margin-top:6px; }
    .btn { appearance:none; border:1px solid var(--border); background:#fff; border-radius:8px; padding:8px 12px; cursor:pointer; }
    .btn:hover { background:#f9fafb; }
    .toolbar { display:flex; gap:8px; flex-wrap:wrap; }
    .row { display:flex; gap:8px; flex-wrap:wrap; }
    input, select { border:1px solid var(--border); border-radius:8px; padding:8px 10px; background:#fff; outline:none; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { text-align:left; padding:10px; border-bottom:1px solid var(--border); }
    th { font-weight:600; color:#334155; background:#f8fafc; }
    .right { text-align:right; }
    .error { color:#b91c1c; }
  </style>
</head>
<body>
  <div class="wrap">
    <aside class="sidebar" id="sidebar">
      <div class="sb-group">Dashboard</div>
      <a class="sb-link" href="#home" data-view="home">Home</a>
      <div class="sb-group">Manage</div>
      <a class="sb-link" href="#shows" data-view="shows">Shows</a>
      <a class="sb-link" href="#orders" data-view="orders">Orders</a>
      <a class="sb-link" href="#venues" data-view="venues">Venues</a>
      <div class="sb-group">Insights</div>
      <a class="sb-link" href="#analytics" data-view="analytics">Analytics</a>
      <div class="sb-group">Marketing</div>
      <a class="sb-link" href="#audiences" data-view="audiences">Audiences</a>
      <a class="sb-link" href="#email" data-view="email">Email Campaigns</a>
      <div class="sb-group">Settings</div>
      <a class="sb-link" href="#account" data-view="account">Account</a>
      <a class="sb-link" href="/auth/logout">Log out</a>
    </aside>

    <main class="content" id="main">
      <div class="card"><div class="title">Loading...</div></div>
    </main>
  </div>

<script>
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function setActive(view){
    $$('.sb-link').forEach(a => {
      const v = a.getAttribute('data-view');
      a.classList.toggle('active', v === view);
    });
  }

  function setMain(html){ $('#main').innerHTML = html; }

  function route(){
    const hash = (location.hash || '#home').replace('#','');
    setActive(hash);
    switch(hash){
      case 'home': return renderHome();
      case 'shows': return renderShows();
      case 'orders': return renderOrders();
      case 'venues': return renderVenues();
      case 'analytics': return renderAnalytics();
      case 'audiences': return renderAudiences();
      case 'email': return renderEmail();
      case 'account': return renderAccount();
      default: return renderHome();
    }
  }

  async function getJSON(url){
    const r = await fetch(url, { credentials: 'include' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  const fmtP = (p) => '£' + (Number(p||0)/100).toFixed(2);

  // HOME
  async function renderHome(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Welcome</div></div>
        <div class="muted">Welcome to your organiser console. Use the menu to manage shows, orders, venues, insights and marketing.</div>
      </div>
      <div class="card" id="kpiCard">
        <div class="header">
          <div class="title">Dashboard KPIs</div>
          <div class="toolbar"><button class="btn" id="kpiRefresh">Refresh</button></div>
        </div>
        <div id="kpiBody" class="kpis">
          <div class="kpi"><div class="label">Orders (Last 7d)</div><div class="value" id="kpi_o7">—</div></div>
          <div class="kpi"><div class="label">GMV (Last 7d)</div><div class="value" id="kpi_g7">—</div></div>
          <div class="kpi"><div class="label">Our Fees (Last 7d)</div><div class="value" id="kpi_f7">—</div></div>
          <div class="kpi"><div class="label">Net Payout (Last 7d)</div><div class="value" id="kpi_n7">—</div></div>
          <div class="kpi"><div class="label">Orders (MTD)</div><div class="value" id="kpi_om">—</div></div>
          <div class="kpi"><div class="label">GMV (MTD)</div><div class="value" id="kpi_gm">—</div></div>
          <div class="kpi"><div class="label">Our Fees (MTD)</div><div class="value" id="kpi_fm">—</div></div>
          <div class="kpi"><div class="label">Net Payout (MTD)</div><div class="value" id="kpi_nm">—</div></div>
        </div>
        <div style="height:8px"></div>
        <div id="kpiErr" class="error"></div>
      </div>
    \`);

    async function loadKPIs(){
      try{
        $('#kpiErr').textContent = '';
        const j = await getJSON('/admin/analytics/summary');
        if(!j.ok) throw new Error('Bad response');
        const s = j.summary || {};
        $('#kpi_o7').textContent = s.last7 && s.last7.orders || 0;
        $('#kpi_g7').textContent = fmtP(s.last7 && s.last7.gmvPence);
        $('#kpi_f7').textContent = fmtP(s.last7 && s.last7.ourFeesPence);
        $('#kpi_n7').textContent = fmtP(s.last7 && s.last7.netPayoutPence);
        $('#kpi_om').textContent = s.mtd && s.mtd.orders || 0;
        $('#kpi_gm').textContent = fmtP(s.mtd && s.mtd.gmvPence);
        $('#kpi_fm').textContent = fmtP(s.mtd && s.mtd.ourFeesPence);
        $('#kpi_nm').textContent = fmtP(s.mtd && s.mtd.netPayoutPence);
      } catch(e){
        $('#kpiErr').textContent = 'Failed to load KPIs';
      }
    }
    $('#kpiRefresh') && $('#kpiRefresh').addEventListener('click', loadKPIs);
    loadKPIs();
  }

  // SHOWS
  async function renderShows(){
    setMain(\`
      <div class="card">
        <div class="header">
          <div class="title">Shows</div>
          <div class="toolbar"><button class="btn" id="btnRefresh">Refresh</button></div>
        </div>
        <div id="err" class="error"></div>
        <div style="height:8px"></div>
        <table id="tbl"><thead>
          <tr><th>Title</th><th>Date</th><th>Venue</th></tr>
        </thead><tbody></tbody></table>
      </div>
    \`);
    async function load(){
      try{
        $('#err').textContent = '';
        const j = await getJSON('/admin/shows');
        if(!j.ok) throw new Error();
        const tbody = $('#tbl tbody');
        tbody.innerHTML = (j.items||[]).map(it => \`
          <tr>
            <td>\${it.title || ''}</td>
            <td>\${it.date ? new Date(it.date).toLocaleString() : ''}</td>
            <td>\${it.venue && it.venue.name || ''}</td>
          </tr>\`).join('');
      }catch(e){ $('#err').textContent = 'Failed to load shows'; }
    }
    const r = $('#btnRefresh'); r && r.addEventListener('click', load);
    load();
  }

  // ORDERS
  async function renderOrders(){
    setMain(\`
      <div class="card">
        <div class="header">
          <div class="title">Orders</div>
          <form id="searchForm" class="row" style="gap:8px">
            <input type="text" id="q" placeholder="Search email / Stripe / show" />
            <input type="date" id="from" />
            <input type="date" id="to" />
            <button class="btn" type="submit">Search</button>
            <a class="btn" id="btnExport" href="/admin/orders/export.csv">Export CSV</a>
          </form>
        </div>
        <div id="err" class="error"></div>
        <div style="height:8px"></div>
        <table id="tbl"><thead>
          <tr>
            <th>When</th><th>Email</th><th>Show</th><th>Status</th>
            <th class="right">Amount</th><th class="right">Platform fee</th><th class="right">Net payout</th>
          </tr>
        </thead><tbody></tbody></table>
      </div>
    \`);

    const form = $('#searchForm');
    const q = $('#q'), from = $('#from'), to = $('#to'), exportBtn = $('#btnExport');

    function buildQS(){
      const u = new URLSearchParams();
      if(q && q.value.trim()) u.set('q', q.value.trim());
      if(from && from.value) u.set('from', from.value);
      if(to && to.value) u.set('to', to.value);
      return u.toString();
    }
    function setExportHref(){
      const qs = buildQS();
      if(exportBtn) exportBtn.href = '/admin/orders/export.csv' + (qs ? ('?'+qs) : '');
    }

    async function load(){
      try{
        $('#err').textContent = '';
        setExportHref();
        const qs = buildQS();
        const url = '/admin/orders' + (qs ? ('?'+qs) : '');
        const j = await getJSON(url);
        if(!j.ok) throw new Error();
        const tbody = $('#tbl tbody');
        tbody.innerHTML = (j.items||[]).map(o => {
          const amt = '£' + ((o.amountPence||0)/100).toFixed(2);
          const pf  = '£' + ((o.platformFeePence||0)/100).toFixed(2);
          const net = '£' + ((o.netPayoutPence||0)/100).toFixed(2);
          return \`<tr>
            <td>\${new Date(o.createdAt).toLocaleString()}</td>
            <td>\${o.email||''}</td>
            <td>\${o.show && o.show.title || ''}</td>
            <td>\${o.status||''}</td>
            <td class="right">\${amt}</td>
            <td class="right">\${pf}</td>
            <td class="right">\${net}</td>
          </tr>\`;
        }).join('');
      } catch(e){
        $('#err').textContent = 'Failed to load orders';
      }
    }

    form && form.addEventListener('submit', function(ev){ ev.preventDefault(); load(); });
    load();
  }

  // VENUES
  async function renderVenues(){
    setMain(\`
      <div class="card">
        <div class="header">
          <div class="title">Venues</div>
          <div class="toolbar">
            <input type="text" id="vq" placeholder="Search name / city / postcode" />
            <button class="btn" id="vsearch">Search</button>
          </div>
        </div>
        <div id="err" class="error"></div>
        <div style="height:8px"></div>
        <table id="tbl"><thead>
          <tr><th>Name</th><th>City</th><th>Postcode</th><th>Capacity</th></tr>
        </thead><tbody></tbody></table>
      </div>
    \`);

    const vq = $('#vq');
    async function load(){
      try{
        $('#err').textContent = '';
        const qs = vq && vq.value.trim() ? ('?q='+encodeURIComponent(vq.value.trim())) : '';
        const j = await getJSON('/admin/venues'+qs);
        if(!j.ok) throw new Error();
        const tbody = $('#tbl tbody');
        tbody.innerHTML = (j.items||[]).map(v => \`
          <tr>
            <td>\${v.name||''}</td>
            <td>\${v.city||''}</td>
            <td>\${v.postcode||''}</td>
            <td>\${v.capacity!=null?v.capacity:''}</td>
          </tr>\`).join('');
      } catch(e){ $('#err').textContent = 'Failed to load venues'; }
    }
    const vs = $('#vsearch'); vs && vs.addEventListener('click', load);
    load();
  }

  // ANALYTICS
  async function renderAnalytics(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Analytics</div></div>
        <div class="muted">Use the Orders filters for date-windowed CSV. Charts coming next.</div>
      </div>
    \`);
  }

  function renderAudiences(){
    setMain(\`
      <div class="card"><div class="header"><div class="title">Audiences</div></div><div>Audience tools coming soon.</div></div>
    \`);
  }
  function renderEmail(){
    setMain(\`
      <div class="card"><div class="header"><div class="title">Email Campaigns</div></div><div>Campaign tools coming soon.</div></div>
    \`);
  }
  function renderAccount(){
    setMain(\`
      <div class="card"><div class="header"><div class="title">Account</div></div><div>Manage your login and security from here (coming soon).</div></div>
    \`);
  }

  window.addEventListener('hashchange', route);

  // Safe link handling without TS assertions
  document.addEventListener('click', function(e){
    const t = e.target;
    const a = t && t.closest ? t.closest('a.sb-link') : null;
    if(a && a.getAttribute('data-view')){
      e.preventDefault();
      const h = a.getAttribute('href') || '#home';
      history.pushState(null, '', h);
      route();
    }
  });

  route();
})();
</script>
</body>
</html>
`);
});

export default router;
