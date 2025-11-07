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
  section.view{background:var(--panel);border:1px solid var(--border);border-radius:14px;min-height:60vh}
  .toolbar{display:flex;gap:8px;align-items:center;padding:14px;border-bottom:1px solid var(--border)}
  .toolbar h2{font-size:16px;margin:0}
  .content{padding:16px}
  .grid{display:grid;gap:12px}.two{grid-template-columns:1fr 1fr}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  input,select,textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  label{font-size:12px;color:var(--muted)}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}.btn.ghost{background:#fff;border:1px solid var(--border)}
  .btn.danger{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
  .note{font-size:13px;color:var(--muted)}
  .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .danger{color:var(--bad)} .ok{color:var(--ok)}
  .overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:50}
  .overlay.show{display:flex}
  .login{width:360px;background:#fff;border-radius:14px;border:1px solid var(--border);padding:18px}
  .login h3{margin:0 0 8px}

  /* Drawer for order details */
  .drawer{position:fixed;top:0;right:-520px;width:520px;height:100vh;background:#fff;border-left:1px solid var(--border);box-shadow:-8px 0 24px rgba(15,23,42,.08);transition:right .25s ease;z-index:60}
  .drawer.show{right:0}
  .drawer .head{display:flex;align-items:center;justify-content:space-between;padding:14px;border-bottom:1px solid var(--border)}
  .drawer .body{padding:16px;overflow:auto;height:calc(100vh - 56px)}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid var(--border);background:#f9fafb}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{padding:8px;border-bottom:1px solid var(--border);text-align:left;font-size:14px}
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
      <div class="card">
        <p>Welcome to your organiser console. Use the menu to manage shows, venues, orders, and marketing.</p>
        <p class="note">You’ll see more tools appear here as we build them in.</p>
      </div>
    </div>
  </section>
</main>

<!-- Login overlay -->
<div class="overlay" id="loginOverlay">
  <div class="login">
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

<!-- Order drawer -->
<div class="drawer" id="orderDrawer">
  <div class="head">
    <div><b id="drawerTitle">Order</b></div>
    <button class="btn ghost" id="drawerClose">Close</button>
  </div>
  <div class="body" id="drawerBody">
    <!-- filled dynamically -->
  </div>
</div>

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const API = (path, opts) => fetch(path, Object.assign({
    credentials:'include',
    headers:{'Content-Type':'application/json'}
  }, opts || {}));

  const formatMoney = (pence) => '£' + (Number(pence||0)/100).toFixed(2);
  const when = (iso) => new Date(iso).toLocaleString();

  const views = {
    home(){ 
      $('#viewTitle').textContent = 'Home';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Recent activity</h4><p class="note">Recent sales, scans and edits will appear here.</p></div>'
        + '<div class="card"><h4>Shortcuts</h4><div class="row">'
        + '<button class="btn ghost" data-goto="shows">Create show</button>'
        + '<button class="btn ghost" data-goto="venues">Add venue</button>'
        + '</div></div></div>';
      $('#viewContent').addEventListener('click', function(e){
        const el = e.target.closest('[data-goto]');
        if(!el) return;
        e.preventDefault();
        switchView(el.getAttribute('data-goto'));
      }, { once:true });
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
        '<div class="card">'
        + '<div class="row">'
        + '<input id="ord_q" placeholder="Search email, show title, or order id" style="flex:1"/>'
        + '<select id="ord_status"><option value="">All statuses</option><option>PAID</option><option>REFUNDED</option><option>CANCELLED</option></select>'
        + '<button class="btn ghost" id="ord_search">Search</button>'
        + '</div>'
        + '</div>'
        + '<div class="card" style="margin-top:12px">'
        + '<table class="table" id="ordersTable">'
        + '<thead><tr><th>When</th><th>Order</th><th>Customer</th><th>Show</th><th>Tickets</th><th>Paid</th><th>Refunded</th><th>Net</th><th>Status</th><th></th></tr></thead>'
        + '<tbody id="ordersTbody"><tr><td colspan="10" class="note">Loading…</td></tr></tbody>'
        + '</table>'
        + '<div class="row" style="margin-top:8px"><button class="btn ghost" id="ord_more" style="display:none">Load more</button></div>'
        + '</div>';

      let nextCursor = null;
      const run = async (append=false) => {
        const q = $('#ord_q').value || '';
        const status = $('#ord_status').value || '';
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        if (append && nextCursor) params.set('cursor', nextCursor);
        const r = await API('/admin/orders?' + params.toString());
        const j = await r.json();
        if(!j.ok){ $('#ordersTbody').innerHTML = '<tr><td colspan="10" class="danger">Failed to load orders</td></tr>'; return; }

        const rows = (j.orders||[]).map(o => {
          const title = o.show ? (o.show.title || o.show.id) : '—';
          const date = o.createdAt ? when(o.createdAt) : '—';
          const pill = '<span class="pill">'+o.status+'</span>';
          return '<tr data-id="'+o.id+'">'
            + '<td>'+date+'</td>'
            + '<td><code>'+o.id+'</code></td>'
            + '<td>'+ (o.email || '—') +'</td>'
            + '<td>'+ title +'</td>'
            + '<td>'+ (o.ticketsCount || 0) +'</td>'
            + '<td>'+ formatMoney(o.amountPence) +'</td>'
            + '<td>'+ formatMoney(o.refundedPence || 0) +'</td>'
            + '<td>'+ formatMoney(o.netPence || 0) +'</td>'
            + '<td>'+ pill +'</td>'
            + '<td><button class="btn ghost" data-open="'+o.id+'">Open</button></td>'
            + '</tr>';
        }).join('');

        if(append){
          $('#ordersTbody').insertAdjacentHTML('beforeend', rows || '');
        } else {
          $('#ordersTbody').innerHTML = rows || '<tr><td colspan="10" class="note">No orders.</td></tr>';
        }

        nextCursor = j.nextCursor;
        $('#ord_more').style.display = nextCursor ? '' : 'none';
      };

      run(false);

      $('#viewContent').addEventListener('click', async function(e){
        const openBtn = e.target.closest('[data-open]');
        if (openBtn) {
          e.preventDefault();
          const id = openBtn.getAttribute('data-open');
          openOrderDrawer(id);
        }
        if (e.target && e.target.id === 'ord_search') { nextCursor = null; run(false); }
        if (e.target && e.target.id === 'ord_more') { run(true); }
      });
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

  async function loadShows(){
    const wrap = document.getElementById('showsWrap');
    wrap.innerHTML = '<div class="note">Loading…</div>';
    const r = await API('/admin/shows/latest?limit=20');
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load shows</div>'; return; }
    if(!j.shows || j.shows.length===0){ wrap.innerHTML = '<div class="note">No shows yet.</div>'; return; }
    wrap.innerHTML = j.shows.map(function(s){
      const d = new Date(s.date);
      const whenStr = d.toLocaleString();
      const venue = s.venue ? [s.venue.name,s.venue.city,s.venue.postcode].filter(Boolean).join(', ') : '—';
      const tt = (s.ticketTypes||[]).map(function(t){ return t.name+' (£'+(t.pricePence/100).toFixed(2)+')'; }).join(' · ');
      return '<div class="card"><div><b>'+s.title+'</b></div><div class="note">'+whenStr+' — '+venue+'</div><div class="note">'+(tt || 'No ticket types')+'</div></div>';
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
      document.getElementById('userEmail').textContent = (j.user && j.user.email) ? j.user.email : 'Signed in';
      document.getElementById('loginOverlay').classList.remove('show');
      return true;
    } else {
      document.getElementById('loginOverlay').classList.add('show');
      return false;
    }
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

  // Drawer logic
  const drawer = $('#orderDrawer');
  $('#drawerClose').addEventListener('click', () => drawer.classList.remove('show'));

  async function openOrderDrawer(id){
    $('#drawerTitle').textContent = 'Order ' + id;
    $('#drawerBody').innerHTML = '<div class="note">Loading…</div>';
    drawer.classList.add('show');

    const r = await API('/admin/orders/' + encodeURIComponent(id));
    const j = await r.json();
    if(!j.ok){ $('#drawerBody').innerHTML = '<div class="danger">Failed to load order</div>'; return; }

    const o = j.order;
    const hdr =
      '<div class="card" style="margin-bottom:12px">'
      + '<div class="row"><div><b>'+ (o.email || '—') +'</b></div><div class="pill">'+o.status+'</div></div>'
      + '<div class="note">Placed: '+ (o.createdAt ? new Date(o.createdAt).toLocaleString() : '—') +'</div>'
      + '<div class="note">Show: '+ (o.show ? (o.show.title || o.show.id) : '—') +'</div>'
      + '<div class="row" style="margin-top:8px">'
      + '<div class="pill">Paid '+ formatMoney(o.amountPence) +'</div>'
      + '<div class="pill">Refunded '+ formatMoney(o.refundedPence || 0) +'</div>'
      + '<div class="pill">Net '+ formatMoney(o.netPence || 0) +'</div>'
      + '</div>'
      + '<div class="row" style="margin-top:8px">'
      + '<button class="btn ghost" id="btnResend">Resend tickets</button>'
      + '<button class="btn danger" id="btnRefund">Refund…</button>'
      + '</div>'
      + '</div>';

    const tix = (o.tickets||[]).map(t =>
      '<tr><td><code>'+ (t.serial || '') +'</code></td>'
      + '<td>'+ (t.holderName || '—') +'</td>'
      + '<td>'+ (t.status || '') +'</td>'
      + '<td>'+ (t.scannedAt ? when(t.scannedAt) : '—') +'</td></tr>'
    ).join('');

    const refunds = (o.refunds||[]).map(f =>
      '<tr><td>'+ when(f.createdAt) +'</td>'
      + '<td>'+ formatMoney(f.amountPence) +'</td>'
      + '<td>'+ (f.reason || '—') +'</td></tr>'
    ).join('');

    $('#drawerBody').innerHTML =
      hdr
      + '<div class="card" style="margin-bottom:12px"><h4>Tickets</h4>'
      + '<table class="table"><thead><tr><th>Serial</th><th>Holder</th><th>Status</th><th>Scanned</th></tr></thead>'
      + '<tbody>' + (tix || '<tr><td colspan="4" class="note">No tickets</td></tr>') + '</tbody></table></div>'
      + '<div class="card"><h4>Refunds</h4>'
      + '<table class="table"><thead><tr><th>When</th><th>Amount</th><th>Reason</th></tr></thead>'
      + '<tbody>' + (refunds || '<tr><td colspan="3" class="note">No refunds</td></tr>') + '</tbody></table></div>';

    // Button handlers
    $('#btnResend').addEventListener('click', async function(){
      const ok = confirm('Resend tickets to ' + (o.email || 'customer') + '?');
      if(!ok) return;
      const rr = await API('/admin/orders/' + o.id + '/resend', { method:'POST' });
      const jj = await rr.json();
      if(!jj.ok) alert('Failed: ' + (jj.message || 'Resend failed'));
      else alert('Tickets resent');
    });

    $('#btnRefund').addEventListener('click', async function(){
      const amtStr = prompt('Enter refund amount in GBP (leave blank for full remaining):', '');
      let amountPence = null;
      if (amtStr && amtStr.trim()) {
        const gbp = Number(amtStr.replace(/[^0-9.]/g,''));
        if (!Number.isFinite(gbp) || gbp < 0) { alert('Invalid amount'); return; }
        amountPence = Math.round(gbp * 100);
      }
      const reason = prompt('Reason (optional):', '') || null;
      const body = amountPence != null ? { amountPence, reason } : { reason };
      const rr = await API('/admin/orders/' + o.id + '/refund', { method:'POST', body: JSON.stringify(body) });
      const jj = await rr.json();
      if(!jj.ok){ alert('Refund failed: ' + (jj.message || '')); return; }
      alert('Refund recorded. New net: ' + (jj.netPence != null ? formatMoney(jj.netPence) : '—'));
      openOrderDrawer(o.id); // reload drawer view
    });
  }

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
