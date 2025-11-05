// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;background:#0b0b10;color:#e8ebf7;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
  .wrap{max-width:1000px;margin:28px auto;padding:0 16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px}
  h1{margin:0 0 10px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input, select{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:16px}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  button{appearance:none;border:0;border-radius:10px;padding:10px 14px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .muted{color:#9aa0b5;font-size:12px}
  .err{color:#ffd7d9}
  .list{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .item{background:#0f1220;border:1px solid #22263a;border-radius:10px;padding:12px;cursor:pointer}
  .item h3{margin:0 0 4px;font-size:16px}
  .details{margin-top:10px;border-top:1px dashed #2a2f46;padding-top:10px}
  .kv{display:grid;grid-template-columns:120px 1fr;gap:6px;font-size:14px}
  .badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#22263a;margin-right:6px;font-size:12px}
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
      <input id="adminkey" type="text" placeholder="enter admin key (or use ?k=...)" />
      <div class="row">
        <button id="loadBtn">Load latest shows</button>
        <button id="openScanner" class="secondary">Open scanner</button>
      </div>
      <p class="muted">Shows load from <code>/admin/shows/latest</code>. Your key is sent as <code>x-admin-key</code>.</p>
      <p class="muted" id="error"></p>
    </div>

    <div class="card" style="margin-top:14px">
      <h2 style="margin:0 0 8px;font-size:18px">Create Show (starter)</h2>
      <div class="row">
        <div style="flex:1;min-width:220px">
          <label>Title</label>
          <input id="newTitle" type="text" placeholder="e.g. Chuckl. Comedy Night"/>
        </div>
        <div style="flex:1;min-width:220px">
          <label>Date & Time</label>
          <input id="newDate" type="datetime-local"/>
        </div>
      </div>
      <div class="row">
        <div style="flex:1;min-width:220px">
          <label>Venue</label>
          <select id="venueSelect"><option value="">Loading venues…</option></select>
        </div>
        <div style="width:220px">
          <label>Capacity override (optional)</label>
          <input id="capOverride" type="text" placeholder="e.g. 350"/>
        </div>
      </div>
      <div class="row">
        <button id="createBtn">Create Show</button>
      </div>
      <p class="muted">This seeds the show; ticket types and pricing can be added later.</p>
    </div>

    <div class="list" id="list"></div>
  </div>

  <div id="toast" class="toast hidden"></div>

<script>
const q = new URLSearchParams(location.search);
if (q.get('k')) document.getElementById('adminkey').value = q.get('k');

const errEl = document.getElementById('error');
const listEl = document.getElementById('list');
const toast = document.getElementById('toast');
const venueSelect = document.getElementById('venueSelect');

function showError(msg){ errEl.textContent = 'Error: ' + msg; errEl.className='muted err'; }
function clearError(){ errEl.textContent=''; errEl.className='muted'; }
function showToast(msg, ok=true){
  toast.textContent = msg;
  toast.className = 'toast ' + (ok ? 'ok' : 'err');
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), 2500);
}

function adminKey(){
  const k = (document.getElementById('adminkey').value || '').trim();
  if (!k) throw new Error('Admin key required');
  return k;
}

async function fetchJSON(url, opts){
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error:true, message:'Invalid JSON', raw:text, status:r.status }; }
}

async function loadVenues(){
  try{
    const k = adminKey();
    const data = await fetchJSON('/admin/venues', { headers:{ 'x-admin-key': k }});
    if (!data || !data.ok) throw new Error(data?.message || 'Failed to load venues');
    venueSelect.innerHTML = '<option value="">Select a venue…</option>';
    for(const v of data.venues){
      const opt = document.createElement('option');
      opt.value = v.id;
      const bits = [v.name, v.city, v.postcode].filter(Boolean).join(', ');
      opt.textContent = bits || v.name || 'Venue';
      venueSelect.appendChild(opt);
    }
  }catch(e){ showToast(String(e.message||e), false); }
}

async function createShow(){
  try{
    const k = adminKey();
    const title = document.getElementById('newTitle').value.trim();
    const date = document.getElementById('newDate').value;
    const venueId = venueSelect.value;
    const capacityOverride = document.getElementById('capOverride').value.trim();

    if (!title || !date || !venueId) { showToast('Title, date and venue are required', false); return; }

    const payload = { title, date, venueId };
    if (capacityOverride) payload.capacityOverride = Number(capacityOverride);

    const res = await fetchJSON('/admin/shows', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'x-admin-key': k },
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) throw new Error(res?.message || 'Failed to create show');
    showToast('Show created');
    await loadShows(); // refresh
  }catch(e){ showToast(String(e.message||e), false); }
}

async function loadShows(){
  clearError();
  listEl.innerHTML = '';
  try{
    const k = adminKey();
    const data = await fetchJSON('/admin/shows/latest?limit=20', { headers: { 'x-admin-key': k }});
    if (!data || !data.ok) throw new Error(data?.message || 'Failed to load shows');
    const shows = data.shows || [];
    for(const s of shows){
      listEl.appendChild(renderShowItem(s));
    }
  }catch(e){ showError(String(e.message||e)); }
}

function renderShowItem(show){
  const when = new Date(show.date).toLocaleString('en-GB');
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = \`
    <h3>\${show.title}</h3>
    <div class="muted">\${when}</div>
    <div class="details" style="display:none"></div>
  \`;
  const details = div.querySelector('.details');

  div.addEventListener('click', async (ev) => {
    // prevent clicks on buttons inside details from re-toggling the card
    if (ev.target.closest('button')) return;

    if (details.style.display === 'none') {
      // expand + fetch details
      try{
        const k = adminKey();
        const data = await fetchJSON('/admin/shows/' + show.id, { headers: { 'x-admin-key': k }});
        if (!data || !data.ok) throw new Error(data?.message || 'Failed to load show');
        const d = data.show;
        const stats = data.stats || { checkedIn: 0, remaining: 0, total: 0 };
        const venueBits = [d.venue?.name, d.venue?.city, d.venue?.postcode].filter(Boolean).join(', ');

        const ttypes = (d.ticketTypes||[]).map(t => \`<span class="badge">\${t.name} · £\${(t.pricePence/100).toFixed(2)} · avail:\${t.available ?? '—'}</span>\`).join(' ');

        details.innerHTML = \`
          <div class="kv">
            <div>Venue</div><div>\${venueBits || '—'}</div>
            <div>Orders</div><div>\${d._count?.orders ?? 0}</div>
            <div>Tickets</div><div>\${d._count?.tickets ?? 0}</div>
            <div>Checked-in</div><div>\${stats.checkedIn} / \${stats.total} (remaining \${stats.remaining})</div>
            <div>Types</div><div>\${ttypes || '—'}</div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="secondary" data-action="refresh">Load check-ins</button>
            <button class="secondary" data-action="scanner">Open scanner</button>
          </div>
        \`;

        // attach button actions
        details.querySelector('[data-action="refresh"]').addEventListener('click', async (e) => {
          e.stopPropagation();
          try{
            const k2 = adminKey();
            const j = await fetchJSON('/admin/shows/' + show.id, { headers: { 'x-admin-key': k2 }});
            if (!j || !j.ok) throw new Error(j?.message || 'Failed to refresh');
            const s2 = j.stats || { checkedIn:0, remaining:0, total:0 };
            details.querySelector('.kv').children[7].innerHTML = \`\${s2.checkedIn} / \${s2.total} (remaining \${s2.remaining})\`;
            showToast('Stats refreshed');
          }catch(err){ showToast(String(err.message||err), false); }
        });

        details.querySelector('[data-action="scanner"]').addEventListener('click', (e) => {
          e.stopPropagation();
          const k3 = adminKey();
          const url = '/scan?k=' + encodeURIComponent(k3);
          window.open(url, '_blank');
        });

        details.style.display = '';
      }catch(e){
        showToast(String(e.message||e), false);
      }
    } else {
      // collapse
      details.style.display = 'none';
    }
  });

  return div;
}

document.getElementById('loadBtn').addEventListener('click', async () => {
  await loadVenues();
  await loadShows();
});
document.getElementById('openScanner').addEventListener('click', () => {
  try{
    const k = adminKey();
    window.open('/scan?k=' + encodeURIComponent(k), '_blank');
  }catch(e){ showToast(String(e.message||e), false); }
});
document.getElementById('createBtn').addEventListener('click', createShow);

// Prefill from ?k and auto-load once
if (document.getElementById('adminkey').value) {
  loadVenues().then(loadShows).catch(()=>{});
}
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
