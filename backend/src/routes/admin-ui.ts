// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/admin/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1000px;margin:0 auto;padding:18px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px;margin-bottom:16px}
  h1{font-size:22px;margin:0 0 12px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:8px 0 6px}
  input, select, textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  textarea{min-height:80px;resize:vertical}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .row > * { flex:1; min-width:220px }
  button{appearance:none;border:0;border-radius:10px;padding:12px 14px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .list .item{padding:12px;border-radius:10px;background:#0f1220;border:1px solid #22263a;margin:8px 0}
  .item h3{margin:0 0 6px;font-size:16px}
  .muted{color:#9aa0b5;font-size:12px}
  .actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Chuckl. Admin</h1>
    <label>Admin Key</label>
    <input id="adminkey" type="text" placeholder="enter your admin key" />
    <div class="actions" style="margin-top:10px">
      <button id="loadShows">Load latest shows</button>
      <button id="loadVenues" class="secondary">Refresh venues</button>
    </div>
    <p class="muted">Shows load from <code>/admin/shows/latest</code> (limit 20). Your key is sent as <code>x-admin-key</code>.</p>
    <div id="err" class="muted"></div>
  </div>

  <div class="card">
    <h2 style="margin:0 0 10px;font-size:18px">Create Show</h2>
    <div class="row">
      <div>
        <label>Title</label>
        <input id="title" type="text" placeholder="e.g. Chuckl. Comedy Night" />
      </div>
      <div>
        <label>Date & Time</label>
        <input id="date" type="datetime-local" />
      </div>
    </div>

    <label>Description</label>
    <textarea id="description" placeholder="Optional details shown on the public page"></textarea>

    <div class="row">
      <div>
        <label>Venue</label>
        <select id="venue"></select>
      </div>
      <div>
        <label>Capacity (override)</label>
        <input id="capacity" type="number" min="0" placeholder="Leave blank to use venue capacity" />
      </div>
    </div>

    <label>Image URL (temporary)</label>
    <input id="imageUrl" type="text" placeholder="https://...jpg (we'll integrate uploads later)" />

    <div class="actions" style="margin-top:12px">
      <button id="createBtn">Create Show</button>
      <button id="resetBtn" class="secondary">Reset</button>
    </div>
    <p class="muted" id="capacityHint"></p>
  </div>

  <div class="card">
    <h2 style="margin:0 0 10px;font-size:18px">Latest Shows</h2>
    <div class="list" id="showList"></div>
  </div>
</div>

<div id="toast" class="toast hidden"></div>

<script>
const adminkey = document.getElementById('adminkey');
const loadShowsBtn = document.getElementById('loadShows');
const loadVenuesBtn = document.getElementById('loadVenues');
const err = document.getElementById('err');

const titleEl = document.getElementById('title');
const dateEl = document.getElementById('date');
const descEl = document.getElementById('description');
const venueSel = document.getElementById('venue');
const capEl = document.getElementById('capacity');
const imgEl = document.getElementById('imageUrl');
const createBtn = document.getElementById('createBtn');
const resetBtn = document.getElementById('resetBtn');
const capacityHint = document.getElementById('capacityHint');
const showList = document.getElementById('showList');
const toast = document.getElementById('toast');

function showToast(msg, ok=true, ms=3000) {
  toast.textContent = msg;
  toast.className = 'toast ' + (ok ? 'ok' : 'err');
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), ms);
}

function kfetch(path, opts={}) {
  const headers = Object.assign({}, opts.headers||{}, { 'x-admin-key': adminkey.value.trim() });
  return fetch(path, Object.assign({}, opts, { headers }));
}

async function loadVenues() {
  venueSel.innerHTML = '';
  const r = await kfetch('/admin/venues');
  if (!r.ok) { err.textContent = 'Failed to load venues'; return; }
  const j = await r.json();
  if (!j.ok) { err.textContent = j.message || 'Failed to load venues'; return; }
  const frag = document.createDocumentFragment();
  j.venues.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name + (v.city ? ' – ' + v.city : '');
    opt.dataset.capacity = v.capacity ?? '';
    frag.appendChild(opt);
  });
  venueSel.appendChild(frag);
  updateCapacityHint();
}

