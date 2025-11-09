// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

// Keep "/" helpful — many folks bookmark /admin
router.get('/', (_req, res) => res.redirect('/admin/ui'));

// One HTML page app; data comes from JSON APIs under /admin/*
router.get('/ui', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Organiser Console</title>
<style>
  :root {
    --bg:#fafbfc; --panel:#fff; --text:#1f2937; --muted:#6b7280; --line:#e5e7eb; --brand:#111827;
    --btn:#111827; --btnText:#fff; --btnLite:#f3f4f6;
  }
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Helvetica,Arial,sans-serif}
  .app{display:flex;min-height:100vh}
  .sidebar{width:220px;background:var(--panel);border-right:1px solid var(--line);padding:12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .brand{font-weight:700;margin:4px 8px 12px}
  .section{color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:16px 8px 8px}
  .nav{display:flex;flex-direction:column;gap:4px}
  .nav button{appearance:none;border:0;background:transparent;text-align:left;padding:8px 10px;border-radius:8px;cursor:pointer}
  .nav button.active{background:var(--btnLite)}
  .nav button:hover{background:#f6f7f8}
  .main{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  input[type="text"], input[type="date"], input[type="number"]{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff;min-width:220px}
  .btn{background:var(--btn);color:var(--btnText);border:0;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn-link{color:var(--brand);text-decoration:underline;cursor:pointer}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left}
  .muted{color:var(--muted)}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px;background:#fff}
  .right{margin-left:auto}
  .danger{color:#b91c1c}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">Organiser Console</div>

    <div class="section">Dashboard</div>
    <div class="nav">
      <button data-view="home" class="active">Home</button>
      <button data-view="shows">Shows</button>
      <button data-view="orders">Orders</button>
      <button data-view="venues">Venues</button>
    </div>

    <div class="section">Insights</div>
    <div class="nav">
      <button data-view="analytics">Analytics</button>
    </div>

    <div class="section">Marketing</div>
    <div class="nav">
      <button data-view="audiences">Audiences</button>
      <button data-view="email">Email Campaigns</button>
    </div>

    <div class="section">Settings</div>
    <div class="nav">
      <button data-view="account">Account</button>
      <a class="btn-link" href="/auth/logout">Log out</a>
    </div>
  </aside>

  <main class="main">
    <div id="content" class="card"></div>
  </main>
</div>

<script>
  // --- util -----------------------------------------------------
  function fmtPence(p){ return (Number(p||0)/100).toFixed(2); }
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  async function api(path, opts){
    const r = await fetch(path, Object.assign({ credentials:'include' }, opts||{}));
    if(!r.ok) throw new Error('HTTP '+r.status);
    const ct = r.headers.get('content-type')||'';
    return ct.includes('application/json') ? r.json() : r.text();
  }
  async function ensureAuth(){
    try{
      const me = await api('/auth/me');
      return !!me?.ok;
    }catch(_){ return false; }
  }

  // --- views ----------------------------------------------------
  const views = {
    async home(){
      return \`
        <h3>Home</h3>
        <p class="muted">Welcome to your organiser console. Use the menu to manage shows, orders, venues, insights and marketing.</p>
        <div style="height:8px"></div>
        <div class="row">
          <span class="pill">Status: Online</span>
        </div>
      \`;
    },

    async shows(){
      const data = await api('/admin/shows');
      const rows = (data?.items||[]).map(s => \`
        <tr>
          <td>\${s.title||''}</td>
          <td>\${s.venue?.name||''}</td>
          <td>\${new Date(s.date).toLocaleString()}</td>
          <td class="muted">\${s.id}</td>
        </tr>\`).join('');
      return \`
        <div class="row">
          <h3>Shows</h3>
          <button class="btn right" id="refreshShows">Refresh</button>
        </div>
        <table>
          <thead><tr><th>Title</th><th>Venue</th><th>Date</th><th>ID</th></tr></thead>
          <tbody>\${rows||''}</tbody>
        </table>
      \`;
    },

    async orders(){
      // Toolbar with Export CSV respecting q/from/to
      return \`
        <h3>Orders</h3>
        <div class="row" id="ordersToolbar">
          <input type="text" name="q" placeholder="Search email / Stripe / show"/>
          <input type="date" name="from"/>
          <input type="date" name="to"/>
          <button class="btn" id="searchOrders">Search</button>
          <a class="btn-link" id="exportCsv" href="#">Export CSV</a>
        </div>
        <div id="ordersTable" class="muted" style="margin-top:12px">Enter a query or date range and click Search.</div>
      \`;
    },

    async venues(){
      const resp = await api('/admin/venues');
      const venues = resp?.items || [];
      const rows = venues.map(v => \`
        <tr data-id="\${v.id}">
          <td><div><strong>\${v.name||''}</strong><div class="muted">\${[v.city, v.postcode].filter(Boolean).join(' • ')}</div></div></td>
          <td><input type="number" step="1" min="0" name="feePercentBps" value="\${v.feePercentBps ?? ''}" placeholder="bps (e.g. 1000 = 10%)"/></td>
          <td><input type="number" step="1" min="0" name="perTicketFeePence" value="\${v.perTicketFeePence ?? ''}" placeholder="per-ticket pence"/></td>
          <td><input type="number" step="1" min="0" name="basketFeePence" value="\${v.basketFeePence ?? ''}" placeholder="basket pence"/></td>
          <td><button class="btn saveVenue">Save</button></td>
        </tr>\`).join('');

      return \`
        <div class="row"><h3>Venues</h3><button class="btn right" id="refreshVenues">Refresh</button></div>
        <table>
          <thead><tr><th>Venue</th><th>% Fee (bps)</th><th>Per-ticket (p)</th><th>Basket (p)</th><th></th></tr></thead>
          <tbody>\${rows||''}</tbody>
        </table>
        <p class="muted" style="margin-top:10px">Fee policy applies per venue; organiser split is configured on each organiser account.</p>
      \`;
    },

    async analytics(){
      return \`
        <h3>Analytics</h3>
        <div class="row" id="analyticsToolbar">
          <input type="date" name="from"/>
          <input type="date" name="to"/>
          <button class="btn" id="runAnalytics">Run</button>
        </div>
        <div id="analyticsBody" class="muted" style="margin-top:12px">Pick a date range and click Run.</div>
      \`;
    },

    async audiences(){
      return \`<h3>Audiences</h3><p class="muted">Audience tools coming soon.</p>\`;
    },

    async email(){
      return \`<h3>Email Campaigns</h3><p class="muted">Email integrations coming soon.</p>\`;
    },

    async account(){
      const me = await api('/auth/me').catch(()=>({}));
      return \`
        <h3>Account</h3>
        <p><strong>Email:</strong> \${me?.user?.email || 'unknown'}</p>
        <p><strong>Organiser split (bps):</strong> \${me?.user?.organiserSplitBps ?? '—'}</p>
        <p><a class="btn-link danger" href="/auth/logout">Log out</a></p>
      \`;
    }
  };

  // --- router / navigation --------------------------------------
  async function switchView(view){
    // highlight menu
    qsa('.sidebar .nav button').forEach(b => b.classList.toggle('active', b.dataset.view===view));
    // render
    const el = qs('#content');
    el.innerHTML = '<div class="muted">Loading…</div>';
    try{
      // auth-gate UI (but let HTML load)
      const ok = await ensureAuth();
      if(!ok){
        el.innerHTML = '<p>Please <a class="btn-link" href="/auth/login">sign in</a> to continue.</p>';
        return;
      }
      el.innerHTML = await views[view]();
      // attach view-specific handlers
      if(view==='shows'){
        qs('#refreshShows')?.addEventListener('click', () => switchView('shows'));
      }
      if(view==='venues'){
        qs('#refreshVenues')?.addEventListener('click', () => switchView('venues'));
        qsa('.saveVenue').forEach(btn=>{
          btn.addEventListener('click', async ()=>{
            const tr = btn.closest('tr'); const id = tr?.dataset.id;
            const body = {
              feePercentBps: numOrNull(qs('input[name="feePercentBps"]', tr)?.value),
              perTicketFeePence: numOrNull(qs('input[name="perTicketFeePence"]', tr)?.value),
              basketFeePence: numOrNull(qs('input[name="basketFeePence"]', tr)?.value),
            };
            await api('/admin/venues/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
            btn.textContent='Saved'; setTimeout(()=>btn.textContent='Save',1200);
          });
        });
      }
      if(view==='orders'){
        const toolbar = qs('#ordersToolbar');
        const exportBtn = qs('#exportCsv');
        const table = qs('#ordersTable');
        function buildQS(){
          const p = new URLSearchParams();
          const q = qs('input[name="q"]', toolbar).value.trim();
          const from = qs('input[name="from"]', toolbar).value;
          const to = qs('input[name="to"]', toolbar).value;
          if(q) p.set('q', q);
          if(from) p.set('from', from);
          if(to) p.set('to', to);
          const qsStr = p.toString();
          return qsStr ? ('?'+qsStr) : '';
        }
        exportBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          window.location.href = '/admin/orders/export.csv'+buildQS();
        });
        qs('#searchOrders').addEventListener('click', async ()=>{
          table.innerHTML='Loading…';
          try{
            const data = await api('/admin/orders'+buildQS());
            const rows = (data?.items||[]).map(o=>\`
              <tr>
                <td>\${o.show?.title||''}</td>
                <td>\${o.email||''}</td>
                <td>\${o.status}</td>
                <td>£\${fmtPence(o.amountPence)}</td>
                <td>£\${fmtPence(o.platformFeePence)}</td>
                <td>£\${fmtPence(o.organiserSharePence)}</td>
                <td>£\${fmtPence(o.netPayoutPence)}</td>
                <td class="muted">\${o.id}</td>
              </tr>\`).join('');
            table.innerHTML=\`
              <table>
                <thead><tr>
                  <th>Show</th><th>Buyer</th><th>Status</th><th>Gross</th>
                  <th>Platform Fee</th><th>Organiser Share</th><th>Net Payout</th><th>ID</th>
                </tr></thead>
                <tbody>\${rows}</tbody>
              </table>\`;
          }catch(_){
            table.innerHTML='<span class="danger">Failed to load orders</span>';
          }
        });
      }
      if(view==='analytics'){
        const toolbar = qs('#analyticsToolbar');
        const body = qs('#analyticsBody');
        qs('#runAnalytics').addEventListener('click', async ()=>{
          body.innerHTML='Loading…';
          const from = qs('input[name="from"]', toolbar).value;
          const to = qs('input[name="to"]', toolbar).value;
          const p = new URLSearchParams();
          if(from) p.set('from', from);
          if(to) p.set('to', to);
          try{
            const data = await api('/admin/analytics' + (p.toString()?('?'+p.toString()):''));
            body.innerHTML = \`
              <div class="row">
                <div class="pill">Orders: \${data.totalOrders}</div>
                <div class="pill">Tickets: \${data.totalTickets}</div>
                <div class="pill">Gross: £\${fmtPence(data.totalGrossPence)}</div>
                <div class="pill">Platform Fee: £\${fmtPence(data.totalPlatformFeePence)}</div>
                <div class="pill">Organiser Share: £\${fmtPence(data.totalOrganiserSharePence)}</div>
                <div class="pill">Net Payout: £\${fmtPence(data.totalNetPayoutPence)}</div>
              </div>\`;
          }catch(_){
            body.innerHTML = '<span class="danger">Failed to load analytics</span>';
          }
        });
      }
      history.replaceState(null,'','/admin/ui#'+view);
    }catch(e){
      console.error(e);
      qs('#content').innerHTML = '<p class="danger">Failed to load view.</p>';
    }
  }

  function numOrNull(v){ if(v===undefined||v===null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; }

  // Sidebar events
  qsa('.sidebar .nav button').forEach(btn=>{
    btn.addEventListener('click', ()=> switchView(btn.dataset.view));
  });

  // Boot: go to hash view if present
  (async function boot(){
    const initial = (location.hash||'#home').slice(1);
    if(!views[initial]) { await switchView('home'); return; }
    await switchView(initial);
  })();
</script>
</body>
</html>`);
});

export default router;
