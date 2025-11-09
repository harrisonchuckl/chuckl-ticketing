// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * Admin UI (HTML shell with client-side views)
 * We deliberately do *not* import server types or JSX here — this is a plain
 * Express route that returns HTML as a string so tsc can compile cleanly.
 */
router.get(['/admin', '/admin/'], (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="x-ua-compatible" content="ie=edge"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Organiser Console</title>
  <style>
    :root { --fg:#0f172a; --muted:#64748b; --bg:#ffffff; --line:#e2e8f0; --red:#dc2626; --blue:#2563eb; }
    *{ box-sizing:border-box; }
    body{ margin:0; font:14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:var(--fg); background:var(--bg);}
    .shell{ display:grid; grid-template-columns: 240px 1fr; min-height:100vh;}
    aside{ border-right:1px solid var(--line); padding:16px;}
    main{ padding:16px 20px 80px; }
    h3{ margin:6px 0 16px; font-size:16px; }
    h4{ margin:0 0 10px; font-size:14px; }
    .brand{ font-weight:600; margin-bottom:8px;}
    nav .group{ font-size:11px; color:var(--muted); text-transform:uppercase; margin:14px 0 6px;}
    nav a{ display:block; padding:8px 10px; margin:4px 0; border-radius:8px; color:var(--fg); text-decoration:none;}
    nav a.active{ background:#f1f5f9; }
    .row{ display:flex; gap:8px; align-items:center; }
    .grid{ display:grid; gap:12px; }
    .grid.two{ grid-template-columns: 1fr 1fr; }
    .card{ border:1px solid var(--line); border-radius:12px; padding:12px; background:#fff;}
    label{ display:block; font-size:12px; color:var(--muted); margin-bottom:4px;}
    input, select, textarea{ width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; }
    input[type="date"]{ padding:6px 8px; }
    .btn{ appearance:none; border:1px solid var(--line); background:#fff; padding:8px 12px; border-radius:8px; cursor:pointer; }
    .btn.primary{ background:var(--blue); color:#fff; border-color:var(--blue); }
    .btn.ghost{ background:#fff; }
    .muted{ color:var(--muted); }
    .danger{ color:var(--red); }
    .note{ color:var(--muted); font-size:12px; margin-top:6px;}
    .toolbar{ display:flex; gap:8px; align-items:center; justify-content:flex-end; margin-bottom:12px; }
    .spacer{ flex:1; }
    .table{ width:100%; border-collapse:collapse; }
    .table th, .table td{ padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    @media (max-width: 920px){ .grid.two{ grid-template-columns: 1fr; } .shell{ grid-template-columns: 1fr; } aside{ border-right:none; border-bottom:1px solid var(--line);} }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand">Organiser Console</div>
      <div id="userEmail" class="muted" style="font-size:12px;margin-bottom:10px;"></div>
      <nav>
        <div class="group">Dashboard</div>
        <a href="#home" data-view="home" class="active">Home</a>
        <a href="#shows" data-view="shows">Shows</a>
        <a href="#orders" data-view="orders">Orders</a>
        <a href="#venues" data-view="venues">Venues</a>
        <div class="group">Insights</div>
        <a href="#analytics" data-view="analytics">Analytics</a>
        <div class="group">Marketing</div>
        <a href="#audiences" data-view="audiences">Audiences</a>
        <a href="#email" data-view="email">Email Campaigns</a>
        <div class="group">Settings</div>
        <a href="#account" data-view="account">Account</a>
        <a href="/auth/logout" class="danger">Log out</a>
      </nav>
    </aside>
    <main>
      <div class="toolbar">
        <div class="spacer"></div>
        <div id="toolbarActions"></div>
      </div>
      <h3 id="viewTitle">Home</h3>
      <div id="viewContent" class="card">
        Welcome to your organiser console. Use the menu to manage shows, orders, venues, and marketing.
        <div class="note">You’ll see more tools appear here as we build them in.</div>
      </div>
    </main>
  </div>

  <script>
  // Small DOM helpers
  const $ = (sel, el=document) => el.querySelector(sel);

  // Generic fetch wrapper that sends/accepts JSON and cookies
  async function API(path, init){
    const opts = Object.assign({ credentials:'include', headers: { 'Content-Type':'application/json' } }, init || {});
    return fetch(path, opts);
  }

  // Left nav clicks
  $('aside').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-view]');
    if (!a) return;
    e.preventDefault();
    for(const n of document.querySelectorAll('aside nav a')) n.classList.remove('active');
    a.classList.add('active');
    const v = a.getAttribute('data-view');
    if (views[v]) views[v]();
    history.replaceState(null, '', '#' + v);
  });

  // Top-right user display (best-effort; ignore errors)
  (async () => {
    try{
      const r = await API('/auth/me');
      if (r.ok){
        const j = await r.json();
        if (j && j.email) $('#userEmail').textContent = j.email;
      }
    }catch{}
  })();

  const views = {
    home(){
      $('#viewTitle').textContent = 'Home';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="card">Welcome to your organiser console. Use the menu to manage shows, orders, venues, and marketing.'
        + '<div class="note">You’ll see more tools appear here as we build them in.</div>'
        + '</div>';
    },

    shows(){
      $('#viewTitle').textContent = 'Shows';
      $('#toolbarActions').innerHTML = '<button class="btn ghost" id="btnRefreshShows">Refresh</button>';
      $('#viewContent').innerHTML = '<div id="showsWrap" class="card">Loading…</div>';

      const load = async () => {
        try{
          const r = await API('/admin/shows');
          const j = await r.json();
          if(!j.ok) throw new Error(j.message||'Failed to load shows');
          const rows = (j.items||[]).map(s =>
            '<tr><td>'+escapeHtml(s.title||'')+'</td>'
            + '<td>'+(s.date ? new Date(s.date).toLocaleString() : '')+'</td>'
            + '<td>'+escapeHtml((s.venue && s.venue.name) || '')+'</td></tr>'
          ).join('');
          $('#showsWrap').innerHTML =
            '<div class="card"><div class="row"><input id="s_q" placeholder="Search shows"/><button class="btn ghost" id="s_find">Search</button></div></div>'
            + '<div class="card" style="margin-top:12px;"><table class="table"><thead><tr><th>Title</th><th>Date</th><th>Venue</th></tr></thead><tbody>'
            + rows + '</tbody></table></div>';
        }catch(e){
          $('#showsWrap').innerHTML = '<p class="danger">Failed to load shows</p>';
        }
      };
      load();

      $('#toolbarActions').onclick = (e) => { if(e.target.id==='btnRefreshShows') load(); };
      $('#viewContent').onclick = async (e) => {
        if (e.target && e.target.id === 's_find'){
          const q = $('#s_q').value || '';
          const r = await API('/admin/shows?q='+encodeURIComponent(q));
          const j = await r.json();
          const rows = (j.items||[]).map(s =>
            '<tr><td>'+escapeHtml(s.title||'')+'</td>'
            + '<td>'+(s.date ? new Date(s.date).toLocaleString() : '')+'</td>'
            + '<td>'+escapeHtml((s.venue && s.venue.name) || '')+'</td></tr>'
          ).join('');
          $('#showsWrap').innerHTML =
            '<div class="card"><div class="row"><input id="s_q" placeholder="Search shows"/><button class="btn ghost" id="s_find">Search</button></div></div>'
            + '<div class="card" style="margin-top:12px;"><table class="table"><thead><tr><th>Title</th><th>Date</th><th>Venue</th></tr></thead><tbody>'
            + rows + '</tbody></table></div>';
        }
      };
    },

    orders(){
      $('#viewTitle').textContent = 'Orders';
      $('#toolbarActions').innerHTML = '<a class="btn ghost" href="/admin/orders/export.csv">Export CSV</a>';
      $('#viewContent').innerHTML =
        '<div class="card">'
        + '<div class="row"><input id="o_q" placeholder="Search email / Stripe / show"/>'
        + '<button class="btn primary" id="o_search">Search</button></div>'
        + '</div>'
        + '<div class="card" style="margin-top:12px;" id="ordersList">Enter a search.</div>';

      $('#viewContent').onclick = async (e) => {
        if (e.target && e.target.id === 'o_search') {
          const q = $('#o_q').value || '';
          const r = await API('/admin/orders?q='+encodeURIComponent(q));
          const j = await r.json();
          if(!j.ok){ $('#ordersList').innerHTML = '<p class="danger">Failed to load orders</p>'; return; }
          const rows = (j.items||[]).map(o => {
            const when = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
            return '<tr>'
              + '<td class="mono">'+(o.id||'')+'</td>'
              + '<td>'+(o.email||'')+'</td>'
              + '<td>'+(o.amountPence!=null ? '£'+(o.amountPence/100).toFixed(2) : '')+'</td>'
              + '<td>'+(o.status||'')+'</td>'
              + '<td>'+(o.show && o.show.title ? escapeHtml(o.show.title) : '')+'</td>'
              + '<td>'+(when)+'</td>'
              + '</tr>';
          }).join('');
          $('#ordersList').innerHTML =
            '<table class="table"><thead><tr>'
            + '<th>ID</th><th>Email</th><th>Amount</th><th>Status</th><th>Show</th><th>Created</th>'
            + '</tr></thead><tbody>'+rows+'</tbody></table>';
        }
      };
    },

    // ===== VENUES with fee profile fields =====
    venues(){
      $('#viewTitle').textContent = 'Venues';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Create / edit venue</h4><div class="grid">'
        +   '<div><label>Name</label><input id="v_name"/></div>'
        +   '<div><label>Address</label><input id="v_address"/></div>'
        +   '<div><label>City</label><input id="v_city"/></div>'
        +   '<div><label>Postcode</label><input id="v_postcode"/></div>'
        +   '<div><label>Capacity</label><input id="v_capacity" type="number" min="0"/></div>'
        +   '<hr/>'
        +   '<div><label>Fee % (bps)</label><input id="v_feePercentBps" type="number" min="0" max="10000" placeholder="e.g. 1000 = 10.00%"/></div>'
        +   '<div><label>Per-ticket fee (pence)</label><input id="v_perTicketFeePence" type="number" min="0" placeholder="e.g. 50"/></div>'
        +   '<div><label>Basket fee (pence)</label><input id="v_basketFeePence" type="number" min="0" placeholder="e.g. 99"/></div>'
        +   '<div><label>Organiser split (bps)</label><input id="v_organiserSplitBps" type="number" min="0" max="10000" placeholder="5000 = 50/50"/></div>'
        +   '<div class="row"><button class="btn primary" id="btnCreateVenue">Save venue</button></div>'
        +   '<div class="note" id="venueMsg"></div></div></div>'
        + '<div class="card"><h4>Find venues</h4>'
        +   '<div class="row"><input id="q" placeholder="Search by name/city/postcode"/><button class="btn ghost" id="btnFind">Search</button></div>'
        +   '<div id="venuesList" class="grid" style="margin-top:8px"></div></div>'
        + '</div>';

      $('#viewContent').onclick = async e => {
        if (e.target && e.target.id === 'btnCreateVenue') {
          const body = {
            name: $('#v_name').value,
            address: $('#v_address').value,
            city: $('#v_city').value,
            postcode: $('#v_postcode').value,
            capacity: Number($('#v_capacity').value || 0),

            feePercentBps: Number($('#v_feePercentBps').value || 0),
            perTicketFeePence: Number($('#v_perTicketFeePence').value || 0),
            basketFeePence: Number($('#v_basketFeePence').value || 0),
            organiserSplitBps: Number($('#v_organiserSplitBps').value || 5000),
          };
          const r = await API('/admin/venues', { method:'POST', body: JSON.stringify(body) });
          const j = await r.json();
          $('#venueMsg').textContent = j.ok ? 'Saved.' : (j.message || 'Failed');
        }
        if (e.target && e.target.id === 'btnFind') {
          const q = $('#q').value || '';
          const r = await API('/admin/venues?q=' + encodeURIComponent(q));
          const j = await r.json();
          const wrap = $('#venuesList');
          if(!j.ok){ wrap.innerHTML = '<p class="danger">Failed.</p>'; return; }
          wrap.innerHTML = (j.venues||[]).map(v => {
            const meta = [v.address, v.city, v.postcode].filter(Boolean).join(', ') || '—';
            const cap = (v.capacity != null) ? v.capacity : '—';
            const fees = [
              (v.feePercentBps||0) ? ('%' + (v.feePercentBps/100).toFixed(2)) : null,
              (v.perTicketFeePence||0) ? ('+' + v.perTicketFeePence + 'p/tkt') : null,
              (v.basketFeePence||0) ? ('+' + v.basketFeePence + 'p basket') : null,
              'org split ' + ((v.organiserSplitBps||5000)/100).toFixed(2) + '%'
            ].filter(Boolean).join(' · ');
            return '<div class="card"><b>'+escapeHtml(v.name||'')+'</b>'
              + '<div class="note">'+escapeHtml(meta)+'</div>'
              + '<div class="note">Capacity: '+cap+'</div>'
              + '<div class="note">Fees: '+(fees || 'none')+'</div>'
              + '</div>';
          }).join('');
        }
      };
    },

    analytics(){
      $('#viewTitle').textContent = 'Analytics';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="row" style="gap:12px;">'
        + '<input id="a_start" type="date"/>'
        + '<input id="a_end" type="date"/>'
        + '<button class="btn primary" id="a_run">Run</button></div>'
        + '<div class="card" style="margin-top:12px;"><canvas id="a_chart" height="160" style="width:100%;"></canvas></div>'
        + '<div id="a_msg" class="note"></div>';

      $('#viewContent').onclick = async (e) => {
        if (e.target && e.target.id === 'a_run') {
          const start = $('#a_start').value;
          const end = $('#a_end').value;
          const r = await API('/admin/analytics/sales?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
          const j = await r.json();
          if(!j.ok){ $('#a_msg').textContent = j.message || 'Failed to load analytics'; return; }
          drawSimpleLineChart($('#a_chart'), (j.points||[]));
          $('#a_msg').textContent = '';
        }
      };
    },

    audiences(){
      $('#viewTitle').textContent = 'Audiences';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="card muted">Audiences module coming soon.</div>';
    },

    email(){
      $('#viewTitle').textContent = 'Email Campaigns';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="card muted">Email campaigns module coming soon.</div>';
    },

    account(){
      $('#viewTitle').textContent = 'Account';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="card muted">Account settings will appear here.</div>';
    },
  };

  function escapeHtml(s){
    return String(s==null?'':s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  // Tiny line chart (no external libs)
  function drawSimpleLineChart(canvas, points){
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth;
    const H = canvas.height = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    if(!points || !points.length){ ctx.fillStyle='#9ca3af'; ctx.fillText('No data', 10, 20); return; }

    const xs = points.map(p => +new Date(p.date || p.day || p.x));
    const ys = points.map(p => Number(p.amountPence || p.y || 0));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = 0, maxY = Math.max(...ys, 1);

    const px = (x) => 20 + (W-40) * ((x - minX) / Math.max(1, (maxX-minX)));
    const py = (y) => H-20 - (H-40) * ((y - minY) / Math.max(1, (maxY-minY)));

    // axes
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(20, H-20); ctx.lineTo(W-10, H-20); ctx.stroke();

    // line
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p,i) => { const x=px(+new Date(p.date||p.day||p.x)); const y=py(Number(p.amountPence||p.y||0)); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke();
  }

  // Initial view from hash
  const initial = (location.hash||'#home').slice(1);
  const link = document.querySelector('aside nav a[data-view="'+initial+'"]') || document.querySelector('aside nav a[data-view="home"]');
  if (link){ link.click(); }
  </script>
</body>
</html>`);
});

export default router;
