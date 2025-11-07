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
  :root{
    --bg:#f7f8fa;--panel:#fff;--ink:#0f172a;--muted:#6b7280;--accent:#2563eb;--accent-2:#eff6ff;--border:#e5e7eb;--bad:#dc2626;--ok:#16a34a;--warn:#d97706
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif}
  a{color:var(--accent);text-decoration:none}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:5}
  header .brand{font-weight:800}
  header .user{font-size:14px;color:var(--muted)}
  main{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px;min-height:calc(100vh - 64px)}
  nav{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px}
  nav h4{margin:8px 10px 12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  nav button{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;border-radius:10px;margin:2px 0;font-size:14px;color:var(--ink);cursor:pointer}
  nav button.active,nav button:hover{background:var(--accent-2);color:var(--accent)}
  section.view{background:var(--panel);border:1px solid var(--border);border-radius:14px;min-height:60vh}
  .toolbar{display:flex;gap:8px;align-items:center;padding:14px;border-bottom:1px solid var(--border)}
  .toolbar h2{font-size:16px;margin:0}
  .content{padding:16px}
  .grid{display:grid;gap:12px}
  .two{grid-template-columns:1fr 1fr}
  .three{grid-template-columns:1fr 1fr 1fr}
  .four{grid-template-columns:1fr 1fr 1fr 1fr}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  input,select,textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  label{font-size:12px;color:var(--muted)}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}
  .btn.ghost{background:#fff;border:1px solid var(--border)}
  .btn.warn{background:#fff;border:1px solid var(--warn);color:var(--warn)}
  .btn.danger{background:#fff;border:1px solid var(--bad);color:var(--bad)}
  .note{font-size:13px;color:var(--muted)}
  .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .kpi{display:flex;align-items:center;justify-content:space-between}
  .kpi b{font-size:20px}
  .overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:50}
  .overlay.show{display:flex}
  .login{width:360px;background:#fff;border-radius:14px;border:1px solid var(--border);padding:18px}
  .login h3{margin:0 0 8px}
  table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid var(--border);padding:8px 6px;text-align:left;font-size:14px}
  th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
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

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const API = (path, opts) => fetch(path, Object.assign({
    credentials:'include',
    headers:{'Content-Type':'application/json'}
  }, opts || {}));
  const fmtMoney = (p) => '£' + (Number(p||0)/100).toFixed(2);

  const state = { currentShowId: null };

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
      bindShows();
    },

    showDetail(){
      $('#viewTitle').textContent = 'Show detail';
      const id = state.currentShowId;
      $('#viewContent').innerHTML =
        '<div class="row"><button class="btn ghost" id="btnBackShows">← Back to Shows</button></div>'
        + '<div id="showDetailWrap" class="grid" style="margin-top:8px"></div>';
      bindShowDetail(id);
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
      bindVenues();
    },

    orders(){
      $('#viewTitle').textContent = 'Orders';
      $('#viewContent').innerHTML = '<div class="note">Orders list coming next.</div>';
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

  async function bindShows(){
    const wrap = document.getElementById('showsWrap');
    async function load(){
      wrap.innerHTML = '<div class="note">Loading…</div>';
      const r = await API('/admin/shows/latest?limit=50');
      const j = await r.json();
      if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load shows</div>'; return; }
      if(!j.shows || j.shows.length===0){ wrap.innerHTML = '<div class="note">No shows yet.</div>'; return; }
      wrap.innerHTML = j.shows.map(function(s){
        const d = new Date(s.date);
        const when = d.toLocaleString();
        const venue = s.venue ? [s.venue.name,s.venue.city,s.venue.postcode].filter(Boolean).join(', ') : '—';
        const tt = (s.ticketTypes||[]).map(function(t){ return t.name+' ('+fmtMoney(t.pricePence)+')'; }).join(' · ');
        return '<div class="card">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
          +   '<div>'
          +     '<div><b>'+s.title+'</b></div>'
          +     '<div class="note">'+when+' — '+venue+'</div>'
          +     '<div class="note">'+(tt || 'No ticket types')+'</div>'
          +   '</div>'
          +   '<div><button class="btn ghost" data-showid="'+s.id+'" data-action="openShow">Open</button></div>'
          + '</div>'
          + '</div>';
      }).join('');
    }
    await load();
    $('#viewContent').addEventListener('click', function(e){
      const btn = e.target.closest('button[data-action="openShow"]');
      if(!btn) return;
      state.currentShowId = btn.getAttribute('data-showid');
      switchView('showDetail');
    });
    $('#btnRefreshShows').addEventListener('click', load);
  }

  async function bindShowDetail(id){
    const wrap = $('#showDetailWrap');
    async function load(){
      wrap.innerHTML = '<div class="note">Loading…</div>';
      const r = await API('/admin/shows/'+encodeURIComponent(id));
      const j = await r.json();
      if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load show</div>'; return; }
      const s = j.show, k = j.kpis || {};
      const when = new Date(s.date).toLocaleString();
      const venueLine = s.venue ? [s.venue.name,s.venue.city,s.venue.postcode].filter(Boolean).join(', ') : '—';

      wrap.innerHTML =
        '<div class="grid two">'
        + '<div class="card">'
        +   '<h3 style="margin:0 0 8px">'+s.title+'</h3>'
        +   '<div class="note">'+when+' — '+venueLine+'</div>'
        +   (s.description ? '<p style="margin-top:8px">'+(s.description||'')+'</p>' : '')
        +   '<div class="row" style="margin-top:8px">'
        +     '<button class="btn ghost" id="btnEditShow">Edit show</button>'
        +     '<a class="btn ghost" id="btnExportCSV" href="/admin/shows/'+s.id+'/attendees.csv">Download attendees (CSV)</a>'
        +   '</div>'
        + '</div>'
        + '<div class="card">'
        +   '<h4 style="margin-top:0">KPIs</h4>'
        +   '<div class="grid four">'
        +     '<div class="kpi card" style="padding:10px"><div>Paid orders</div><b>'+ (k.ordersPaid||0) +'</b></div>'
        +     '<div class="kpi card" style="padding:10px"><div>Revenue</div><b>'+ fmtMoney(k.revenuePence||0) +'</b></div>'
        +     '<div class="kpi card" style="padding:10px"><div>Tickets sold</div><b>'+ (k.ticketsSold||0) +'</b></div>'
        +     '<div class="kpi card" style="padding:10px"><div>Scanned</div><b>'+ (k.ticketsScanned||0) +'</b></div>'
        +   '</div>'
        +   '<div class="row" style="margin-top:8px">'
        +     '<span class="note">Capacity: '+ (k.capacity!=null? k.capacity : '—') +' · Available across types: '+ (k.totalAvailableAcrossTypes!=null? k.totalAvailableAcrossTypes : '—') +'</span>'
        +   '</div>'
        + '</div>'
        + '</div>'

        + '<div class="card">'
        +   '<h4 style="margin:0 0 8px">Ticket types</h4>'
        +   '<table>'
        +     '<thead><tr>'
        +       '<th>Name</th><th>Price</th><th>Available</th><th>Actions</th>'
        +     '</tr></thead>'
        +     '<tbody>'
        +       (s.ticketTypes||[]).map(function(t){
                  return '<tr data-ttid="'+t.id+'">'
                    + '<td><input data-tt="name" value="'+(t.name||'')+'"/></td>'
                    + '<td><input data-tt="price" type="number" step="1" value="'+(t.pricePence||0)+'"/></td>'
                    + '<td><input data-tt="avail" type="number" step="1" value="'+(t.available!=null?t.available:'')+'"/></td>'
                    + '<td class="row">'
                    +   '<button class="btn ghost" data-action="saveTT">Save</button>'
                    +   '<button class="btn danger" data-action="deleteTT">Delete</button>'
                    + '</td>'
                  + '</tr>';
                }).join('')
        +     '</tbody>'
        +   '</table>'
        +   '<div class="row" style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">'
        +     '<b>Add new</b>'
        +     '<input id="newTTName" placeholder="Name" style="max-width:200px"/>'
        +     '<input id="newTTPrice" type="number" placeholder="Price pence" style="max-width:160px"/>'
        +     '<input id="newTTAvail" type="number" placeholder="Available" style="max-width:140px"/>'
        +     '<button class="btn primary" id="btnAddTT">Add</button>'
        +   '</div>'
        +   '<div class="note" id="ttMsg"></div>'
        + '</div>';

      // bindings
      $('#btnBackShows').addEventListener('click', function(){ switchView('shows'); });

      $('#showDetailWrap').addEventListener('click', async function(e){
        const row = e.target.closest('tr[data-ttid]');
        const actionBtn = e.target.closest('button[data-action]');
        if (!actionBtn) return;
        const action = actionBtn.getAttribute('data-action');
        if (action === 'saveTT' && row){
          const id = row.getAttribute('data-ttid');
          const name = row.querySelector('[data-tt="name"]').value;
          const price = Number(row.querySelector('[data-tt="price"]').value || 0);
          const availV = row.querySelector('[data-tt="avail"]').value;
          const available = (availV === '' ? null : Number(availV));
          const r = await API('/admin/shows/'+s.id+'/ticket-types/'+id, { method:'PUT', body: JSON.stringify({ name, pricePence: price, available }) });
          const j = await r.json();
          $('#ttMsg').textContent = j.ok ? 'Saved.' : (j.message || 'Failed to save.');
          if (j.ok) load();
        }
        if (action === 'deleteTT' && row){
          const id = row.getAttribute('data-ttid');
          if (!confirm('Delete this ticket type?')) return;
          const r = await API('/admin/shows/'+s.id+'/ticket-types/'+id, { method:'DELETE' });
          const j = await r.json();
          $('#ttMsg').textContent = j.ok ? 'Deleted.' : (j.message || 'Failed to delete.');
          if (j.ok) load();
        }
      });

      $('#btnAddTT').addEventListener('click', async function(){
        const name = $('#newTTName').value;
        const price = Number($('#newTTPrice').value || 0);
        const availTxt = $('#newTTAvail').value;
        const available = (availTxt === '' ? null : Number(availTxt));
        const r = await API('/admin/shows/'+s.id+'/ticket-types', { method:'POST', body: JSON.stringify({ name, pricePence: price, available }) });
        const j = await r.json();
        $('#ttMsg').textContent = j.ok ? 'Added.' : (j.message || 'Failed to add.');
        if (j.ok) load();
      });
    }
    await load();
  }

  function bindVenues(){
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
    }, { once:true });
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

  // Sidebar nav
  document.querySelectorAll('nav button[data-view]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Back from detail
  document.addEventListener('click', function(e){
    if (e.target && e.target.id === 'btnBackShows') {
      switchView('shows');
    }
  });

  // Logout
  $('#btnLogout').addEventListener('click', async function(){
    await API('/auth/logout', { method:'POST' });
    location.reload();
  });

  // Login
  $('#btnLogin').addEventListener('click', async function(){
    const email = $('#email').value;
    const password = $('#password').value;
    const r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if(!j.ok){
      const e = $('#loginError');
      e.textContent = j.message || 'Login failed';
      e.style.display = 'block';
      return;
    }
    location.reload();
  });

  // Demo user
  $('#btnDemo').addEventListener('click', async function(){
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
