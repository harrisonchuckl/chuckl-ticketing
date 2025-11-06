// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Chuckl. Organiser Console</title>
<style>
  :root{
    --bg:#f7f8fb;
    --panel:#ffffff;
    --text:#0f172a;
    --muted:#64748b;
    --brand:#2563eb;
    --brand-600:#1d4ed8;
    --border:#e5e7eb;
    --success:#16a34a;
    --danger:#dc2626;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;
    font:14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
    color:var(--text); background:var(--bg);
  }
  .layout{display:grid; grid-template-columns: 240px 1fr; height:100%}
  aside{
    background:#fff; border-right:1px solid var(--border);
    padding:16px 0; display:flex; flex-direction:column; gap:12px;
  }
  .brand{
    display:flex; align-items:center; gap:10px; padding:0 16px 8px 16px; border-bottom:1px solid var(--border);
  }
  .dot{width:10px;height:10px;border-radius:999px;background:var(--brand)}
  .brand h1{font-size:16px; margin:0}
  .section-title{font-size:12px; color:var(--muted); padding:10px 16px 0}
  nav a{
    display:flex; align-items:center; gap:10px;
    padding:10px 16px; color:#0f172a; text-decoration:none;
    border-left:3px solid transparent;
  }
  nav a.active{background:#eef2ff;border-left-color:var(--brand)}
  nav a:hover{background:#f3f4f6}
  main{padding:24px; overflow:auto}
  .toolbar{display:flex; gap:8px; justify-content:flex-end}
  .btn{
    background:var(--brand); color:#fff; border:0; padding:8px 12px; border-radius:8px; cursor:pointer;
  }
  .btn.secondary{background:#e5e7eb; color:#111827}
  .btn:disabled{opacity:.6; cursor:not-allowed}
  .card{
    background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px;
  }
  .grid{display:grid; gap:16px}
  .grid.cols-2{grid-template-columns:1fr 1fr}
  .muted{color:var(--muted)}
  .input, select, textarea{
    width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:#fff;
  }
  .row{display:flex; gap:12px; align-items:center}
  .row > *{flex:1}
  .list{display:flex; flex-direction:column; gap:8px}
  .list .item{
    padding:12px; border:1px solid var(--border); border-radius:10px; background:#fff; display:flex; justify-content:space-between; align-items:center;
  }
  footer{margin-top:24px; color:var(--muted); font-size:12px}
  .tag{font-size:12px; padding:4px 8px; border-radius:999px; background:#eef2ff; color:#1e3a8a}
  .toast{
    position:fixed; right:16px; bottom:16px; background:#111827; color:#fff; padding:10px 12px; border-radius:8px; opacity:0; transform:translateY(8px); transition:.2s;
  }
  .toast.show{opacity:1; transform:translateY(0)}
  .danger{color:var(--danger)}
  .success{color:var(--success)}
  .hidden{display:none !important}
  .keyPanel{padding:12px 16px; border-bottom:1px solid var(--border)}
  .keyPanel .row{gap:8px}
  .help{font-size:12px; color:var(--muted); margin-top:6px}
  .kbd{background:#f1f5f9; border:1px solid var(--border); border-bottom-width:2px; padding:1px 6px; border-radius:6px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New",monospace}
</style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand">
        <div class="dot"></div>
        <h1>Chuckl. Admin</h1>
      </div>

      <div class="keyPanel">
        <div class="row">
          <input id="adminKey" class="input" placeholder="Admin key" autocomplete="off" />
          <button id="saveKey" class="btn secondary" style="flex:0 0 auto">Save</button>
        </div>
        <div class="row" style="margin-top:8px">
          <button id="verifyKey" class="btn" style="flex:0 0 auto">Verify & load</button>
          <button id="clearKey" class="btn secondary" style="flex:0 0 auto">Clear</button>
        </div>
        <div id="keyStatus" class="help">Saved as <span class="kbd">x-admin-key</span> on requests.</div>
      </div>

      <div class="section-title">Organiser Console</div>
      <nav id="nav">
        <a href="#/dashboard" data-page="dashboard" class="active">Dashboard</a>
        <a href="#/shows" data-page="shows">Shows</a>
        <a href="#/tickets" data-page="tickets">Tickets</a>
        <a href="#/orders" data-page="orders">Orders</a>
        <a href="#/marketing" data-page="marketing">Marketing</a>
        <a href="#/customers" data-page="customers">Customers</a>
        <a href="#/seating" data-page="seating">Seating</a>
        <a href="#/reports" data-page="reports">Reports</a>
        <a href="#/access" data-page="access">Access Control</a>
        <a href="#/finance" data-page="finance">Finance</a>
        <a href="#/settings" data-page="settings">Settings</a>
        <a href="#/help" data-page="help">Help</a>
      </nav>

      <footer style="padding:0 16px">
        Chuckl. Organiser Console v1.0
      </footer>
    </aside>

    <main>
      <div class="row toolbar">
        <button id="reload" class="btn secondary">Reload</button>
        <button id="createShow" class="btn">Create Show</button>
      </div>

      <!-- Pages -->
      <section id="page-dashboard" class="grid" style="margin-top:16px">
        <div class="card">
          <h2>Dashboard</h2>
          <p class="muted">Use the left navigation to manage everything. Save your admin key to unlock protected data.</p>
          <div style="margin-top:8px" class="help">Tip: press <span class="kbd">G</span> then <span class="kbd">S</span> to jump to Shows.</div>
        </div>
      </section>

      <section id="page-shows" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <div class="row">
            <h2 style="margin:0">Shows</h2>
            <span style="text-align:right"><button class="btn" id="refreshShows" style="min-width:120px">Refresh</button></span>
          </div>
          <div id="showsList" class="list" style="margin-top:12px">
            <div class="muted">No data yet. Click “Verify & load”.</div>
          </div>
        </div>
      </section>

      <section id="page-tickets" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Tickets</h2>
          <p class="muted">Placeholder panel for ticket types, add-ons, holds, and settings.</p>
        </div>
      </section>

      <section id="page-orders" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Orders</h2>
          <div id="ordersList" class="list" style="margin-top:12px">
            <div class="muted">No data yet. Click “Verify & load”.</div>
          </div>
        </div>
      </section>

      <section id="page-marketing" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Marketing</h2>
          <p class="muted">Placeholder for email campaigns, social tools, promo links, UTM builder.</p>
        </div>
      </section>

      <section id="page-customers" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Customers</h2>
          <p class="muted">Placeholder for attendee CRM, lists, tags, and exports.</p>
        </div>
      </section>

      <section id="page-seating" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Seating</h2>
          <p class="muted">Placeholder for seat maps, area configs, device pairing.</p>
        </div>
      </section>

      <section id="page-reports" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Reports</h2>
          <p class="muted">Placeholder for sales, channel breakdown, audit, attendees & scheduled reports.</p>
        </div>
      </section>

      <section id="page-access" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Access Control</h2>
          <p class="muted">Placeholder for scanner dashboard & device configuration.</p>
        </div>
      </section>

      <section id="page-finance" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Finance</h2>
          <p class="muted">Placeholder for payouts, charges/credits, invoices, organisation profile.</p>
        </div>
      </section>

      <section id="page-settings" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Settings</h2>
          <p class="muted">Placeholder for org, users, roles, webhooks & API keys.</p>
        </div>
      </section>

      <section id="page-help" class="grid hidden" style="margin-top:16px">
        <div class="card">
          <h2>Help</h2>
          <p class="muted">Docs and support will appear here.</p>
        </div>
      </section>
    </main>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

<script>
(function(){
  const $ = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

  const STORAGE_KEY = 'ck_admin_key';
  let ADMIN_KEY = localStorage.getItem(STORAGE_KEY) || '';

  // Elements
  const adminKeyInput = $('#adminKey');
  const saveKeyBtn = $('#saveKey');
  const verifyBtn = $('#verifyKey');
  const clearBtn = $('#clearKey');
  const keyStatus = $('#keyStatus');
  const nav = $('#nav');
  const toast = $('#toast');
  const reloadBtn = $('#reload');
  const createShowBtn = $('#createShow');

  // Pages
  const pages = {
    dashboard: $('#page-dashboard'),
    shows: $('#page-shows'),
    tickets: $('#page-tickets'),
    orders: $('#page-orders'),
    marketing: $('#page-marketing'),
    customers: $('#page-customers'),
    seating: $('#page-seating'),
    reports: $('#page-reports'),
    access: $('#page-access'),
    finance: $('#page-finance'),
    settings: $('#page-settings'),
    help: $('#page-help'),
  };

  // Init key
  adminKeyInput.value = ADMIN_KEY;

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(()=> toast.classList.remove('show'), 1800);
  }

  function setActive(page){
    // nav highlight
    $$('#nav a').forEach(a=>{
      a.classList.toggle('active', a.dataset.page === page);
    });
    // page switch
    Object.entries(pages).forEach(([k,el])=>{
      el.classList.toggle('hidden', k !== page);
    });
  }

  function routeFromHash(){
    const hash = location.hash || '#/dashboard';
    const page = (hash.split('/')[1] || 'dashboard').toLowerCase();
    if(!pages[page]) return setActive('dashboard');
    setActive(page);
    // autoload per page
    if(page==='shows') loadShows();
    if(page==='orders') loadOrders();
  }

  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  // Save/Clear/Verify Key
  saveKeyBtn.addEventListener('click', ()=>{
    ADMIN_KEY = adminKeyInput.value.trim();
    localStorage.setItem(STORAGE_KEY, ADMIN_KEY);
    showToast('Admin key saved');
  });

  clearBtn.addEventListener('click', ()=>{
    localStorage.removeItem(STORAGE_KEY);
    ADMIN_KEY = '';
    adminKeyInput.value = '';
    showToast('Admin key cleared');
  });

  verifyBtn.addEventListener('click', async()=>{
    ADMIN_KEY = adminKeyInput.value.trim();
    if(!ADMIN_KEY){ showToast('Enter a key first'); return; }
    localStorage.setItem(STORAGE_KEY, ADMIN_KEY);
    // try a protected endpoint first
    let ok = false, msg = '';
    try{
      const r = await fetch('/admin/venues', { headers: { 'x-admin-key': ADMIN_KEY } });
      if(r.status === 200){ ok = true; }
      else if(r.status === 401){ msg = 'Unauthorized – check your key (x-admin-key).'; }
      else { 
        // fallback to health to at least see server is up
        const h = await fetch('/health');
        ok = h.ok;
        msg = 'Could not reach protected routes. Check server logs.';
      }
    }catch(e){
      msg = 'Network error. Check server URL and CORS.';
    }
    if(ok){
      keyStatus.innerHTML = '<span class="success">Key verified.</span>';
      showToast('Key verified. Loading data…');
      await Promise.all([loadShows(), loadOrders()]);
    }else{
      keyStatus.innerHTML = '<span class="danger">' + (msg || 'Unauthorized') + '</span>';
      showToast('Key failed.');
    }
  });

  reloadBtn.addEventListener('click', ()=>location.reload());
  createShowBtn.addEventListener('click', ()=>{ location.hash = '#/shows'; });

  // API helper
  async function api(path, init={}){
    const headers = Object.assign({}, init.headers||{}, ADMIN_KEY ? {'x-admin-key': ADMIN_KEY} : {});
    const res = await fetch(path, Object.assign({}, init, { headers }));
    if(res.status === 401) throw new Error('Unauthorized');
    return res;
  }

  // Load Shows
  async function loadShows(){
    const panel = $('#showsList');
    panel.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const r = await api('/admin/shows/latest?limit=20');
      const data = await r.json();
      if(!Array.isArray(data) || data.length===0){
        panel.innerHTML = '<div class="muted">No shows found.</div>';
        return;
      }
      panel.innerHTML = '';
      data.forEach(sh=>{
        const el = document.createElement('div');
        el.className = 'item';
        el.innerHTML = \`
          <div>
            <div><strong>\${sh.title || 'Untitled Show'}</strong></div>
            <div class="muted">\${(sh.venue?.name || 'Unknown venue')} · \${formatDate(sh.startsAt)}</div>
          </div>
          <div class="row" style="gap:8px; flex:0 0 auto">
            <span class="tag">\${(sh.capacity || sh.venue?.capacity || '-') } cap</span>
            <button class="btn secondary" data-id="\${sh.id}">Manage</button>
          </div>\`;
        el.querySelector('button')!.addEventListener('click', ()=>{
          // later: navigate to detailed show editor
          showToast('Open show: ' + (sh.title || sh.id));
        });
        panel.appendChild(el);
      });
    }catch(e){
      panel.innerHTML = '<div class="danger">Failed to load shows. ' + e.message + '</div>';
    }
  }

  // Load Orders (summary)
  async function loadOrders(){
    const panel = $('#ordersList');
    panel.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const r = await api('/admin/orders?limit=10');
      if(r.status===404){ panel.innerHTML = '<div class="muted">No orders endpoint yet.</div>'; return; }
      const data = await r.json();
      if(!Array.isArray(data) || data.length===0){
        panel.innerHTML = '<div class="muted">No recent orders.</div>';
        return;
      }
      panel.innerHTML = '';
      data.forEach(o=>{
        const el = document.createElement('div');
        el.className = 'item';
        el.innerHTML = \`
          <div>
            <div><strong>#\${o.id}</strong> — \${o.buyerEmail || 'buyer'}</div>
            <div class="muted">\${(o.show?.title || 'Show')} · \${formatDate(o.createdAt)}</div>
          </div>
          <div class="row" style="gap:8px; flex:0 0 auto">
            <span class="tag">£\${(o.total/100).toFixed(2)}</span>
            <button class="btn secondary" data-id="\${o.id}">View</button>
          </div>\`;
        panel.appendChild(el);
      });
    }catch(e){
      panel.innerHTML = '<div class="danger">Failed to load orders. ' + e.message + '</div>';
    }
  }

  function formatDate(v){
    try{
      const d = new Date(v);
      return d.toLocaleString();
    }catch(_){ return String(v); }
  }

  // Keyboard quick nav: G then S = shows
  let keyChord = [];
  window.addEventListener('keydown', (e)=>{
    keyChord.push(e.key.toLowerCase()); if(keyChord.length>2) keyChord.shift();
    if(keyChord.join('')==='gs'){ location.hash = '#/shows'; }
  });

  // First paint: if a key is present, try to verify silently
  if(ADMIN_KEY){
    keyStatus.textContent = 'Key present. You can Verify & load.';
  } else {
    keyStatus.textContent = 'Enter your admin key and click Verify & load.';
  }
})();
</script>
</body>
</html>`);
});

export default router;
