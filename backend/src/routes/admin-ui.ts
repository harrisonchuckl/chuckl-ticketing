import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * Admin SPA (hash-router). Pure JS inlined for simplicity.
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
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280}
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .kpis{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px}
  .kpi{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px}
  .kpi .label{font-size:12px;color:var(--muted)}
  .kpi .value{font-size:20px;font-weight:700;margin-top:6px}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap}
  .row{display:flex;gap:8px;flex-wrap:wrap}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .right{text-align:right}
  .error{color:#b91c1c}
  .grid{display:grid;gap:8px}
  .grid-4{grid-template-columns:repeat(4,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  .grid-2{grid-template-columns:repeat(2,1fr)}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
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
  <main class="content" id="main"><div class="card"><div class="title">Loading...</div></div></main>
</div>

<script>
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function setActive(view){ $$('.sb-link').forEach(a => a.classList.toggle('active', a.getAttribute('data-view')===view)); }
  function setMain(html){ $('#main').innerHTML = html; }
  async function getJSON(url, opts){ const r = await fetch(url, { credentials:'include', ...(opts||{}) }); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  const fmtP = p => '£'+(Number(p||0)/100).toFixed(2);

  function route(){
    const v = (location.hash || '#home').replace('#','');
    setActive(v);
    if(v==='home') return renderHome();
    if(v==='shows') return renderShows();
    if(v==='orders') return renderOrders();
    if(v==='venues') return renderVenues();
    if(v==='analytics') return renderAnalytics();
    if(v==='audiences') return renderAudiences();
    if(v==='email') return renderEmail();
    if(v==='account') return renderAccount();
    return renderHome();
  }
  window.addEventListener('hashchange', route);

  // HOME (KPIs already wired to /admin/analytics/summary if present)
  async function renderHome(){
    setMain(\`
      <div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, orders, venues, insights and marketing.</div></div>
      <div class="card" id="kpis"><div class="header"><div class="title">Dashboard KPIs</div><button class="btn" id="kpiReload">Refresh</button></div>
        <div class="kpis">
          <div class="kpi"><div class="label">Orders (7d)</div><div class="value" id="o7">—</div></div>
          <div class="kpi"><div class="label">GMV (7d)</div><div class="value" id="g7">—</div></div>
          <div class="kpi"><div class="label">Our Fees (7d)</div><div class="value" id="f7">—</div></div>
          <div class="kpi"><div class="label">Net Payout (7d)</div><div class="value" id="n7">—</div></div>
        </div>
        <div id="kerr" class="error"></div>
      </div>\`);
    async function load(){ try{ const j=await getJSON('/admin/analytics/summary'); const s=j.summary||{}; $('#o7').textContent=s.last7?.orders||0; $('#g7').textContent=fmtP(s.last7?.gmvPence); $('#f7').textContent=fmtP(s.last7?.ourFeesPence); $('#n7').textContent=fmtP(s.last7?.netPayoutPence);}catch(e){$('#kerr').textContent='Failed to load KPIs';}}
    $('#kpiReload')?.addEventListener('click', load); load();
  }

  // SHOWS
  async function renderShows(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>
        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid">
            <label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club" />
          </div>
          <div class="grid">
            <label>Date & time</label><input id="sh_dt" type="datetime-local" />
          </div>
          <div class="grid">
            <label>Venue</label>
            <select id="sh_venue"><option value="">Loading venues…</option></select>
          </div>
          <div class="grid">
            <label>Poster image URL (optional)</label><input id="sh_img" placeholder="https://…" />
          </div>
          <div class="grid" style="grid-column:1 / -1">
            <label>Description (optional)</label><textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea>
          </div>
        </div>
        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" placeholder="General Admission" /></div>
          <div class="grid"><label>Price (pence)</label><input id="t_price" type="number" placeholder="2500" /></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300" /></div>
        </div>
        <div class="row"><button class="btn" id="btnCreateShow">Create show</button><div id="sh_err" class="error"></div></div>
      </div>

      <div class="card">
        <div class="header"><div class="title">Shows</div><button class="btn" id="sh_refresh">Refresh</button></div>
        <table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead><tbody id="shows_tbody"></tbody></table>
        <div id="list_err" class="error"></div>
      </div>
    \`);

    // load venues for the select
    try{
      const vj = await getJSON('/admin/venues');
      const sel = $('#sh_venue'); sel.innerHTML = '<option value="">Select venue…</option>' + (vj.items||[]).map(v=>\`<option value="\${v.id}">\${v.name} \${v.city?('– '+v.city):''}</option>\`).join('');
    }catch(e){ $('#sh_err').textContent='Failed to load venues'; }

    $('#btnCreateShow')?.addEventListener('click', async () => {
      $('#sh_err').textContent = '';
      try{
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId: $('#sh_venue').value || null,
          imageUrl: $('#sh_img').value.trim() || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim(),
            pricePence: $('#t_price').value ? Number($('#t_price').value) : null,
            available: $('#t_alloc').value ? Number($('#t_alloc').value) : null,
          }
        };
        if(!payload.title || !payload.date || !payload.venueId){
          $('#sh_err').textContent = 'Title, date/time and venue are required';
          return;
        }
        const r = await getJSON('/admin/shows', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload),
        });
        if(!r.ok) throw new Error(r.error || 'Failed to create show');
        // clear and reload
        ['sh_title','sh_dt','sh_img','sh_desc','t_name','t_price','t_alloc'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        await loadList();
      }catch(e){ $('#sh_err').textContent = e.message || 'Failed to create show'; }
    });

    async function loadList(){
      try{
        $('#list_err').textContent='';
        const j = await getJSON('/admin/shows');
        const tb = $('#shows_tbody');
        tb.innerHTML = (j.items||[]).map(s => \`
          <tr>
            <td>\${s.title}</td>
            <td>\${new Date(s.date).toLocaleString()}</td>
            <td>\${s.venue ? (s.venue.name + (s.venue.city? ' – ' + s.venue.city : '')) : ''}</td>
            <td>\${s._count?.ticketTypes ?? 0}</td>
            <td>\${s._count?.orders ?? 0}</td>
          </tr>\`).join('');
      }catch(e){ $('#list_err').textContent='Failed to load shows'; }
    }
    $('#sh_refresh')?.addEventListener('click', loadList);
    loadList();
  }

  // ORDERS (unchanged – already present earlier)
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

    const form=$('#searchForm'),q=$('#q'),from=$('#from'),to=$('#to'),exportBtn=$('#btnExport');
    const buildQS=()=>{const u=new URLSearchParams(); if(q.value.trim())u.set('q',q.value.trim()); if(from.value)u.set('from',from.value); if(to.value)u.set('to',to.value); return u.toString();};
    const setExportHref=()=>{const qs=buildQS(); exportBtn.href='/admin/orders/export.csv'+(qs?('?'+qs):'');};
    async function load(){
      try{
        $('#err').textContent=''; setExportHref();
        const j = await getJSON('/admin/orders'+(buildQS()?('?'+buildQS()):''));
        const tb=$('#tbl tbody');
        tb.innerHTML=(j.items||[]).map(o=>\`<tr>
          <td>\${new Date(o.createdAt).toLocaleString()}</td>
          <td>\${o.email||''}</td>
          <td>\${o.show?.title||''}</td>
          <td>\${o.status||''}</td>
          <td class="right">\${fmtP(o.amountPence)}</td>
          <td class="right">\${fmtP(o.platformFeePence)}</td>
          <td class="right">\${fmtP(o.netPayoutPence)}</td>
        </tr>\`).join('');
      }catch(e){ $('#err').textContent='Failed to load orders'; }
    }
    form?.addEventListener('submit', (ev)=>{ev.preventDefault(); load();});
    load();
  }

  // VENUES (no fee inputs)
  async function renderVenues(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Venue</div></div>
        <div class="grid grid-4" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="v_name" placeholder="Venue name"/></div>
          <div class="grid"><label>City</label><input id="v_city" placeholder="City"/></div>
          <div class="grid"><label>Postcode</label><input id="v_pc" placeholder="Postcode"/></div>
          <div class="grid"><label>Capacity</label><input id="v_cap" type="number" placeholder="e.g. 800"/></div>
          <div class="grid" style="grid-column:1 / -1"><label>Address (optional)</label><input id="v_addr" placeholder="Address line(s)"/></div>
        </div>
        <div class="row"><button class="btn" id="v_create">Create venue</button><div id="v_err" class="error"></div></div>
      </div>

      <div class="card">
        <div class="header">
          <div class="title">Venues</div>
          <div class="row"><input id="vq" placeholder="Search name / city / postcode"/><button class="btn" id="v_search">Search</button></div>
        </div>
        <table><thead><tr><th>Name</th><th>City</th><th>Postcode</th><th>Capacity</th></tr></thead><tbody id="v_body"></tbody></table>
      </div>\`);

    async function load(q){
      const j = await getJSON('/admin/venues'+(q?('?q='+encodeURIComponent(q)):''));
      $('#v_body').innerHTML = (j.items||[]).map(v=>\`<tr><td>\${v.name}</td><td>\${v.city||''}</td><td>\${v.postcode||''}</td><td>\${v.capacity??''}</td></tr>\`).join('');
    }
    $('#v_search')?.addEventListener('click', ()=>load($('#vq').value.trim()));
    $('#v_create')?.addEventListener('click', async ()=>{
      $('#v_err').textContent='';
      try{
        const payload = {
          name: $('#v_name').value.trim(),
          city: $('#v_city').value.trim() || null,
          postcode: $('#v_pc').value.trim() || null,
          capacity: $('#v_cap').value ? Number($('#v_cap').value) : null,
          address: $('#v_addr').value.trim() || null,
        };
        if(!payload.name){ $('#v_err').textContent='Name is required'; return; }
        const r = await getJSON('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r.ok) throw new Error(r.error||'Failed');
        ['v_name','v_city','v_pc','v_cap','v_addr'].forEach(id=>{const el=$('#'+id); if(el) el.value='';});
        await load();
      }catch(e){ $('#v_err').textContent = e.message || 'Failed to create venue'; }
    });
    load();
  }

  // PLACEHOLDERS
  function renderAnalytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function renderAudiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Audience tools coming soon.</div></div>'); }
  function renderEmail(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Campaign tools coming soon.</div></div>'); }
  function renderAccount(){ setMain('<div class="card"><div class="title">Account</div><div>Manage your login and security (coming soon).</div></div>'); }

  // enable hash router for sidebar clicks
  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){ e.preventDefault(); history.pushState(null,'',a.getAttribute('href')); route(); }
  });

  route();
})();
</script>
</body></html>`);
});

export default router;
