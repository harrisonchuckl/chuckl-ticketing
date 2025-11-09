// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.redirect('/admin/ui'));

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
  .pill{display:inline-block;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-size:13px;background:#fff;min-width:140px}
  .right{margin-left:auto}
  .danger{color:#b91c1c}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;margin-top:10px}
  /* Drawer */
  .drawer{position:fixed;top:0;right:-440px;width:420px;height:100vh;background:#fff;border-left:1px solid var(--line);box-shadow:-6px 0 20px rgba(0,0,0,.06);transition:right .24s ease;padding:16px;overflow:auto;z-index:50}
  .drawer.open{right:0}
  .drawer h4{margin:6px 0 12px}
  .drawer .close{position:absolute;top:10px;right:12px;background:#f3f4f6;border:1px solid var(--line);border-radius:6px;padding:6px 8px;cursor:pointer}
  canvas{max-width:100%;height:220px;border:1px solid var(--line);border-radius:8px;background:#fff}
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

  <aside id="drawer" class="drawer" aria-hidden="true">
    <button class="close" id="drawerClose">Close</button>
    <div id="drawerBody" class="muted">Loading…</div>
  </aside>
</div>

<script>
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
    try{ const me = await api('/auth/me'); return !!me?.ok; }catch(_){ return false; }
  }

  const views = {
    async home(){
      const summaryHtml = \`
        <div id="summary" class="grid">
          <div class="pill">WTD Gross: <strong id="wtdGross">—</strong></div>
          <div class="pill">MTD Gross: <strong id="mtdGross">—</strong></div>
          <div class="pill">WTD Net Payout: <strong id="wtdNet">—</strong></div>
          <div class="pill">MTD Net Payout: <strong id="mtdNet">—</strong></div>
        </div>\`;

      setTimeout(async ()=>{
        try{
          const r = await api('/admin/analytics/summary');
          if(r?.ok){
            qs('#wtdGross').textContent = '£'+fmtPence(r.wtd.totalGrossPence);
            qs('#mtdGross').textContent = '£'+fmtPence(r.mtd.totalGrossPence);
            qs('#wtdNet').textContent   = '£'+fmtPence(r.wtd.totalNetPayoutPence);
            qs('#mtdNet').textContent   = '£'+fmtPence(r.mtd.totalNetPayoutPence);
          }
        }catch(_){}
      }, 0);

      return \`
        <h3>Home</h3>
        <p class="muted">Welcome to your organiser console. Use the menu to manage shows, orders, venues, insights and marketing.</p>
        \${summaryHtml}
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
      return \`
        <h3>Orders</h3>
        <div class="row" id="ordersToolbar">
          <input type="text" name="q" placeholder="Search email / Stripe / show"/>
          <input type="date" name="from"/>
          <input type="date" name="to"/>
          <button class="btn" id="searchOrders">Search</button>
          <a class="btn-link" id="exportCsv" href="#">Export CSV</a>
        </div>
        <div id="ordersTable" style="margin-top:12px" class="muted">Enter a query or date range and click Search.</div>
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
        <h4 style="margin-top:16px">MTD Daily Gross</h4>
        <canvas id="mtdChart" width="800" height="220"></canvas>
      \`;
    },

    async audiences(){ return '<h3>Audiences</h3><p class="muted">Audience tools coming soon.</p>'; },
    async email(){ return '<h3>Email Campaigns</h3><p class="muted">Email integrations coming soon.</p>'; },

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

  // --- helpers ---
  function numOrNull(v){ if(v===undefined||v===null||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; }
  function openDrawer(html){ const d=qs('#drawer'); qs('#drawerBody').innerHTML=html; d.classList.add('open'); d.setAttribute('aria-hidden','false'); }
  function closeDrawer(){ const d=qs('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); }

  async function switchView(view){
    qsa('.sidebar .nav button').forEach(b => b.classList.toggle('active', b.dataset.view===view));
    const el = qs('#content');
    el.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const ok = await ensureAuth();
      if(!ok){ el.innerHTML='<p>Please <a class="btn-link" href="/auth/login">sign in</a> to continue.</p>'; return; }
      el.innerHTML = await views[view]();

      if(view==='shows'){ qs('#refreshShows')?.addEventListener('click', ()=>switchView('shows')); }

      if(view==='venues'){
        qs('#refreshVenues')?.addEventListener('click', ()=>switchView('venues'));
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
          return p.toString() ? '?'+p.toString() : '';
        }
        exportBtn.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href='/admin/orders/export.csv'+buildQS(); });
        qs('#searchOrders').addEventListener('click', async ()=>{
          table.innerHTML='Loading…';
          try{
            const data = await api('/admin/orders'+buildQS());
            const rows = (data?.items||[]).map(o=>\`
              <tr data-id="\${o.id}">
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
              <table id="ordersTbl">
                <thead><tr>
                  <th>Show</th><th>Buyer</th><th>Status</th><th>Gross</th>
                  <th>Platform Fee</th><th>Organiser Share</th><th>Net Payout</th><th>ID</th>
                </tr></thead>
                <tbody>\${rows}</tbody>
              </table>\`;
            // click row -> drawer
            qsa('#ordersTbl tbody tr').forEach(tr=>{
              tr.addEventListener('click', async ()=>{
                const id = tr.getAttribute('data-id');
                openDrawer('Loading…');
                try{
                  const resp = await api('/admin/orders/'+id);
                  const o = resp.item;
                  const tix = (o.tickets||[]).map(t=>\`<li>\${t.serial} — \${t.holderName || '—'} <span class="muted">(\${t.status})</span>\${t.scannedAt?(' · scanned '+new Date(t.scannedAt).toLocaleString()):''}</li>\`).join('');
                  const refs = (o.refunds||[]).map(r=>\`<li>£\${fmtPence(r.amount)} — \${r.reason||'refund'} <span class="muted">(\${new Date(r.createdAt).toLocaleString()})</span></li>\`).join('');
                  const notes = (o.notes||[]).map(n=>\`<li>\${new Date(n.createdAt).toLocaleString()} — <em>\${n.text}</em></li>\`).join('');
                  const html = \`
                    <h4>Order \${o.id}</h4>
                    <div class="muted">\${o.email || ''} · \${o.show?.title || ''} · \${o.status}</div>
                    <div class="grid" style="margin:10px 0">
                      <div class="pill">Gross £\${fmtPence(o.amountPence)}</div>
                      <div class="pill">Platform Fee £\${fmtPence(o.platformFeePence)}</div>
                      <div class="pill">Organiser Share £\${fmtPence(o.organiserSharePence)}</div>
                      <div class="pill">Net Payout £\${fmtPence(o.netPayoutPence)}</div>
                    </div>
                    <h4>Tickets</h4>
                    <ul>\${tix||'<li class="muted">No tickets</li>'}</ul>
                    <h4>Refunds</h4>
                    <ul>\${refs||'<li class="muted">None</li>'}</ul>
                    <h4>Notes</h4>
                    <ul id="notesList">\${notes||'<li class="muted">None yet</li>'}</ul>
                    <div class="row" style="margin-top:8px">
                      <input id="noteText" type="text" placeholder="Add a note…"/>
                      <button class="btn" id="addNote">Add</button>
                    </div>
                  \`;
                  openDrawer(html);
                  qs('#addNote')?.addEventListener('click', async ()=>{
                    const text = qs('#noteText')?.value.trim();
                    if(!text) return;
                    await api('/admin/orders/'+id+'/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
                    const li = document.createElement('li'); li.innerHTML = '<em>'+text+'</em>';
                    qs('#notesList')?.appendChild(li);
                    qs('#noteText').value='';
                  });
                }catch(_){ openDrawer('<p class="danger">Failed to load order.</p>'); }
              });
            });
          }catch(_){ table.innerHTML='<span class="danger">Failed to load orders</span>'; }
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
            const data = await api('/admin/analytics'+(p.toString()?('?'+p.toString()):'')); 
            body.innerHTML = \`
              <div class="row">
                <div class="pill">Orders: \${data.totalOrders}</div>
                <div class="pill">Tickets: \${data.totalTickets}</div>
                <div class="pill">Gross: £\${fmtPence(data.totalGrossPence)}</div>
                <div class="pill">Platform Fee: £\${fmtPence(data.totalPlatformFeePence)}</div>
                <div class="pill">Organiser Share: £\${fmtPence(data.totalOrganiserSharePence)}</div>
                <div class="pill">Net Payout: £\${fmtPence(data.totalNetPayoutPence)}</div>
              </div>\`;
          }catch(_){ body.innerHTML='<span class="danger">Failed to load analytics</span>'; }
        });

        // draw MTD bar chart
        (async ()=>{
          try{
            const r = await api('/admin/analytics/mtd-daily');
            const points = r?.points || [];
            const c = qs('#mtdChart') as HTMLCanvasElement;
            const ctx = c.getContext('2d');
            if(!ctx) return;
            // basic bar chart
            const w = c.width, h = c.height, pad = 30;
            ctx.clearRect(0,0,w,h);
            const max = Math.max(1, ...points.map(p=>p.grossPence));
            const barW = Math.max(4, Math.floor((w - pad*2)/Math.max(1, points.length)));
            ctx.strokeStyle = '#e5e7eb';
            ctx.beginPath(); ctx.moveTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
            points.forEach((p, i)=>{
              const x = pad + i*barW;
              const y = h - pad - (p.grossPence/max)*(h - pad*2);
              const bh = (h - pad) - y;
              ctx.fillStyle = '#111827';
              ctx.fillRect(x+1, y, barW-2, bh);
            });
          }catch(_){}
        })();
      }

      history.replaceState(null,'','/admin/ui#'+view);
    }catch(e){ console.error(e); qs('#content').innerHTML = '<p class="danger">Failed to load view.</p>'; }
  }

  qsa('.sidebar .nav button').forEach(btn=> btn.addEventListener('click', ()=> switchView(btn.dataset.view)));
  qs('#drawerClose')?.addEventListener('click', closeDrawer);
  (async function boot(){ const initial=(location.hash||'#home').slice(1); await switchView(views[initial]?initial:'home'); })();
</script>
</body>
</html>`);
});

export default router;
