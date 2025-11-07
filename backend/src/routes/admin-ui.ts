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
  .overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:50}
  .overlay.show{display:flex}
  .login{width:360px;background:#fff;border-radius:14px;border:1px solid var(--border);padding:18px}
  .login h3{margin:0 0 8px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .kpi{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px}
  .chart{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px}
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
        <p>Welcome to your organiser console. Use the menu to manage shows, orders, venues, and marketing.</p>
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

    // ---- Shows list & detail ----
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

    // ---- Orders list & detail with notes ----
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
        + '<div class="row"><button class="btn primary" id="btnCreateVenue">Save venue</button></div>'
        + '<div class="note" id="venueMsg"></div></div></div>'
        + '<div class="card"><h4>Find venues</h4>'
        + '<div class="row"><input id="q" placeholder="Search by name/city/postcode"/><button class="btn ghost" id="btnFind">Search</button></div>'
        + '<div id="venuesList" class="grid" style="margin-top:8px"></div></div></div>';

      $('#viewContent').onclick = async e => {
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
          wrap.innerHTML = (j.venues||[]).map(v => {
            const meta = [v.address, v.city, v.postcode].filter(Boolean).join(', ') || '—';
            const cap = (v.capacity != null) ? v.capacity : '—';
            return '<div class="card"><b>'+v.name+'</b><div class="note">'+meta+'</div><div class="note">Capacity: '+cap+'</div></div>';
          }).join('');
        }
      };
    },

    // ---- Analytics (NEW) ----
    analytics(){
      $('#viewTitle').textContent = 'Analytics';
      // date defaults: last 30 days
      const today = new Date();
      const to = today.toISOString().slice(0,10);
      const from = new Date(today.getTime() - 29*24*60*60*1000).toISOString().slice(0,10);

      $('#toolbarActions').innerHTML =
        '<div class="row">'
        + '<input id="a_from" type="date" value="'+from+'"/>'
        + '<input id="a_to" type="date" value="'+to+'"/>'
        + '<select id="a_metric"><option value="revenue">Revenue</option><option value="orders">Orders</option><option value="tickets">Tickets</option></select>'
        + '<button class="btn ghost" id="a_refresh">Refresh</button>'
        + '</div>';

      $('#viewContent').innerHTML =
        '<div class="kpis" id="a_kpis"></div>'
        + '<div class="chart"><h4 style="margin:0 0 8px">Trend</h4><div id="a_chart"></div></div>'
        + '<div class="card"><h4 style="margin:0 0 8px">Daily table</h4><div id="a_table"></div></div>';

      const run = async () => {
        const f = ($('#a_from').value || from);
        const t = ($('#a_to').value || to);
        const metric = $('#a_metric').value || 'revenue';
        const r = await API('/admin/analytics/overview?from='+encodeURIComponent(f)+'&to='+encodeURIComponent(t));
        const j = await r.json();
        if(!j.ok){
          $('#a_kpis').innerHTML = '<div class="note">Failed to load analytics.</div>';
          $('#a_chart').innerHTML = '';
          $('#a_table').innerHTML = '';
          return;
        }
        // KPIs
        const k = j.kpis || {};
        $('#a_kpis').innerHTML =
          '<div class="kpi"><div class="note">Revenue</div><div style="font-size:20px;font-weight:700">'+fmtMoney(k.totalRevenuePence)+'</div></div>'
          + '<div class="kpi"><div class="note">Orders</div><div style="font-size:20px;font-weight:700">'+(k.totalOrders||0)+'</div></div>'
          + '<div class="kpi"><div class="note">Tickets</div><div style="font-size:20px;font-weight:700">'+(k.totalTickets||0)+'</div></div>'
          + '<div class="kpi"><div class="note">Avg. Order Value</div><div style="font-size:20px;font-weight:700">'+fmtMoney(k.avgOrderValuePence||0)+'</div></div>';

        const series = j.series || [];
        // Table
        $('#a_table').innerHTML =
          '<table class="table"><thead><tr><th>Date</th><th>Revenue</th><th>Orders</th><th>Tickets</th></tr></thead><tbody>'
          + series.map(d => '<tr><td>'+d.date+'</td><td>'+fmtMoney(d.revenuePence)+'</td><td>'+d.ordersCount+'</td><td>'+d.ticketsCount+'</td></tr>').join('')
          + '</tbody></table>';

        // Chart
        const values = series.map(d => {
          switch(metric){
            case 'orders': return d.ordersCount;
            case 'tickets': return d.ticketsCount;
            default: return Math.round((d.revenuePence||0)/100); // pounds
          }
        });
        drawLineChart('#a_chart', series.map(d=>d.date), values, metric);
      };

      $('#toolbarActions').onclick = e => { if (e.target && e.target.id === 'a_refresh') run(); }
      run();
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
    account(){
      $('#viewTitle').textContent = 'Account';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML = '<div class="note">Manage your password and organisation details.</div>';
    }
  };

  // ===== Shows =====
  async function loadShows(){
    const wrap = $('#showsWrap');
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
      const btn = e.target.closest('[data-show]');
      if(!btn) return;
      const id = btn.getAttribute('data-show');
      switchView('showDetail', id);
    };
  }

  async function renderShowDetail(showId){
    const r = await API('/admin/shows/'+encodeURIComponent(showId));
    const j = await r.json();
    if(!j.ok){ $('#viewContent').innerHTML = '<div class="danger">Failed to load show</div>'; return; }
    const { show, kpis } = j;

    $('#viewContent').innerHTML =
      '<div class="grid">'
      + '<div class="card"><h3 style="margin:0 0 8px">'+show.title+'</h3>'
      + '<div class="note">'+(show.venue ? (show.venue.name + (show.venue.city ? (', '+show.venue.city) : '')) : '—')+'</div>'
      + '<div class="note">Date: '+new Date(show.date).toLocaleString()+'</div></div>'
      + '<div class="kpis">'
      +   '<div class="kpi"><div class="note">Capacity</div><div style="font-size:20px;font-weight:700">'+(kpis.capacity ?? '—')+'</div></div>'
      +   '<div class="kpi"><div class="note">Total Available</div><div style="font-size:20px;font-weight:700">'+(kpis.totalAvailable ?? 0)+'</div></div>'
      +   '<div class="kpi"><div class="note">Tickets Sold</div><div style="font-size:20px;font-weight:700">'+(kpis.ticketsSold ?? 0)+'</div></div>'
      +   '<div class="kpi"><div class="note">Revenue</div><div style="font-size:20px;font-weight:700">'+fmtMoney(kpis.revenuePence)+'</div></div>'
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

    // Render ticket types
    const tbody = $('#ttBody');
    tbody.innerHTML = (show.ticketTypes || []).map(tt => {
      return '<tr data-tt="'+tt.id+'">'
        + '<td><input class="tt_name" value="'+(tt.name||'')+'"/></td>'
        + '<td><input class="tt_price" type="number" value="'+(tt.pricePence||0)+'"/></td>'
        + '<td><input class="tt_avail" type="number" value="'+(tt.available==null?'':tt.available)+'"/></td>'
        + '<td>'
        +   '<button class="btn ghost tt_save">Save</button> '
        +   '<button class="btn ghost tt_del" style="color:#dc2626;border-color:#fecaca">Delete</button>'
        + '</td>'
        + '</tr>';
    }).join('');

    // handlers
    tbody.onclick = async e => {
      const tr = e.target.closest('tr[data-tt]');
      if(!tr) return;
      const id = tr.getAttribute('data-tt');
      if (e.target.classList.contains('tt_save')) {
        const name = (tr.querySelector('.tt_name') as HTMLInputElement).value;
        const pricePence = Number((tr.querySelector('.tt_price') as HTMLInputElement).value || 0);
        const availRaw = (tr.querySelector('.tt_avail') as HTMLInputElement).value;
        const available = availRaw === '' ? null : Number(availRaw);
        const r = await API('/admin/ticket-types/'+encodeURIComponent(id), {
          method:'PATCH',
          body: JSON.stringify({ name, pricePence, available })
        });
        const j = await r.json();
        $('#ttMsg').textContent = j.ok ? 'Saved' : (j.message || 'Failed');
        if (j.ok) renderShowDetail(showId);
      }
      if (e.target.classList.contains('tt_del')) {
        if (!confirm('Delete this ticket type?')) return;
        const r = await API('/admin/ticket-types/'+encodeURIComponent(id), { method: 'DELETE' });
        const j = await r.json();
        $('#ttMsg').textContent = j.ok ? 'Deleted' : (j.message || 'Failed');
        if (j.ok) renderShowDetail(showId);
      }
    };

    $('#btnAddTT')?.addEventListener('click', async () => {
      const name = (document.getElementById('tt_name') as HTMLInputElement).value;
      const pricePence = Number((document.getElementById('tt_price') as HTMLInputElement).value || 0);
      const availRaw = (document.getElementById('tt_avail') as HTMLInputElement).value;
      const available = availRaw === '' ? null : Number(availRaw);
      const r = await API('/admin/shows/'+encodeURIComponent(showId)+'/ticket-types', {
        method:'POST',
        body: JSON.stringify({ name, pricePence, available })
      });
      const j2 = await r.json();
      (document.getElementById('ttMsg') as HTMLElement).textContent = j2.ok ? 'Added' : (j2.message || 'Failed');
      if (j2.ok) renderShowDetail(showId);
    });
  }

  // ===== Orders =====
  async function loadOrders(q){
    const wrap = $('#ordersWrap');
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
      const btn = e.target.closest('[data-open-order]');
      if(!btn) return;
      switchView('orderDetail', btn.getAttribute('data-open-order'));
    };
  }

  async function renderOrderDetail(orderId){
    const wrap = $('#viewContent');
    wrap.innerHTML = '<div class="note">Loading…</div>';
    const r = await API('/admin/orders/'+encodeURIComponent(orderId));
    const j = await r.json();
    if(!j.ok){ wrap.innerHTML = '<div class="danger">Failed to load order</div>'; return; }
    const o = j.order;
    wrap.innerHTML =
      '<div class="grid">'
      + '<div class="card"><h3 style="margin:0 0 8px">Order '+o.id+'</h3>'
      + '<div class="note">Email: '+(o.email||'—')+'</div>'
      + '<div class="note">Amount: '+fmtMoney(o.amountPence)+'</div>'
      + '<div class="note">Qty: '+(o.quantity ?? '—')+'</div>'
      + '<div class="note">Status: '+o.status+'</div>'
      + '</div>'
      + '<div class="grid two">'
      +   '<div class="card">'
      +     '<h4 style="margin-top:0">Notes</h4>'
      +     '<div class="row"><input id="noteText" placeholder="Add a note…"/><button class="btn primary" id="btnAddNote">Add</button></div>'
      +     '<div id="notesWrap" class="grid" style="margin-top:8px"></div>'
      +     '<div class="note" id="noteMsg"></div>'
      +   '</div>'
      +   '<div class="card"><h4 style="margin-top:0">Tickets</h4>'
      +     '<table class="table"><thead><tr><th>Serial</th><th>Holder</th><th>Status</th><th>Scanned</th></tr></thead><tbody>'
      +     (o.tickets||[]).map(t => '<tr><td>'+t.serial+'</td><td>'+(t.holderName||'')+'</td><td>'+(t.status||'')+'</td><td>'+(t.scannedAt?new Date(t.scannedAt).toLocaleString():'')+'</td></tr>').join('')
      +     + '</tbody></table>'
      +   '</div>'
      + '</div>'
      + '</div>';

    const notesWrap = $('#notesWrap');
    const renderNotes = () => {
      notesWrap.innerHTML = (o.notes||[]).map(n => {
        const who = n.user ? (n.user.name || n.user.email || 'User') : 'System';
        return '<div class="card" data-note="'+n.id+'">'
          + '<div class="note">'+new Date(n.createdAt).toLocaleString()+' — '+who+'</div>'
          + '<div><textarea class="noteText" style="width:100%;min-height:60px">'+(n.text||'')+'</textarea></div>'
          + '<div class="row" style="margin-top:6px">'
          +   '<button class="btn ghost note_save">Save</button>'
          +   '<button class="btn ghost note_del" style="color:#dc2626;border-color:#fecaca">Delete</button>'
          + '</div>'
          + '</div>';
      }).join('') || '<div class="note">No notes yet.</div>';
    };
    renderNotes();

    // Add note
    (document.getElementById('btnAddNote') as HTMLButtonElement).onclick = async () => {
      const txt = (document.getElementById('noteText') as HTMLInputElement).value;
      if(!txt.trim()) return;
      const r = await API('/admin/orders/'+encodeURIComponent(orderId)+'/notes', { method:'POST', body: JSON.stringify({ text: txt }) });
      const j2 = await r.json();
      (document.getElementById('noteMsg') as HTMLElement).textContent = j2.ok ? 'Saved' : (j2.message||'Failed');
      if (j2.ok) {
        o.notes.unshift(j2.note);
        (document.getElementById('noteText') as HTMLInputElement).value = '';
        renderNotes();
      }
    };

    // Edit / delete notes
    notesWrap.onclick = async e => {
      const card = (e.target as HTMLElement).closest('[data-note]');
      if(!card) return;
      const noteId = card.getAttribute('data-note');
      if ((e.target as HTMLElement).classList.contains('note_save')) {
        const txt = (card.querySelector('.noteText') as HTMLTextAreaElement).value;
        const r = await API('/admin/orders/'+encodeURIComponent(orderId)+'/notes/'+encodeURIComponent(noteId!), {
          method:'PATCH',
          body: JSON.stringify({ text: txt })
        });
        const j3 = await r.json();
        (document.getElementById('noteMsg') as HTMLElement).textContent = j3.ok ? 'Saved' : (j3.message || 'Failed');
      }
      if ((e.target as HTMLElement).classList.contains('note_del')) {
        if (!confirm('Delete this note?')) return;
        const r = await API('/admin/orders/'+encodeURIComponent(orderId)+'/notes/'+encodeURIComponent(noteId!), { method:'DELETE' });
        const j4 = await r.json();
        (document.getElementById('noteMsg') as HTMLElement).textContent = j4.ok ? 'Deleted' : (j4.message || 'Failed');
        if (j4.ok) {
          o.notes = o.notes.filter((n:any) => n.id !== noteId);
          renderNotes();
        }
      }
    };
  }

  // ===== Tiny SVG line chart renderer =====
  function drawLineChart(mountSel, labels, values, metric){
    const mount = document.querySelector(mountSel);
    const W = mount.clientWidth || 900;
    const H = 260;
    const P = 28; // padding
    const max = Math.max(1, ...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;

    const x = (i) => P + (i * (W - 2*P)) / Math.max(1, values.length - 1);
    const y = (v) => H - P - ((v - min) * (H - 2*P)) / span;

    const points = values.map((v, i) => x(i)+','+y(v)).join(' ');
    // grid
    const gridY = [0, 0.25, 0.5, 0.75, 1].map(r => y(min + r*span));

    mount.innerHTML =
      '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Trend chart">'
      + gridY.map(gy => '<line x1="'+P+'" y1="'+gy.toFixed(1)+'" x2="'+(W-P)+'" y2="'+gy.toFixed(1)+'" stroke="#e5e7eb" stroke-width="1"/>').join('')
      + '<polyline fill="none" stroke="#2563eb" stroke-width="2" points="'+points+'"/>'
      + values.map((v,i) => '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.5" fill="#2563eb"/>').join('')
      + '</svg>'
      + '<div class="note" style="margin-top:6px">Metric: '
      + (metric==='orders'?'Orders':metric==='tickets'?'Tickets':'Revenue (£)')
      + '</div>';
  }

  // ===== Navigation =====
  function switchView(name, arg){
    document.querySelectorAll('nav button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view')===name);
    });
    if (name === 'showDetail') return views.showDetail(arg);
    if (name === 'orderDetail') return views.orderDetail(arg);
    if (views[name]) views[name](); else views.home();
  }

  // Sidebar
  document.querySelectorAll('nav button[data-view]').forEach(btn=>{
    btn.addEventListener('click', e => {
      e.preventDefault();
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Auth helpers
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

  // Logout
  $('#btnLogout').addEventListener('click', async function(){
    await API('/auth/logout', { method:'POST' });
    location.reload();
  });

  // Login
  $('#btnLogin').addEventListener('click', async function(){
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if(!j.ok){
      const e = (document.getElementById('loginError') as HTMLElement);
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
