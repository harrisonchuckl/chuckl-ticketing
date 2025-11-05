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
  .toast{position:fixed;left:16px;right:16px;bottom:16px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
  /* simple modal */
  .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}
  .modal .box{background:#0f1220;border:1px solid #21263b;border-radius:12px;padding:16px;max-width:520px;width:92%}
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

<!-- Modal: Add Venue -->
<div class="modal" id="venueModal">
  <div class="box">
    <h3 style="margin:0 0 8px">Add Venue</h3>
    <div class="grid two">
      <div>
        <label>Name</label>
        <input id="vm_name" type="text" />
      </div>
      <div>
        <label>Capacity</label>
        <input id="vm_capacity" type="number" min="0" />
      </div>
    </div>
    <div class="grid two">
      <div>
        <label>Address</label>
        <input id="vm_address" type="text" />
      </div>
      <div>
        <label>City</label>
        <input id="vm_city" type="text" />
      </div>
    </div>
    <div class="grid two">
      <div>
        <label>Postcode</label>
        <input id="vm_postcode" type="text" />
      </div>
      <div></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="vm_cancel">Cancel</button>
      <button class="btn" id="vm_save">Save Venue</button>
    </div>
  </div>
</div>

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
        <td><span class="tag">Manage</span></td>
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

  // ---------- Add Venue Modal ----------
  const venueModal = $('#venueModal');
  $('#addVenueBtn').addEventListener('click', () => {
    venueModal.style.display = 'flex';
  });
  $('#vm_cancel').addEventListener('click', () => {
    venueModal.style.display = 'none';
  });
  $('#vm_save').addEventListener('click', async () => {
    const name = $('#vm_name').value.trim();
    const capacity = Number($('#vm_capacity').value || '0');
    const address = $('#vm_address').value.trim() || null;
    const city = $('#vm_city').value.trim() || null;
    const postcode = $('#vm_postcode').value.trim() || null;
    if (!name) { showToast('Venue name required', false); return; }

    const r = await jpost('/admin/venues', { name, capacity, address, city, postcode });
    if (!r || !r.ok) { showToast(r?.message || 'Failed to create venue', false); return; }

    venueModal.style.display = 'none';
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
          <button class="btn secondary" data-act="manage" data-id="\${s.id}">Manage</button>
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

  // init on load
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
