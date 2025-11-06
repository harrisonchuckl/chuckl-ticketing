// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0e15;color:#e8ebf7}
  .layout{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
  .aside{background:#0f1220;border-right:1px solid #21263b;padding:16px;position:sticky;top:0;height:100vh;overflow:auto}
  .brand{font-weight:800;font-size:18px;margin-bottom:12px}
  .kbox{background:#12162a;border:1px solid #21263b;border-radius:10px;padding:10px;margin-bottom:16px}
  .kbox label{font-size:12px;color:#9aa0b5;display:block;margin:0 0 6px}
  .kbox input{width:100%;padding:10px;border:1px solid #2a2f46;border-radius:8px;background:#0b0e19;color:#e8ebf7}
  .nav{margin-top:10px}
  .nav button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:#cfd5ec;cursor:pointer}
  .nav button.active{background:#1a1f38;color:#fff}
  .main{padding:20px}
  .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .btn{appearance:none;border:0;border-radius:8px;padding:10px 12px;background:#4053ff;color:#fff;font-weight:650;cursor:pointer}
  .btn.secondary{background:#2a2f46;color:#e8ebf7}
  .btn.ghost{background:transparent;border:1px solid #2a2f46}
  .panel{background:#0f1220;border:1px solid #21263b;border-radius:12px;padding:16px;margin-bottom:14px}
  .grid{display:grid;gap:12px}
  .grid.two{grid-template-columns:1fr 1fr}
  .grid.three{grid-template-columns:repeat(3,1fr)}
  label{display:block;font-size:12px;color:#9aa0b5;margin:6px 0}
  input,select,textarea{width:100%;padding:10px;border:1px solid #2a2f46;border-radius:8px;background:#0b0e19;color:#e8ebf7}
  textarea{min-height:80px;resize:vertical}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px;border-bottom:1px solid #20253a;text-align:left;font-size:14px}
  th{color:#9aa0b5;font-weight:600}
  .muted{color:#9aa0b5}
  .tag{display:inline-block;padding:3px 8px;border-radius:999px;background:#1a1f38;color:#cfd5ec;font-size:12px}
  .toast{position:fixed;left:16px;right:16px;bottom:16px;padding:12px 14px;border-radius:10px;font-weight:600;z-index:9999}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
  /* Manage drawer */
  .drawer{position:fixed;top:0;right:0;height:100vh;width:520px;background:#0f1220;border-left:1px solid #21263b;box-shadow:0 0 40px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .2s ease;z-index:9998;display:flex;flex-direction:column}
  .drawer.open{transform:translateX(0)}
  .drawer .head{padding:14px 16px;border-bottom:1px solid #21263b;display:flex;justify-content:space-between;align-items:center}
  .drawer .body{padding:16px;overflow:auto}
</style>
</head>
<body>
<div class="layout">
  <aside class="aside">
    <div class="brand">Chuckl. Admin</div>
    <div class="kbox">
      <label>Admin Key</label>
      <input id="adminkey" type="text" placeholder="enter your admin key"/>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn secondary" id="saveKeyBtn">Save Key</button>
        <button class="btn ghost" id="clearKeyBtn">Clear</button>
      </div>
    </div>
    <div class="nav">
      <button data-tab="dashboard" class="active">Dashboard</button>
      <button data-tab="shows">Shows</button>
      <button data-tab="venues">Venues</button>
      <button data-tab="orders">Orders</button>
      <button data-tab="tickets">Tickets</button>
      <button data-tab="marketing">Marketing</button>
      <button data-tab="finance">Finance</button>
      <button data-tab="settings">Settings</button>
      <button data-tab="tools">Tools</button>
    </div>
  </aside>

  <main class="main">
    <!-- DASHBOARD -->
    <section id="tab-dashboard" class="panel">
      <div class="toolbar">
        <button class="btn" id="loadLatestBtn">Load latest shows</button>
        <span class="muted">Quick overview of your most recent events.</span>
      </div>
      <div class="panel">
        <table id="latestTable">
          <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th>Tickets</th><th>Orders</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- SHOWS -->
    <section id="tab-shows" class="panel hidden">
      <div class="toolbar">
        <button class="btn" id="refreshShowsBtn">Refresh</button>
        <span class="muted">Create and manage shows</span>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">Create Show</h3>
        <div class="grid two">
          <div>
            <label>Title</label>
            <input id="showTitle" type="text" placeholder="e.g. Chuckl. XL Comedy Night" />
          </div>
          <div>
            <label>Date & Time</label>
            <input id="showDate" type="datetime-local" />
          </div>
        </div>
        <label>Description</label>
        <textarea id="showDesc" placeholder="Short description (optional)"></textarea>

        <div class="grid two" style="margin-top:8px">
          <div>
            <label>Venue</label>
            <div style="display:flex;gap:8px">
              <select id="venueSelect" style="flex:1">
                <option value="">Loading venues…</option>
              </select>
              <button class="btn secondary" id="addVenueBtn" title="Add new venue">+ Venue</button>
            </div>
          </div>
          <div>
            <label>Poster URL</label>
            <input id="posterUrl" type="url" placeholder="https://…" />
          </div>
        </div>

        <div style="margin-top:10px">
          <button class="btn" id="createShowBtn">Create Show</button>
        </div>
      </div>

      <div class="panel">
        <h3 style="margin-top:0">Shows (Latest)</h3>
        <table id="showsTable">
          <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th>Tickets</th><th>Orders</th><th>Actions</th></tr></thead>
        <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- VENUES -->
    <section id="tab-venues" class="panel hidden">
      <div class="toolbar">
        <input id="venueSearch" type="text" placeholder="Search venues by name/city/postcode" style="flex:1;max-width:360px"/>
        <button class="btn secondary" id="searchVenuesBtn">Search</button>
        <button class="btn" id="newVenueBtn">New Venue</button>
      </div>
      <div class="panel">
        <table id="venuesTable">
          <thead><tr><th>Name</th><th>City</th><th>Postcode</th><th>Capacity</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- Placeholder tabs -->
    <section id="tab-orders" class="panel hidden"><p class="muted">Orders module (coming soon).</p></section>
    <section id="tab-tickets" class="panel hidden"><p class="muted">Tickets module (coming soon).</p></section>
    <section id="tab-marketing" class="panel hidden"><p class="muted">Marketing automations, emails, segments (coming soon).</p></section>
    <section id="tab-finance" class="panel hidden"><p class="muted">Finance & settlements (coming soon).</p></section>
    <section id="tab-settings" class="panel hidden"><p class="muted">Settings (branding, domains, tax) (coming soon).</p></section>
    <section id="tab-tools" class="panel hidden"><p class="muted">Tools (scanner, preshow stats, exports) (coming soon).</p></section>
  </main>
</div>

<!-- Drawer: Manage Show -->
<div class="drawer" id="manageDrawer">
  <div class="head">
    <div>
      <div id="md_title" style="font-weight:700">Manage Show</div>
      <div id="md_sub" class="muted" style="font-size:12px;margin-top:2px"></div>
    </div>
    <button class="btn ghost" id="md_close">Close</button>
  </div>
  <div class="body">
    <div class="panel">
      <h3 style="margin-top:0">Ticket Types</h3>
      <div id="tt_list" class="panel" style="padding:0">
        <table style="width:100%">
          <thead><tr><th>Name</th><th>Price</th><th>Available</th><th></th></tr></thead>
          <tbody id="tt_tbody"></tbody>
        </table>
      </div>
      <div class="grid three" style="margin-top:10px">
        <div>
          <label>Name</label>
          <input id="tt_new_name" type="text" placeholder="e.g. General Admission"/>
        </div>
        <div>
          <label>Price (GBP)</label>
          <input id="tt_new_price" type="number" min="0" step="0.01" placeholder="e.g. 22.50"/>
        </div>
        <div>
          <label>Available (optional)</label>
          <input id="tt_new_available" type="number" min="0" placeholder="e.g. 200"/>
        </div>
      </div>
      <div style="margin-top:10px">
        <button class="btn" id="tt_create_btn">Add Ticket Type</button>
      </div>
    </div>
  </div>
</div>

<div id="venueModal" class="hidden"></div> <!-- (kept placeholder; we use add venue button on Shows) -->
<div id="toast" class="toast hidden"></div>

<script>
  // ---------- Utilities ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const toast = $('#toast');

  function showToast(msg, ok = true, ms = 2200) {
    toast.textContent = msg;
    toast.className = 'toast ' + (ok ? 'ok' : 'err');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), ms);
  }

  function getKey() {
    return localStorage.getItem('adminKey') || '';
  }
  function setKey(v) {
    localStorage.setItem('adminKey', v || '');
  }

  async function jget(path) {
    const key = getKey();
    const qs = path.includes('?') ? '&' : '?';
    const url = path + qs + 'k=' + encodeURIComponent(key);
    const r = await fetch(url, { headers: { 'x-admin-key': key }});
    return r.json();
  }
  async function jpost(path, body) {
    const key = getKey();
    const qs = path.includes('?') ? '&' : '?';
    const url = path + qs + 'k=' + encodeURIComponent(key);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify(body || {})
    });
    return r.json();
  }
  async function jput(path, body) {
    const key = getKey();
    const qs = path.includes('?') ? '&' : '?';
    const url = path + qs + 'k=' + encodeURIComponent(key);
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify(body || {})
    });
    return r.json();
  }
  async function jdel(path) {
    const key = getKey();
    const qs = path.includes('?') ? '&' : '?';
    const url = path + qs + 'k=' + encodeURIComponent(key);
    const r = await fetch(url, { method: 'DELETE', headers: { 'x-admin-key': key }});
    return r.json();
  }

  // ---------- Nav ----------
  $$('.nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('main > section').forEach(s => s.classList.add('hidden'));
      $('#tab-' + tab).classList.remove('hidden');
    });
  });

  // ---------- Key ----------
  const keyInput = $('#adminkey');
  keyInput.value = getKey();
  $('#saveKeyBtn').addEventListener('click', () => {
    setKey(keyInput.value.trim());
    showToast('Admin key saved', true, 1000);
  });
  $('#clearKeyBtn').addEventListener('click', () => {
    setKey('');
    keyInput.value = '';
    showToast('Cleared', true, 1000);
  });

  // ---------- Dashboard: Latest shows ----------
  const latestTbody = $('#latestTable tbody');
  async function loadLatestShows() {
    latestTbody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
    const r = await jget('/admin/shows/latest?limit=20');
    if (!r || !r.ok) {
      latestTbody.innerHTML = '<tr><td colspan="6" class="muted">Failed to load shows</td></tr>';
      return;
    }
    if (!r.shows?.length) {
      latestTbody.innerHTML = '<tr><td colspan="6" class="muted">No shows yet</td></tr>';
      return;
    }
    latestTbody.innerHTML = r.shows.map(s => {
      const d = new Date(s.date);
      const when = d.toLocaleString();
      const venue = s.venue ? s.venue.name : '—';
      return \`<tr>
        <td>\${s.title}</td>
        <td>\${when}</td>
        <td>\${venue}</td>
        <td>\${s._count?.tickets ?? 0}</td>
        <td>\${s._count?.orders ?? 0}</td>
        <td><button class="btn secondary" data-manage="\${s.id}" data-title="\${s.title}" data-date="\${s.date}" data-venue="\${venue}">Manage</button></td>
      </tr>\`;
    }).join('');
  }
  $('#loadLatestBtn').addEventListener('click', loadLatestShows);

  // ---------- Venues (list + search) ----------
  const venuesTableBody = $('#venuesTable tbody');
  async function refreshVenuesList(q = '') {
    venuesTableBody.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
    const r = await jget('/admin/venues' + (q ? ('?q=' + encodeURIComponent(q)) : ''));
    if (!r || !r.ok) {
      venuesTableBody.innerHTML = '<tr><td colspan="4" class="muted">Failed to load venues</td></tr>';
      return;
    }
    if (!r.venues?.length) {
      venuesTableBody.innerHTML = '<tr><td colspan="4" class="muted">No venues</td></tr>';
      return;
    }
    venuesTableBody.innerHTML = r.venues.map(v => {
      return \`<tr>
        <td>\${v.name}</td>
        <td>\${v.city ?? '—'}</td>
        <td>\${v.postcode ?? '—'}</td>
        <td>\${v.capacity ?? '—'}</td>
      </tr>\`;
    }).join('');
  }
  $('#searchVenuesBtn').addEventListener('click', () => {
    const q = $('#venueSearch').value.trim();
    refreshVenuesList(q);
  });

  // ---------- Venue dropdown for Show Create ----------
  const venueSelect = $('#venueSelect');
  async function loadVenueOptions() {
    venueSelect.innerHTML = '<option value="">Loading…</option>';
    const r = await jget('/admin/venues?limit=200');
    if (!r || !r.ok) {
      venueSelect.innerHTML = '<option value="">Failed to load venues</option>';
      return;
    }
    if (!r.venues?.length) {
      venueSelect.innerHTML = '<option value="">No venues yet</option>';
      return;
    }
    venueSelect.innerHTML = '<option value="">Select a venue…</option>' + r.venues.map(v =>
      \`<option value="\${v.id}">\${v.name}\${v.city ? (' – ' + v.city) : ''}</option>\`
    ).join('');
  }

  // Add Venue (quick inline on Shows tab)
  $('#addVenueBtn').addEventListener('click', async () => {
    const name = prompt('Venue name?');
    if (!name) return;
    const capacityStr = prompt('Capacity (optional number)?') || '';
    const capacityNum = capacityStr.trim() ? Number(capacityStr) : null;
    const address = prompt('Address (optional)?') || null;
    const city = prompt('City (optional)?') || null;
    const postcode = prompt('Postcode (optional)?') || null;

    const r = await jpost('/admin/venues', {
      name,
      capacity: (capacityNum !== null && !Number.isNaN(capacityNum)) ? capacityNum : null,
      address, city, postcode
    });
    if (!r || !r.ok) { showToast(r?.message || 'Failed to create venue', false); return; }

    showToast('Venue created', true);
    await loadVenueOptions();
    venueSelect.value = r.venue.id;
    await refreshVenuesList();
  });

  // ---------- Shows: create & list ----------
  const showsBody = $('#showsTable tbody');
  async function refreshShowsList() {
    showsBody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
    const r = await jget('/admin/shows/latest?limit=20');
    if (!r || !r.ok) { showsBody.innerHTML = '<tr><td colspan="6" class="muted">Failed to load</td></tr>'; return; }
    if (!r.shows?.length) { showsBody.innerHTML = '<tr><td colspan="6" class="muted">No shows yet</td></tr>'; return; }
    showsBody.innerHTML = r.shows.map(s => {
      const d = new Date(s.date);
      const when = d.toLocaleString();
      const venue = s.venue ? s.venue.name : '—';
      return \`<tr>
        <td>\${s.title}</td>
        <td>\${when}</td>
        <td>\${venue}</td>
        <td>\${s._count?.tickets ?? 0}</td>
        <td>\${s._count?.orders ?? 0}</td>
        <td>
          <button class="btn secondary" data-manage="\${s.id}" data-title="\${s.title}" data-date="\${s.date}" data-venue="\${venue}">Manage</button>
        </td>
      </tr>\`;
    }).join('');
  }

  $('#refreshShowsBtn').addEventListener('click', refreshShowsList);

  $('#createShowBtn').addEventListener('click', async () => {
    const title = $('#showTitle').value.trim();
    const desc = $('#showDesc').value.trim() || null;
    const dateStr = $('#showDate').value;
    const venueId = $('#venueSelect').value;
    const posterUrl = $('#posterUrl').value.trim() || null;

    if (!title || !dateStr || !venueId) { showToast('Title, date & venue are required', false); return; }

    const dateISO = new Date(dateStr).toISOString();
    const r = await jpost('/admin/shows', { title, description: desc, dateISO, venueId, posterUrl });
    if (!r || !r.ok) { showToast(r?.message || 'Failed to create show', false); return; }

    showToast('Show created', true);
    $('#showTitle').value = '';
    $('#showDesc').value = '';
    $('#showDate').value = '';
    $('#posterUrl').value = '';
    await refreshShowsList();
    await loadLatestShows();
  });

  // ---------- Manage Drawer (Ticket Types) ----------
  const drawer = $('#manageDrawer');
  const mdClose = $('#md_close');
  const mdTitle = $('#md_title');
  const mdSub = $('#md_sub');
  const ttBody = $('#tt_tbody');

  let currentShowId = null;

  async function openManageDrawer(show) {
    currentShowId = show.id;
    mdTitle.textContent = show.title;
    const when = new Date(show.date).toLocaleString();
    mdSub.textContent = when + (show.venue ? ' @ ' + show.venue : '');
    drawer.classList.add('open');
    await loadTicketTypes();
  }

  mdClose.addEventListener('click', () => {
    drawer.classList.remove('open');
    currentShowId = null;
  });

  async function loadTicketTypes() {
    if (!currentShowId) return;
    ttBody.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
    const r = await jget('/admin/shows/' + encodeURIComponent(currentShowId) + '/ticket-types');
    if (!r || !r.ok) { ttBody.innerHTML = '<tr><td colspan="4" class="muted">Failed to load</td></tr>'; return; }
    const rows = (r.ticketTypes || []).map(tt => {
      const price = (tt.pricePence / 100).toFixed(2);
      const avail = (tt.available ?? '—');
      return \`<tr data-tt="\${tt.id}">
        <td><input data-role="name" type="text" value="\${tt.name}"/></td>
        <td><input data-role="price" type="number" step="0.01" min="0" value="\${price}"/></td>
        <td><input data-role="available" type="number" min="0" value="\${avail === '—' ? '' : avail}"/></td>
        <td>
          <button class="btn secondary" data-tt-act="save">Save</button>
          <button class="btn ghost" data-tt-act="delete">Delete</button>
        </td>
      </tr>\`;
    }).join('');
    ttBody.innerHTML = rows || '<tr><td colspan="4" class="muted">No ticket types yet</td></tr>';

    // bind row buttons
    ttBody.querySelectorAll('button[data-tt-act="save"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const id = tr.getAttribute('data-tt');
        const name = tr.querySelector('input[data-role="name"]').value.trim();
        const priceGbp = parseFloat(tr.querySelector('input[data-role="price"]').value || '0');
        const availStr = tr.querySelector('input[data-role="available"]').value;
        const available = availStr === '' ? null : Number(availStr);
        if (!name) { showToast('Name required', false); return; }
        const pricePence = Math.round((Number.isFinite(priceGbp) ? priceGbp : 0) * 100);

        const r2 = await jput('/admin/shows/' + encodeURIComponent(currentShowId) + '/ticket-types/' + encodeURIComponent(id), {
          name, pricePence, available
        });
        if (!r2 || !r2.ok) { showToast(r2?.message || 'Failed to save', false); return; }
        showToast('Saved', true, 1200);
        await loadTicketTypes();
      });
    });

    ttBody.querySelectorAll('button[data-tt-act="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const id = tr.getAttribute('data-tt');
        if (!confirm('Delete this ticket type?')) return;
        const r2 = await jdel('/admin/shows/' + encodeURIComponent(currentShowId) + '/ticket-types/' + encodeURIComponent(id));
        if (!r2 || !r2.ok) { showToast(r2?.message || 'Failed to delete', false); return; }
        showToast('Deleted', true, 1200);
        await loadTicketTypes();
      });
    });
  }

  // create new ticket type
  $('#tt_create_btn').addEventListener('click', async () => {
    if (!currentShowId) { showToast('Open Manage on a show first', false); return; }
    const name = $('#tt_new_name').value.trim();
    const priceGbp = parseFloat($('#tt_new_price').value || '0');
    const availStr = $('#tt_new_available').value;
    const available = availStr === '' ? null : Number(availStr);
    if (!name) { showToast('Name required', false); return; }
    const pricePence = Math.round((Number.isFinite(priceGbp) ? priceGbp : 0) * 100);

    const r = await jpost('/admin/shows/' + encodeURIComponent(currentShowId) + '/ticket-types', {
      name, pricePence, available
    });
    if (!r || !r.ok) { showToast(r?.message || 'Failed to add', false); return; }

    $('#tt_new_name').value = '';
    $('#tt_new_price').value = '';
    $('#tt_new_available').value = '';
    showToast('Ticket type added', true);
    await loadTicketTypes();
  });

  // bind all Manage buttons (dashboard & shows tab)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-manage]');
    if (!btn) return;
    const id = btn.getAttribute('data-manage');
    const title = btn.getAttribute('data-title');
    const date = btn.getAttribute('data-date');
    const venue = btn.getAttribute('data-venue');
    await openManageDrawer({ id, title, date, venue });
  });

  // init
  (async function init() {
    await loadVenueOptions();
    await refreshShowsList();
    await refreshVenuesList();
    await loadLatestShows();
  })();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
