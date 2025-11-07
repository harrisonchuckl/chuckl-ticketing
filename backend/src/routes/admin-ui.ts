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
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:5}
  header .brand{font-weight:800}
  header .user{font-size:14px;color:var(--muted)}
  main{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px;min-height:calc(100vh - 64px)}
  nav{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px}
  nav h4{margin:8px 10px 12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  nav button{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;border-radius:10px;margin:2px 0;font-size:14px;color:var(--ink);cursor:pointer}
  nav button.active,nav button:hover{background:var(--accent-2);color:var(--accent)}
  section.view{background:var(--panel);border:1px solid var(--border);border-radius:14px;min-height:60vh;position:relative;overflow:hidden}
  .toolbar{display:flex;gap:8px;align-items:center;padding:14px;border-bottom:1px solid var(--border)}
  .toolbar h2{font-size:16px;margin:0}
  .content{padding:16px}
  .grid{display:grid;gap:12px}
  .two{grid-template-columns:1fr 1fr}
  .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  input,select,textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  label{font-size:12px;color:var(--muted)}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}
  .btn.ghost{background:#fff;border:1px solid var(--border)}
  .btn.danger{background:#fee2e2;color:#b91c1c;border:1px solid #fecaca}
  .note{font-size:13px;color:var(--muted)}
  .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .danger{color:var(--bad)} .ok{color:var(--ok)}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px;border-bottom:1px solid var(--border);text-align:left;font-size:14px}
  th{font-weight:700}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .kpis .card h3{margin:0 0 4px;font-size:18px}
  .kpis .card .sub{color:var(--muted);font-size:12px}

  /* Drawer */
  .drawer{position:absolute;top:0;right:-480px;width:480px;height:100%;background:#fff;border-left:1px solid var(--border);box-shadow:-8px 0 24px rgba(15,23,42,0.06);transition:right .24s ease;display:flex;flex-direction:column;z-index:20}
  .drawer.show{right:0}
  .drawer .head{display:flex;align-items:center;justify-content:space-between;padding:14px;border-bottom:1px solid var(--border)}
  .drawer .body{padding:14px;overflow:auto}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--border);font-size:12px;color:var(--muted)}
  .row.clickable tr{cursor:pointer}
  .toast{position:fixed;bottom:16px;right:16px;background:#0f172a;color:#fff;padding:10px 12px;border-radius:10px;opacity:0;transform:translateY(6px);transition:.2s}
  .toast.show{opacity:1;transform:translateY(0)}
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
    <button data-view="venues">Venues</button>
    <button data-view="orders">Orders</button>
    <h4>Marketing</h4>
    <button data-view="audiences">Audiences</button>
    <button data-view="emails">Email Campaigns</button>
    <h4>Settings</h4>
    <button data-view="account">Account</button>
    <button id="btnLogout" class="danger">Log out</button>
  </nav>

  <section class="view">
    <div class="toolbar"><h2 id="viewTitle">Home</h2></div>
    <div class="content" id="viewContent">
      <div class="grid">
        <div class="kpis">
          <div class="card">
            <h3 id="kpiSales">£0.00</h3>
            <div class="sub">Sales (last 7 days)</div>
          </div>
          <div class="card">
            <h3 id="kpiOrders">0</h3>
            <div class="sub">Orders (last 7 days)</div>
          </div>
          <div class="card">
            <h3 id="kpiTickets">0</h3>
            <div class="sub">Tickets issued</div>
          </div>
          <div class="card">
            <h3 id="kpiUpcoming">0</h3>
            <div class="sub">Upcoming shows</div>
          </div>
        </div>
        <div class="card">
          <h4>Recent activity</h4>
          <p class="note">Recent sales, scans and edits will appear here.</p>
        </div>
        <div class="card">
          <h4>Shortcuts</h4>
          <div class="row">
            <button class="btn ghost" data-goto="shows">Create show</button>
            <button class="btn ghost" data-goto="venues">Add venue</button>
            <button class="btn ghost" data-goto="orders">View orders</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawer -->
    <div class="drawer" id="drawer">
      <div class="head">
        <div style="font-weight:700" id="drawerTitle">Order</div>
        <button class="btn ghost" id="drawerClose">Close</button>
      </div>
      <div class="body" id="drawerBody">
        <div class="note">Loading…</div>
      </div>
    </div>
  </section>
</main>

<div class="overlay" id="loginOverlay" style="backdrop-filter:blur(0px);">
  <div class="login" style="width:360px;background:#fff;border-radius:14px;border:1px solid var(--border);padding:18px">
    <h3>Sign in</h3>
    <p class="note" id="loginNote">Use your organiser account.</p>
    <div class="grid">
      <div><label>Email</label><input id="email" type="email" placeholder="you@venue.com"/></div>
      <div><label>Password</label><input id="password" type="password" placeholder="••••••••"/></div>
      <div class="row">
        <button class="btn primary" id="btnLogin">Sign in</button>
        <button class="btn ghost" id="btnDemo">Quick demo user</button>
      </div>
      <div class="note" id="loginError" style="color:#dc2626;display:none;"></div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const API = (path, opts) => fetch(path, Object.assign({
    credentials:'include',
    headers:{'Content-Type':'application/json'}
  }, opts || {}));

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 2000);
  }

  // ---- Views ----
  const views = {
    home(){
      $('#viewTitle').textContent = 'Home';
      $('#viewContent').querySelectorAll('[data-goto]').forEach((btn)=>{
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          switchView(btn.getAttribute('data-view') || btn.getAttribute('data-goto'));
        });
      });
    },

    shows(){
      $('#viewTitle').textContent = 'Shows';
      $('#viewContent').innerHTML =
        '<div class="row"><button class="btn primary" id="btnRefreshShows">Refresh shows</button></div>'
        + '<div id="showsWrap" class="grid"></div>';
      loadShows();
      $('#viewContent').addEventListener('click', function(e){
        if (e.target && e.target.id === 'btnRefreshShows') loadShows();
      });
    },

    venues(){
      $('#viewTitle').textContent = 'Venues';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Create venue</h4><div class="grid">'
        + '<div><label>Name</label><input id="v_name"/></div>'
        + '<div><label>Address</label><input id="v_address"/></div>'
        + '<div><label>City</label><input id="v_city"/></div>'
        + '<div><label>Postcode</label><input id="v_postcode"/></div>'
        + '<div><label>Capacity</label><input id="v_capacity" type="number" min="0"/></div>'
        + '<div class="row"><button class="btn primary" id="btnCreateVenue">Save venue</button></div>'
        + '<div class="note" id="venueMsg"></div></div></div>'
        + '<div class="card"><h4>Find venues</h4>'
        + '<div class="row"><input id="q" placeholder="Search by name/city/postcode"/><button class="btn ghost" id="btnFind">Search</button></div>'
        + '<div id="venuesList" class="grid" style="margin-top:8px"></div></div></div>';
      $('#viewContent').addEventListener('click', async function(e){
        if (e.target && e.target.id === 'btnCreateVenue') {
          const body = {
            name: $('#v_name').value,
            address: $('#v_address').value,
            city: $('#v_city').value,
            postcode: $('#v_postcode').value,
            capacity: Number($('#v_capacity').value || 0)
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
          wrap.innerHTML = (j.venues||[]).map(function(v){
            const meta = [v.address, v.city, v.postcode].filter(Boolean).join(', ') || '—';
            const cap = (v.capacity != null) ? v.capacity : '—';
            return '<div class="card"><b>'+v.name+'</b><div class="note">'+meta+'</div><div class="note">Capacity: '+cap+'</div></div>';
          }).join('');
        }
      });
    },

    orders(){
      $('#viewTitle').textContent = 'Orders';
      $('#viewContent').innerHTML =
        '<div class="card"><div class="grid two">'
        + '<div><label>Search</label><input id="f_q" placeholder="Email, Stripe ID, show, venue"/></div>'
        + '<div><label>Status</label><select id="f_status"><option value="">Any</option><option value="PENDING">PENDING</option><option value="PAID">PAID</option><option value="CANCELLED">CANCELLED</option></select></div>'
        + '<div><label>From</label><input id="f_from" type="date"/></div>'
        + '<div><label>To</label><input id="f_to" type="date"/></div>'
        + '<div class="row"><button class="btn primary" id="btnLoadOrders">Load</button><button class="btn ghost" id="btnExportCSV">Export CSV</button></div>'
        + '</div></div>'
        + '<div class="card"><div class="row"><div class="note" id="ordersMeta"></div></div>'
        + '<div style="overflow:auto"><table id="ordersTable" class="row clickable">'
        + '<thead><tr>'
        + '<th>Date</th><th>Email</th><th>Show</th><th>Venue</th><th>Qty</th><th>Amount</th><th>Status</th><th>Stripe ID</th>'
        + '</tr></thead><tbody></tbody></table></div></div>';

      const load = async () => {
        const params = new URLSearchParams();
        const q = $('#f_q').value.trim();
        const status = $('#f_status').value;
        const from = $('#f_from').value;
        const to = $('#f_to').value;
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        if (from) params.set('from', new Date(from).toISOString());
        if (to) params.set('to', new Date(to).toISOString());
        params.set('limit', '200');
        const r = await API('/admin/orders?' + params.toString());
        const j = await r.json();
        if(!j.ok){ $('#ordersMeta').textContent = 'Failed to load.'; return; }
        $('#ordersMeta').textContent = 'Showing ' + j.rows.length + ' of ' + j.total;
        const tbody = $('#ordersTable').querySelector('tbody');
        tbody.innerHTML = j.rows.map((o) => {
          const when = new Date(o.createdAt).toLocaleString();
          const venue = (o.show && o.show.venue) ? [o.show.venue.name, o.show.venue.city].filter(Boolean).join(', ') : '—';
          const showTitle = o.show ? o.show.title : '—';
          const amount = '£' + ((o.amountPence ?? 0)/100).toFixed(2);
          const stripeShort = o.stripeId ? (o.stripeId.length > 12 ? o.stripeId.slice(0,12)+'…' : o.stripeId) : '—';
          return '<tr data-id="'+o.id+'">'
            + '<td>'+when+'</td>'
            + '<td>'+ (o.email || '—') +'</td>'
            + '<td>'+ showTitle +'</td>'
            + '<td>'+ venue +'</td>'
            + '<td>'+ (o.quantity ?? 0) +'</td>'
            + '<td>'+ amount +'</td>'
            + '<td><span class="badge">'+ (o.status || '—') +'</span></td>'
            + '<td>'+ stripeShort +'</td>'
            + '</tr>';
        }).join('');
      };

      $('#viewContent').addEventListener('click', function(e){
        if (e.target && e.target.id === 'btnLoadOrders') load();
        if (e.target && e.target.id === 'btnExportCSV') {
          const params = new URLSearchParams();
          const q = $('#f_q').value.trim();
          const status = $('#f_status').value;
          const from = $('#f_from').value;
          const to = $('#f_to').value;
          if (q) params.set('q', q);
          if (status) params.set('status', status);
          if (from) params.set('from', new Date(from).toISOString());
          if (to) params.set('to', new Date(to).toISOString());
          window.location.href = '/admin/orders/export?' + params.toString();
        }

        const row = e.target.closest('tr[data-id]');
        if (row) {
          const id = row.getAttribute('data-id');
          openDrawer(id);
        }
      });

      // Load on entry
      load();
    },

    audiences(){
      $('#viewTitle').textContent = 'Audiences';
      $('#viewContent').innerHTML = '<div class="note">Audience tools coming soon.</div>';
    },

    emails(){
      $('#viewTitle').textContent = 'Email Campaigns';
      $('#viewContent').innerHTML = '<div class="note">Scheduler + templates placeholder.</div>';
    },

    account(){
      $('#viewTitle').textContent = 'Account';
      $('#viewContent').innerHTML = '<div class="note">Manage your password and organisation details.</div>';
    }
  };

  // ---- Helpers ----
  async function loadShows(){
    const wrap = document.getElementById('showsWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="note">Loading…</div>';
    const r = await API('/admin/shows/latest?limit=20');
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load shows</div>'; return; }
    if(!j.shows || j.shows.length===0){ wrap.innerHTML = '<div class="note">No shows yet.</div>'; return; }
    wrap.innerHTML = j.shows.map(function(s){
      const d = new Date(s.date);
      const when = d.toLocaleString();
      const venue = s.venue ? [s.venue.name,s.venue.city,s.venue.postcode].filter(Boolean).join(', ') : '—';
      const tt = (s.ticketTypes||[]).map(function(t){ return t.name+' (£'+(t.pricePence/100).toFixed(2)+')'; }).join(' · ');
      return '<div class="card"><div><b>'+s.title+'</b></div><div class="note">'+when+' — '+venue+'</div><div class="note">'+(tt || 'No ticket types')+'</div></div>';
    }).join('');
  }

  function switchView(name){
    document.querySelectorAll('nav button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-view')===name);
    });
    if (views[name]) views[name](); else views.home();
  }

  async function ensureAuth(){
    const me = await fetch('/auth/me', { credentials: 'include' });
    if(me.status===200){
      const j = await me.json();
      $('#userEmail').textContent = (j.user && j.user.email) ? j.user.email : 'Signed in';
      $('#loginOverlay').classList.remove('show');
      return true;
    } else {
      $('#loginOverlay').classList.add('show');
      return false;
    }
  }

  // Drawer logic
  $('#drawerClose').addEventListener('click', ()=>$('#drawer').classList.remove('show'));

  async function openDrawer(orderId){
    $('#drawerTitle').textContent = 'Order';
    $('#drawerBody').innerHTML = '<div class="note">Loading…</div>';
    $('#drawer').classList.add('show');

    const r = await API('/admin/orders/' + encodeURIComponent(orderId));
    const j = await r.json();
    if(!j.ok){ $('#drawerBody').innerHTML = '<div class="danger">Failed to load.</div>'; return; }

    const o = j.order;
    const when = new Date(o.createdAt).toLocaleString();
    const venue = o.show?.venue;
    const vline = venue ? [venue.name, venue.city, venue.postcode].filter(Boolean).join(', ') : '—';
    const amount = '£' + ((o.amountPence ?? 0)/100).toFixed(2);

    const ticketsHtml = (o.tickets || []).map(t => {
      const scan = t.scannedAt ? (' — scanned ' + new Date(t.scannedAt).toLocaleString()) : '';
      return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--border);padding:6px 0">'
        + '<div>Serial: <b>'+t.serial+'</b></div>'
        + '<div class="note">'+t.status+scan+'</div>'
        + '</div>';
    }).join('') || '<div class="note">No tickets</div>';

    $('#drawerTitle').textContent = 'Order #' + o.id.slice(0,8);
    $('#drawerBody').innerHTML =
      '<div class="grid">'
      + '<div class="card"><div class="row" style="justify-content:space-between">'
      + '<div><div class="note">Date</div><div>'+when+'</div></div>'
      + '<div><div class="note">Status</div><div><span class="badge">'+o.status+'</span></div></div>'
      + '</div>'
      + '<div class="row" style="justify-content:space-between">'
      + '<div><div class="note">Email</div><div>'+ (o.email || '—') +'</div></div>'
      + '<div><div class="note">Quantity</div><div>'+ (o.quantity ?? 0) +'</div></div>'
      + '<div><div class="note">Amount</div><div>'+ amount +'</div></div>'
      + '</div></div>'

      + '<div class="card">'
      + '<div class="note">Show</div>'
      + '<div><b>'+(o.show?.title || '—')+'</b></div>'
      + '<div class="note">'+ (o.show?.date ? new Date(o.show.date).toLocaleString() : '—') +'</div>'
      + '<div class="note">'+ vline +'</div>'
      + '</div>'

      + '<div class="card"><div class="row" style="justify-content:space-between;align-items:center">'
      + '<h4 style="margin:0">Tickets</h4>'
      + '<div class="row">'
      + '<button class="btn ghost" id="btnResend">Resend tickets</button>'
      + (o.status === 'CANCELLED' ? '' : '<button class="btn danger" id="btnRefund">Mark as refunded</button>')
      + '</div></div>'
      + '<div style="margin-top:8px">'+ ticketsHtml +'</div>'
      + '</div>'

      + (o.notes ? ('<div class="card"><div class="note">Notes</div><pre style="white-space:pre-wrap;margin:0">'+escapeHtml(o.notes)+'</pre></div>') : '')
      + '</div>';

    // Wire buttons
    const btnResend = $('#btnResend');
    if (btnResend) {
      btnResend.addEventListener('click', async ()=>{
        btnResend.disabled = true;
        const r = await API('/admin/orders/'+encodeURIComponent(o.id)+'/resend', {
          method:'POST',
          body: JSON.stringify({ message: 'Resent via organiser console' })
        });
        const j = await r.json();
        toast(j.ok ? 'Resend recorded' : (j.message || 'Resend failed'));
        btnResend.disabled = false;
      });
    }

    const btnRefund = $('#btnRefund');
    if (btnRefund) {
      btnRefund.addEventListener('click', async ()=>{
        if (!confirm('Mark this order as refunded (cancelled)?')) return;
        btnRefund.disabled = true;
        const r = await API('/admin/orders/'+encodeURIComponent(o.id)+'/refund', {
          method:'POST',
          body: JSON.stringify({ reason: 'Refunded via organiser console' })
        });
        const j = await r.json();
        toast(j.ok ? 'Order marked as refunded' : (j.message || 'Refund failed'));
        btnRefund.disabled = false;
        // Refresh drawer
        openDrawer(o.id);
      });
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (ch)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  // Sidebar nav
  document.querySelectorAll('nav button[data-view]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', async function(){
    await API('/auth/logout', { method:'POST' });
    location.reload();
  });

  // Login
  document.getElementById('btnLogin').addEventListener('click', async function(){
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if(!j.ok){
      const e = document.getElementById('loginError');
      e.textContent = j.message || 'Login failed';
      e.style.display = 'block';
      return;
    }
    location.reload();
  });

  // Demo user
  document.getElementById('btnDemo').addEventListener('click', async function(){
    const email = 'demo@organiser.test';
    const password = 'demo1234';
    let r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    if(r.status===401){
      await API('/auth/signup', { method:'POST', body: JSON.stringify({ email, password, name: 'Demo User' }) });
    }
    await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
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
