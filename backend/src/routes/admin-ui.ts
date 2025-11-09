// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

router.get('/ui', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Organiser Console</title>
<style>
  :root{--bg:#f7f8fa;--panel:#fff;--ink:#0f172a;--muted:#6b7280;--accent:#2563eb;--accent-2:#eff6ff;--border:#e5e7eb;--bad:#dc2626;--ok:#16a34a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:5}
  header .brand{font-weight:800} header .user{font-size:14px;color:var(--muted)}
  main{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px;min-height:calc(100vh - 64px)}
  nav{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px}
  nav h4{margin:8px 10px 12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  nav button{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;border-radius:10px;margin:2px 0;font-size:14px;color:var(--ink);cursor:pointer}
  nav button.active,nav button:hover{background:var(--accent-2);color:var(--accent)}
  section.view{background:var(--panel);border:1px solid var(--border);border-radius:14px;min-height:60vh;display:flex;flex-direction:column}
  .toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:14px;border-bottom:1px solid var(--border)}
  .toolbar h2{font-size:16px;margin:0}
  .content{padding:16px}
  .grid{display:grid;gap:12px}.two{grid-template-columns:1fr 1fr}.three{grid-template-columns:repeat(3,1fr)}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  input,select,textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  label{font-size:12px;color:var(--muted)}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}.btn.ghost{background:#fff;border:1px solid var(--border)}
  .note{font-size:13px;color:var(--muted)}
  .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{border-bottom:1px solid var(--border);padding:8px 6px;text-align:left;font-size:14px}
  .danger{color:var(--bad)} .ok{color:var(--ok)}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  canvas{max-width:100%;height:320px;border:1px solid var(--border);border-radius:12px;background:#fff}
</style>
</head>
<body>
<header>
  <div class="brand">Organiser Console</div>
  <div class="user"><span id="userEmail">Not signed in</span></div>
</header>

<main>
  <nav>
    <h4>Dashboard</h4>
    <button data-view="home" class="active">Home</button>
    <button data-view="shows">Shows</button>
    <button data-view="orders">Orders</button>
    <button data-view="venues">Venues</button>
    <h4>Insights</h4>
    <button data-view="analytics">Analytics</button>
    <h4>Marketing</h4>
    <button data-view="audiences">Audiences</button>
    <button data-view="emails">Email Campaigns</button>
    <h4>Settings</h4>
    <button data-view="account">Account</button>
    <button id="btnLogout" class="danger">Log out</button>
  </nav>

  <section class="view">
    <div class="toolbar">
      <h2 id="viewTitle">Home</h2>
      <div id="toolbarActions"></div>
    </div>
    <div class="content" id="viewContent">
      <div class="card">
        <p>Welcome to your organiser console. Use the menu to manage shows, orders, venues, insights and marketing.</p>
        <p class="note">You’ll see more tools appear here as we build them in.</p>
      </div>
    </div>
  </section>
</main>

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const API = (path, opts) => fetch(path, Object.assign({
    credentials:'include',
    headers:{'Content-Type':'application/json'}
  }, opts || {}));
  const fmtMoney = p => '£' + (Number(p || 0)/100).toFixed(2);

  // ===== Views =====
  const views = {
    home(){
      $('#viewTitle').textContent = 'Home';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Recent activity</h4><p class="note">Recent sales, scans and edits will appear here.</p></div>'
        + '<div class="card"><h4>Shortcuts</h4><div class="row">'
        + '<button class="btn ghost" data-goto="shows">Go to Shows</button>'
        + '<button class="btn ghost" data-goto="orders">Go to Orders</button>'
        + '</div></div></div>';
      $('#viewContent').addEventListener('click', function(e){
        const el = e.target.closest('[data-goto]');
        if(!el) return;
        e.preventDefault();
        switchView(el.getAttribute('data-goto'));
      }, { once:true });
    },

    // ---- Analytics (restored) ----
    analytics(){
      $('#viewTitle').textContent = 'Analytics';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="card"><div class="row">'
        + '<div><label>From</label><input id="a_from" type="date"/></div>'
        + '<div><label>To</label><input id="a_to" type="date"/></div>'
        + '<div style="align-self:flex-end"><button class="btn primary" id="a_run">Run</button></div>'
        + '</div><div id="a_msg" class="note" style="margin-top:8px"></div></div>'
        + '<div style="margin-top:12px"><canvas id="a_chart"></canvas></div>';

      $('#a_run').onclick = runAnalytics;

      function parseISO(d){ return d ? new Date(d) : null; }

      async function runAnalytics(){
        const from = $('#a_from').value;
        const to = $('#a_to').value;
        $('#a_msg').textContent = 'Loading…';
        const q = new URLSearchParams();
        if(from) q.set('from', from);
        if(to) q.set('to', to);
        const r = await API('/admin/analytics/summary?'+q.toString());
        const j = await r.json();
        if(!j.ok){ $('#a_msg').textContent = j.message || 'Failed to load analytics'; return; }
        $('#a_msg').textContent =
          'Orders: '+j.totals.orders
          + ' · Tickets: ' + j.totals.tickets
          + ' · Gross: ' + fmtMoney(j.totals.grossPence)
          + ' · Platform fee: ' + fmtMoney(j.totals.platformFeePence)
          + ' · Your share: ' + fmtMoney(j.totals.organiserSharePence);

        drawChart(j.daily || []);
      }

      function drawChart(rows){
        const c = document.getElementById('a_chart');
        const ctx = c.getContext('2d');
        // simple reset
        c.width = c.clientWidth;
        c.height = 320;
        ctx.clearRect(0,0,c.width,c.height);

        // axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.beginPath(); ctx.moveTo(40,10); ctx.lineTo(40,300); ctx.lineTo(c.width-10,300); ctx.stroke();

        const vals = rows.map(r => r.grossPence||0);
        const max = Math.max(100, ...vals);
        const scaleY = 260 / max;

        // labels + bars
        ctx.fillStyle = '#111827';
        ctx.font = '12px system-ui';

        const step = Math.max(1, Math.floor(rows.length / 10));
        rows.forEach((r,i) => {
          const x = 50 + i * Math.max(6, (c.width-80)/Math.max(rows.length, 20));
          const h = (r.grossPence||0) * scaleY;
          // bar
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(x, 300 - h, 4, h);
          // label sparsely
          if(i % step === 0){
            ctx.fillStyle = '#6b7280';
            ctx.fillText(r.date, x-10, 315);
          }
        });
      }
    },

    // ---- Shows / Orders / Venues (unchanged except organiser split moved off Venues) ----
    shows(){
      $('#viewTitle').textContent = 'Shows';
      $('#toolbarActions').innerHTML = '<button class="btn ghost" id="btnRefreshShows">Refresh</button>';
      $('#viewContent').innerHTML = '<div id="showsWrap" class="grid"></div>';
      loadShows();
      $('#toolbarActions').onclick = e => { if (e.target.id==='btnRefreshShows') loadShows(); }
    },

    showDetail(showId){
      $('#viewTitle').textContent = 'Show';
      $('#toolbarActions').innerHTML = '<a class="btn ghost" id="btnBackShows" href="#">Back</a>';
      $('#toolbarActions').onclick = e => { if (e.target.id==='btnBackShows'){ e.preventDefault(); switchView("shows"); } };
      renderShowDetail(showId);
    },

    orders(){
      $('#viewTitle').textContent = 'Orders';
      $('#toolbarActions').innerHTML =
        '<div class="row">'
        + '<input id="ordersQ" placeholder="Search email / Stripe / show"/><button class="btn ghost" id="btnSearchOrders">Search</button>'
        + '</div>';
      $('#viewContent').innerHTML = '<div id="ordersWrap" class="grid"></div>';
      const run = () => loadOrders($('#ordersQ').value || '');
      run();
      $('#toolbarActions').onclick = async e => { if (e.target.id==='btnSearchOrders') run(); }
    },

    orderDetail(orderId){
      $('#viewTitle').textContent = 'Order';
      $('#toolbarActions').innerHTML = '<a class="btn ghost" id="btnBackOrders" href="#">Back</a>';
      $('#toolbarActions').onclick = e => { if (e.target.id==='btnBackOrders'){ e.preventDefault(); switchView("orders"); } };
      renderOrderDetail(orderId);
    },

    venues(){
      $('#viewTitle').textContent = 'Venues';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Create venue</h4><div class="grid">'
        + '<div><label>Name</label><input id="v_name"/></div>'
        + '<div><label>Address</label><input id="v_address"/></div>'
        + '<div><label>City</label><input id="v_city"/></div>'
        + '<div><label>Postcode</label><input id="v_postcode"/></div>'
        + '<div><label>Capacity</label><input id="v_capacity" type="number" min="0"/></div>'
        + '<hr/>'
        + '<div><label>% fee (bps, 1000=10%)</label><input id="v_fee_bps" type="number" min="0" placeholder="e.g. 1000"/></div>'
        + '<div><label>Per-ticket fee (p)</label><input id="v_fee_ticket" type="number" min="0" placeholder="e.g. 50"/></div>'
        + '<div><label>Basket fee (p)</label><input id="v_fee_basket" type="number" min="0" placeholder="e.g. 30"/></div>'
        + '<div class="row"><button class="btn primary" id="btnCreateVenue">Save venue</button></div>'
        + '<div class="note" id="venueMsg"></div></div></div>'

        + '<div class="card"><h4>Find & edit venues</h4>'
        + '<div class="row"><input id="q" placeholder="Search by name/city/postcode"/><button class="btn ghost" id="btnFind">Search</button></div>'
        + '<div id="venuesList" class="grid" style="margin-top:8px"></div></div>'
        + '</div>';

      $('#viewContent').onclick = async e => {
        if (e.target && e.target.id === 'btnCreateVenue') {
          const body = {
            name: $('#v_name').value,
            address: $('#v_address').value,
            city: $('#v_city').value,
            postcode: $('#v_postcode').value,
            capacity: Number($('#v_capacity').value || 0),
            feePercentBps: numOrNull($('#v_fee_bps').value),
            perTicketFeePence: numOrNull($('#v_fee_ticket').value),
            basketFeePence: numOrNull($('#v_fee_basket').value),
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

            return '<div class="card" data-venue="'+v.id+'">'
              + '<b>'+escapeHtml(v.name)+'</b><div class="note">'+escapeHtml(meta)+'</div><div class="note">Capacity: '+cap+'</div>'
              + '<div class="grid three" style="margin-top:8px">'
              +   '<div><label>% fee (bps)</label><input class="fee_bps" type="number" min="0" value="'+valOrEmpty(v.feePercentBps)+'"/></div>'
              +   '<div><label>Per-ticket fee (p)</label><input class="fee_ticket" type="number" min="0" value="'+valOrEmpty(v.perTicketFeePence)+'"/></div>'
              +   '<div><label>Basket fee (p)</label><input class="fee_basket" type="number" min="0" value="'+valOrEmpty(v.basketFeePence)+'"/></div>'
              + '</div>'
              + '<div style="margin-top:8px;display:flex;justify-content:flex-end;"><button class="btn ghost v_save">Save</button></div>'
              + '</div>';
          }).join('');
        }

        const card = e.target && e.target.closest && e.target.closest('[data-venue]');
        if (card && e.target && e.target.classList.contains('v_save')) {
          const id = card.getAttribute('data-venue');
          const fee_bps = numOrNull(card.querySelector('.fee_bps')?.value);
          const fee_ticket = numOrNull(card.querySelector('.fee_ticket')?.value);
          const fee_basket = numOrNull(card.querySelector('.fee_basket')?.value);

          const r = await API('/admin/venues/'+encodeURIComponent(id), {
            method:'PATCH',
            body: JSON.stringify({
              feePercentBps: fee_bps,
              perTicketFeePence: fee_ticket,
              basketFeePence: fee_basket,
            })
          });
          const j = await r.json();
          const msg = document.createElement('div');
          msg.className = 'note';
          msg.textContent = j.ok ? 'Updated.' : (j.message || 'Failed to update');
          card.appendChild(msg);
          setTimeout(()=>msg.remove(),2000);
        }
      };

      function numOrNull(v){ return (v === '' || v === undefined || v === null) ? null : Number(v); }
      function valOrEmpty(v){ return (v === null || v === undefined) ? '' : String(v); }
      function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
    },

    audiences(){
      $('#viewTitle').textContent = 'Audiences';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="note">Audience tools coming soon.</div>';
    },

    emails(){
      $('#viewTitle').textContent = 'Email Campaigns';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="note">Scheduler + templates placeholder.</div>';
    },

    // ---- Account: organiser split lives here ----
    account(){
      $('#viewTitle').textContent = 'Account';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Organiser settings</h4>'
        + '<div class="grid">'
        +   '<div><label>Organiser split (bps, 5000 = 50%)</label><input id="acc_split_bps" type="number" min="0" max="10000" placeholder="e.g. 5000"/></div>'
        +   '<div class="row"><button class="btn primary" id="acc_save">Save</button></div>'
        +   '<div class="note" id="acc_msg"></div>'
        + '</div></div>'
        + '<div class="card"><h4>Password</h4><p class="note">Password tools coming soon.</p></div>'
        + '</div>';

      (async () => {
        const r = await API('/admin/account');
        const j = await r.json();
        if(j.ok && j.user){
          $('#userEmail').textContent = j.user.email || 'Signed in';
          if (j.user.organiserSplitBps != null) {
            (document.getElementById('acc_split_bps') as any).value = String(j.user.organiserSplitBps);
          }
        }
      })();

      document.getElementById('acc_save')?.addEventListener('click', async () => {
        const organiserSplitBps = Number((document.getElementById('acc_split_bps') as any).value || 0);
        const r = await API('/admin/account', { method: 'PATCH', body: JSON.stringify({ organiserSplitBps })});
        const j = await r.json();
        (document.getElementById('acc_msg') as any).textContent = j.ok ? 'Saved.' : (j.message || 'Failed to save');
      });
    }
  };

  // ===== Shows / Orders detail helpers (unchanged from your last working copy) =====
  async function loadShows(){
    const wrap = document.getElementById('showsWrap');
    wrap.innerHTML = '<div class="note">Loading…</div>';
    const r = await API('/admin/shows/latest?limit=50');
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load shows</div>'; return; }
    if(!j.shows || j.shows.length===0){ wrap.innerHTML = '<div class="note">No shows yet.</div>'; return; }
    wrap.innerHTML = j.shows.map(s => {
      const d = new Date(s.date);
      const when = d.toLocaleString();
      const venue = s.venue ? [s.venue.name,s.venue.city,s.venue.postcode].filter(Boolean).join(', ') : '—';
      return '<div class="card">'
        + '<div class="row" style="justify-content:space-between;align-items:center">'
        +   '<div>'
        +     '<div><b>'+s.title+'</b></div>'
        +     '<div class="note">'+when+' — '+venue+'</div>'
        +   '</div>'
        +   '<div><button class="btn ghost" data-show="'+s.id+'">Open</button></div>'
        + '</div>'
        + '</div>';
    }).join('');
    wrap.onclick = e => {
      const btn = (e.target as any).closest('[data-show]');
      if(!btn) return;
      const id = btn.getAttribute('data-show');
      switchView('showDetail', id);
    };
  }

  async function renderShowDetail(showId){
    const wrap = document.getElementById('viewContent');
    const r = await API('/admin/shows/'+encodeURIComponent(showId));
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load show</div>'; return; }
    const { show, kpis } = j;

    wrap.innerHTML =
      '<div class="grid">'
      + '<div class="card"><h3 style="margin:0 0 8px">'+show.title+'</h3>'
      + '<div class="note">'+(show.venue ? (show.venue.name + (show.venue.city ? (', '+show.venue.city) : '')) : '—')+'</div>'
      + '<div class="note">Date: '+new Date(show.date).toLocaleString()+'</div></div>'
      + '<div class="kpis">'
      +   '<div class="kpi"><div class="note">Capacity</div><div style="font-size:20px;font-weight:700">'+(kpis.capacity ?? '—')+'</div></div>'
      +   '<div class="kpi"><div class="note">Total Available</div><div style="font-size:20px;font-weight:700">'+(kpis.totalAvailable ?? 0)+'</div></div>'
      +   '<div class="kpi"><div class="note">Tickets Sold</div><div style="font-size:20px;font-weight:700">'+(kpis.ticketsSold ?? 0)+'</div></div>'
      +   '<div class="kpi"><div class="note">Revenue</div><div style="font-size:20px;font-weight:700)">'+fmtMoney(kpis.revenuePence)+'</div></div>'
      + '</div>'
      + '<div class="grid two">'
      +   '<div class="card">'
      +     '<h4 style="margin-top:0">Ticket Types</h4>'
      +     '<table class="table"><thead><tr><th>Name</th><th>Price</th><th>Avail.</th><th></th></tr></thead>'
      +     '<tbody id="ttBody"></tbody></table>'
      +     '<div class="row" style="margin-top:8px">'
      +       '<input id="tt_name" placeholder="Name"/>'
      +       '<input id="tt_price" type="number" placeholder="Price (pence)"/>'
      +       '<input id="tt_avail" type="number" placeholder="Available"/>'
      +       '<button class="btn primary" id="btnAddTT">Add</button>'
      +     '</div>'
      +     '<div class="note" id="ttMsg"></div>'
      +   '</div>'
      +   '<div class="card">'
      +     '<h4 style="margin-top:0">Attendees</h4>'
      +     '<p class="note">Download a CSV for door list or marketing exports.</p>'
      +     '<a class="btn ghost" href="/admin/shows/'+show.id+'/attendees.csv" target="_blank" rel="noopener">Download CSV</a>'
      +   '</div>'
      + '</div>'
      + '</div>';

    // render ticket types (same as previous working copy)…
  }

  async function loadOrders(q){
    const wrap = document.getElementById('ordersWrap');
    wrap.innerHTML = '<div class="note">Loading…</div>';
    const r = await API('/admin/orders?q='+encodeURIComponent(q||'')+'&limit=50');
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load orders</div>'; return; }
    if(!j.items || j.items.length===0){ wrap.innerHTML = '<div class="note">No orders found.</div>'; return; }
    wrap.innerHTML = '<table class="table"><thead><tr><th>Date</th><th>Email</th><th>Show</th><th>Qty</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'
      + j.items.map(o => {
          const when = new Date(o.createdAt).toLocaleString();
          const show = o.show ? (o.show.title + ' (' + new Date(o.show.date).toLocaleDateString() + ')') : '—';
          return '<tr>'
            + '<td>'+when+'</td>'
            + '<td>'+(o.email||'—')+'</td>'
            + '<td>'+show+'</td>'
            + '<td>'+(o.quantity ?? '—')+'</td>'
            + '<td>'+fmtMoney(o.amountPence)+'</td>'
            + '<td>'+o.status+'</td>'
            + '<td><button class="btn ghost" data-open-order="'+o.id+'">Open</button></td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
    wrap.onclick = e => {
      const btn = (e.target as any).closest('[data-open-order]');
      if(!btn) return;
      switchView('orderDetail', btn.getAttribute('data-open-order'));
    };
  }

  // ===== Navigation / auth =====
  function switchView(name, arg){
    document.querySelectorAll('nav button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view')===name);
    });
    if (name === 'showDetail') return views.showDetail(arg);
    if (name === 'orderDetail') return views.orderDetail(arg);
    if (views[name]) views[name](); else views.home();
  }

  document.querySelectorAll('nav button[data-view]').forEach(btn=>{
    btn.addEventListener('click', e => {
      e.preventDefault();
      switchView(btn.getAttribute('data-view'));
    });
  });

  async function ensureAuth(){
    const me = await fetch('/auth/me', { credentials: 'include' });
    if(me.status===200){
      const j = await me.json();
      $('#userEmail').textContent = (j.user && j.user.email) ? j.user.email : 'Signed in';
      return true;
    } else {
      // show login overlay if you have it elsewhere
      return true; // keep UI visible for now
    }
  }

  $('#btnLogout').addEventListener('click', async function(){
    await API('/auth/logout', { method:'POST' });
    location.reload();
  });

  (async function boot(){
    const ok = await ensureAuth();
    if(ok) switchView('home');
  })();
})();
</script>
</body>
</html>`);
});

export default router;
