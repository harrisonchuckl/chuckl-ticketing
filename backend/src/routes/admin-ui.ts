// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Chuckl. Organiser Console</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#f7f8fb;
    --panel:#ffffff;
    --text:#0a0a0b;
    --muted:#6b7280;
    --brand:#2563eb;
    --brand-600:#1d4ed8;
    --border:#e5e7eb;
    --danger:#ef4444;
    --success:#10b981;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;
    font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    background:var(--bg);
    color:var(--text);
  }
  .layout{display:grid; grid-template-columns: 240px 1fr; height:100vh;}
  aside{
    border-right:1px solid var(--border);
    padding:14px;
    background:var(--panel);
  }
  .logo{
    font-weight:700; font-size:18px; letter-spacing:0.2px; margin-bottom:12px;
  }
  .sectionTitle{font-size:11px; text-transform:uppercase; color:var(--muted); margin:12px 0 6px;}
  .nav a{
    display:block; padding:9px 10px; border-radius:8px; text-decoration:none; color:var(--text);
  }
  .nav a.active{ background:#eef2ff; color:#1e40af; }
  .nav a:hover{ background:#f3f4f6; }

  header{
    height:56px; display:flex; align-items:center; justify-content:space-between;
    padding:0 16px; border-bottom:1px solid var(--border); background:var(--panel);
  }
  .btn{
    background:var(--brand); color:#fff; border:none; border-radius:8px; padding:8px 12px;
    font-weight:600; cursor:pointer;
  }
  .btn:disabled{opacity:.6; cursor:not-allowed}
  .btn.secondary{ background:#111827; }
  .btn.ghost{ background:transparent; color:var(--text); border:1px solid var(--border); }
  .content{ padding:16px; overflow:auto; height: calc(100vh - 56px); }
  .card{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; }
  .row{ display:flex; gap:12px; flex-wrap:wrap; }
  .input{ width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; }
  .label{font-size:12px; color:var(--muted); margin-bottom:6px;}
  .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:12px;}
  .muted{ color:var(--muted); font-size:13px;}
  .error{ color:var(--danger); }
  .hidden{ display:none; }

  .loginBox{ max-width:420px; margin:48px auto; }
</style>
</head>
<body>
<div class="layout">
  <aside>
    <div class="logo">Chuckl. Organiser Console</div>
    <div class="sectionTitle">API</div>
    <div id="authArea" class="card">
      <div id="loggedOut">
        <div class="label">Sign in to continue</div>
        <input id="email" class="input" placeholder="Email" />
        <div style="height:8px;"></div>
        <input id="password" type="password" class="input" placeholder="Password" />
        <div style="height:10px;"></div>
        <button id="loginBtn" class="btn" style="width:100%;">Sign in</button>
        <div class="muted" style="margin-top:8px;">Need an account? Ask your Chuckl. contact.</div>
        <div id="loginErr" class="error hidden" style="margin-top:6px;"></div>
      </div>
      <div id="loggedIn" class="hidden">
        <div class="muted" style="margin-bottom:8px;">Signed in as <span id="meEmail"></span></div>
        <button id="logoutBtn" class="btn ghost" style="width:100%;">Sign out</button>
      </div>
    </div>

    <div class="sectionTitle">Navigation</div>
    <nav class="nav">
      <a href="#/dashboard" id="nav-dashboard" class="active">Dashboard</a>
      <a href="#/shows" id="nav-shows">Shows</a>
      <a href="#/tickets" id="nav-tickets">Tickets</a>
      <a href="#/orders" id="nav-orders">Orders</a>
      <a href="#/marketing" id="nav-marketing">Marketing</a>
      <a href="#/customers" id="nav-customers">Customers</a>
      <a href="#/seating" id="nav-seating">Seating</a>
      <a href="#/reports" id="nav-reports">Reports</a>
      <a href="#/access" id="nav-access">Access Control</a>
      <a href="#/finance" id="nav-finance">Finance</a>
      <a href="#/settings" id="nav-settings">Settings</a>
      <a href="#/help" id="nav-help">Help</a>
    </nav>
  </aside>

  <main style="display:flex; flex-direction:column;">
    <header>
      <div id="pageTitle">Dashboard</div>
      <div>
        <button id="reloadBtn" class="btn ghost">Reload</button>
        <button id="createShowBtn" class="btn">Create Show</button>
      </div>
    </header>
    <div class="content">
      <div id="view-dashboard" class="view card">
        <div class="muted">Welcome to your organiser console.</div>
      </div>

      <div id="view-shows" class="view card hidden">
        <div class="row">
          <div style="flex:1; min-width:260px;">
            <div class="label">Title</div>
            <input id="showTitle" class="input" placeholder="e.g. Chuckl. Bridlington"/>
          </div>
          <div style="width:260px">
            <div class="label">Date & Time (local)</div>
            <input id="showStartsAt" class="input" placeholder="YYYY-MM-DD HH:mm"/>
          </div>
        </div>
        <div class="row">
          <div style="flex:1; min-width:260px;">
            <div class="label">Venue</div>
            <select id="venueSelect" class="input"></select>
          </div>
          <div style="width:220px">
            <div class="label">Capacity Override (optional)</div>
            <input id="showCapacity" class="input" placeholder="leave blank to use venue capacity"/>
          </div>
        </div>
        <div class="row">
          <div style="flex:1;">
            <div class="label">Description (optional)</div>
            <textarea id="showDesc" class="input" rows="4" placeholder="Short description…"></textarea>
          </div>
          <div style="flex:1;">
            <div class="label">Poster URL (optional)</div>
            <input id="posterUrl" class="input" placeholder="https://…"/>
          </div>
        </div>
        <div class="row">
          <button id="btnCreateShow" class="btn">Create Show</button>
          <div id="showCreateMsg" class="muted"></div>
        </div>
        <div style="height:14px;"></div>
        <div class="label">Latest Shows</div>
        <div id="showsList" class="muted">No shows yet.</div>
      </div>

      <div id="view-orders" class="view card hidden">
        <div class="label">Recent Orders</div>
        <div id="ordersList" class="muted">Load orders after login.</div>
      </div>

      <!-- Placeholder views -->
      <div id="view-tickets"   class="view card hidden">Tickets builder coming soon.</div>
      <div id="view-marketing" class="view card hidden">Marketing tools coming soon.</div>
      <div id="view-customers" class="view card hidden">Customers list coming soon.</div>
      <div id="view-seating"   class="view card hidden">Seating & scan config coming soon.</div>
      <div id="view-reports"   class="view card hidden">Reports coming soon.</div>
      <div id="view-access"    class="view card hidden">Access Control coming soon.</div>
      <div id="view-finance"   class="view card hidden">Finance coming soon.</div>
      <div id="view-settings"  class="view card hidden">Settings coming soon.</div>
      <div id="view-help"      class="view card hidden">Help & docs coming soon.</div>
    </div>
  </main>
</div>

<script>
  const $ = (q) => document.querySelector(q);
  const views = {
    '#/dashboard': 'view-dashboard',
    '#/shows': 'view-shows',
    '#/tickets': 'view-tickets',
    '#/orders': 'view-orders',
    '#/marketing': 'view-marketing',
    '#/customers': 'view-customers',
    '#/seating': 'view-seating',
    '#/reports': 'view-reports',
    '#/access': 'view-access',
    '#/finance': 'view-finance',
    '#/settings': 'view-settings',
    '#/help': 'view-help',
  };

  function setActive(hash) {
    for (const k in views) {
      const id = views[k];
      const el = document.getElementById(id);
      if (!el) continue;
      if (k === hash) el.classList.remove('hidden'); else el.classList.add('hidden');
      const nav = document.getElementById('nav-' + k.replace('#/', ''));
      if (nav) nav.classList.toggle('active', k === hash);
    }
    const title = hash.replace('#/', '');
    $('#pageTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  }

  async function api(path, opts={}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // important: send/receive cookie
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.message) || 'Request failed');
    return data;
  }

  // Auth UI state
  async function refreshMe() {
    try {
      const me = await api('/auth/me');
      $('#loggedOut').classList.add('hidden');
      $('#loggedIn').classList.remove('hidden');
      $('#meEmail').textContent = me.user.email;
      await loadVenues();
      await loadShows();
      await loadOrders();
    } catch {
      $('#loggedOut').classList.remove('hidden');
      $('#loggedIn').classList.add('hidden');
    }
  }

  $('#loginBtn').addEventListener('click', async () => {
    $('#loginBtn').disabled = true;
    $('#loginErr').classList.add('hidden');
    try {
      const email = $('#email').value.trim();
      const password = $('#password').value;
      await api('/auth/login', { method:'POST', body:{ email, password }});
      await refreshMe();
    } catch (e) {
      $('#loginErr').textContent = e.message || 'Login failed';
      $('#loginErr').classList.remove('hidden');
    } finally {
      $('#loginBtn').disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/auth/logout', { method:'POST' });
    await refreshMe();
  });

  // Navigation
  window.addEventListener('hashchange', () => setActive(location.hash || '#/dashboard'));
  setActive(location.hash || '#/dashboard');

  $('#reloadBtn').addEventListener('click', async () => {
    await refreshMe();
  });

  // Shows
  async function loadVenues() {
    try {
      const r = await api('/admin/venues');
      const sel = $('#venueSelect');
      sel.innerHTML = '';
      (r.venues || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name + (v.city ? (' – ' + v.city) : '');
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadShows() {
    try {
      const r = await api('/admin/shows/latest?limit=20');
      const box = $('#showsList');
      if (!r.shows || r.shows.length === 0) {
        box.textContent = 'No shows yet.';
        return;
      }
      box.innerHTML = r.shows.map(s => {
        return \`<div style="padding:8px 0; border-bottom:1px solid var(--border)">
          <div style="font-weight:600">\${s.title}</div>
          <div class="muted">\${new Date(s.startsAt).toLocaleString()} — \${s.venue?.name || 'Unknown'}</div>
        </div>\`;
      }).join('');
    } catch (e) {
      $('#showsList').textContent = 'Failed to load shows';
    }
  }

  async function loadOrders() {
    try {
      const r = await api('/admin/orders?limit=20');
      const box = $('#ordersList');
      if (!r.orders || r.orders.length === 0) {
        box.textContent = 'No recent orders.';
        return;
      }
      box.innerHTML = r.orders.map(o => {
        return \`<div style="padding:8px 0; border-bottom:1px solid var(--border)">
          <div><strong>\${o.email}</strong> — £\${(o.totalPence/100).toFixed(2)} <span class="muted">(\${o.status})</span></div>
          <div class="muted">Show: \${o.show?.title || ''} • \${new Date(o.createdAt).toLocaleString()}</div>
        </div>\`;
      }).join('');
    } catch (e) {
      $('#ordersList').textContent = 'Failed to load orders';
    }
  }

  $('#btnCreateShow').addEventListener('click', async () => {
    $('#btnCreateShow').disabled = true;
    $('#showCreateMsg').textContent = '';
    try {
      const title = $('#showTitle').value.trim();
      const startsAt = $('#showStartsAt').value.trim();
      const venueId = Number($('#venueSelect').value);
      const capacity = $('#showCapacity').value.trim();
      const description = $('#showDesc').value.trim();
      const posterUrl = $('#posterUrl').value.trim() || null;

      if (!title || !startsAt || !venueId) throw new Error('Title, startsAt, venue are required');

      const payload = {
        title,
        startsAt,
        venueId,
        description: description || null,
        capacity: capacity ? Number(capacity) : null,
        posterUrl,
      };
      await api('/admin/shows', { method:'POST', body: payload });
      $('#showCreateMsg').textContent = 'Show created.';
      await loadShows();
    } catch (e) {
      $('#showCreateMsg').textContent = e.message || 'Failed to create show';
    } finally {
      $('#btnCreateShow').disabled = false;
    }
  });

  // initial
  refreshMe();
</script>
</body>
</html>`);
});

export default router;