function updateCapacityHint() {
  const opt = venueSel.selectedOptions[0];
  const vcap = opt ? Number(opt.dataset.capacity || 0) : 0;
  capacityHint.textContent = vcap ? ('Venue capacity: ' + vcap + '. Leave override empty to use this.') : 'Venue has no capacity set.';
}

venueSel.addEventListener('change', updateCapacityHint);

async function loadShows() {
  showList.innerHTML = '';
  const r = await kfetch('/admin/shows/latest?limit=20');
  if (!r.ok) { err.textContent = 'Failed to load shows'; return; }
  const j = await r.json();
  if (!j.ok) { err.textContent = j.message || 'Failed to load shows'; return; }
  j.shows.forEach(renderShowItem);
}

function renderShowItem(s) {
  const div = document.createElement('div');
  div.className = 'item';
  const when = new Date(s.date).toLocaleString('en-GB');
  div.innerHTML = \`
    <h3>\${s.title}</h3>
    <div class="muted">\${when} — \${s.venue?.name || 'Unknown venue'}</div>
    <div class="actions">
      <button data-id="\${s.id}" class="secondary edit">Edit</button>
      <button data-id="\${s.id}" class="danger" style="background:#6a2a2c">Delete</button>
    </div>
  \`;
  div.querySelector('.edit').addEventListener('click', ()=> openEdit(s));
  div.querySelector('.danger').addEventListener('click', ()=> delShow(s.id));
  showList.appendChild(div);
}

function resetForm() {
  titleEl.value = '';
  dateEl.value = '';
  descEl.value = '';
  imgEl.value = '';
  capEl.value = '';
}

async function createShow() {
  const key = adminkey.value.trim();
  if (!key) return showToast('Enter admin key', false);

  const title = titleEl.value.trim();
  const dateISO = dateEl.value ? new Date(dateEl.value).toISOString() : '';
  const venueId = venueSel.value;
  const capacity = capEl.value ? Number(capEl.value) : undefined;
  const imageUrl = imgEl.value.trim() || undefined;
  const description = descEl.value.trim() || undefined;

  if (!title || !dateISO || !venueId) return showToast('Title, Date and Venue are required.', false);

  const r = await kfetch('/admin/shows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, date: dateISO, venueId, capacity, imageUrl })
  });

  const j = await r.json();
  if (!r.ok || !j.ok) {
    return showToast(j.message || 'Create failed', false);
  }
  showToast('Show created');
  resetForm();
  await loadShows();
}

async function delShow(id) {
  if (!confirm('Delete this show? This cannot be undone (and only works if no tickets exist).')) return;
  const r = await kfetch('/admin/shows/' + id, { method: 'DELETE' });
  const j = await r.json();
  if (!r.ok || !j.ok) return showToast(j.message || 'Delete failed', false);
  showToast('Show deleted');
  await loadShows();
}

async function openEdit(s) {
  const titleNew = prompt('Edit title', s.title);
  if (titleNew === null) return;
  const r = await kfetch('/admin/shows/' + s.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titleNew })
  });
  const j = await r.json();
  if (!r.ok || !j.ok) return showToast(j.message || 'Update failed', false);
  showToast('Updated');
  await loadShows();
}

loadVenuesBtn.addEventListener('click', loadVenues);
loadShowsBtn.addEventListener('click', loadShows);
createBtn.addEventListener('click', createShow);
resetBtn.addEventListener('click', resetForm);

// Autoload if we already know a key via ?k= param
const urlK = new URLSearchParams(location.search).get('k');
if (urlK) adminkey.value = urlK;
loadVenues();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
