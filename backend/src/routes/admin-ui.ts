// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Lightweight Admin UI (no framework)
 * - Admin key input (saved to localStorage)
 * - Load venues into a <select>
 * - Create Show form (title, date/time, venue, capacity override, description, poster URL)
 * - Load latest shows list
 */
router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root{--bg:#f5f6fb;--panel:#ffffff;--ink:#0f172a;--muted:#6b7280;--brand:#2563eb;--ok:#16a34a;--err:#dc2626;--bd:#e5e7eb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;color:var(--ink)}
  .wrap{max-width:980px;margin:40px auto;padding:0 16px}
  .card{background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:16px 18px;box-shadow:0 2px 8px rgba(0,0,0,.04);margin-bottom:18px}
  h1{margin:0 0 10px;font-size:24px}
  h2{margin:8px 0 12px;font-size:18px}
  label{display:block;font-size:12px;color:var(--muted);margin:10px 0 6px}
  input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--bd);border-radius:10px;background:#fff;color:var(--ink)}
  textarea{min-height:90px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .row-3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px}
  .btn{appearance:none;border:0;border-radius:10px;padding:10px 14px;background:var(--brand);color:#fff;font-weight:600;cursor:pointer}
  .btn.secondary{background:#eef2ff;color:#1e3a8a;border:1px solid #c7d2fe}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .help{font-size:12px;color:var(--muted)}
  .list{display:flex;flex-direction:column;gap:10px}
  .tile{background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:10px 12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .toast{position:fixed;right:14px;bottom:14px;max-width:420px;padding:12px 14px;border-radius:12px;border:1px solid;display:none}
  .toast.ok{display:block;background:#ecfdf5;border-color:#059669;color:#064e3b}
  .toast.err{display:block;background:#fef2f2;border-color:#dc2626;color:#7f1d1d}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>
      <div class="row">
        <div>
          <label>Admin Key</label>
          <input id="adminkey" type="text" placeholder="enter your admin key"/>
          <div class="help">Shows load from /admin/shows/latest. Your key is sent as <code>x-admin-key</code>.</div>
        </div>
        <div style="display:flex;align-items:end;gap:8px">
          <button id="loadShowsBtn" class="btn">Load latest shows</button>
          <button id="saveKeyBtn" class="btn secondary">Save key</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Create Show</h2>
      <div class="row">
        <div>
          <label>Title</label>
          <input id="title" type="text" placeholder="e.g. Chuckl. Bridlington"/>
        </div>
        <div>
          <label>Date & Time</label>
          <input id="datetime" type="datetime-local"/>
        </div>
      </div>

      <div class="row-3">
        <div>
          <label>Venue</label>
          <select id="venue"></select>
        </div>
        <div>
          <label>Capacity Override (optional)</label>
          <input id="capOverride" type="number" min="1" placeholder="leave blank to use venue capacity"/>
        </div>
        <div>
          <label>Poster URL (optional)</label>
          <input id="posterUrl" type="url" placeholder="https://…"/>
        </div>
      </div>

      <label>Description (optional)</label>
      <textarea id="desc" placeholder="Short description…"></textarea>

      <div style="margin-top:12px;display:flex;gap:8px">
        <button id="createBtn" class="btn">Create Show</button>
        <button id="resetBtn" class="btn secondary">Reset</button>
      </div>
      <div class="help" id="venueHint" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <h2>Latest Shows</h2>
      <div id="shows" class="list"></div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

<script>
(function(){
  const els = {
    key: document.getElementById('adminkey'),
    saveKey: document.getElementById('saveKeyBtn'),
    loadShows: document.getElementById('loadShowsBtn'),
    venue: document.getElementById('venue'),
    venueHint: document.getElementById('venueHint'),
    title: document.getElementById('title'),
    dt: document.getElementById('datetime'),
    cap: document.getElementById('capOverride'),
    poster: document.getElementById('posterUrl'),
    desc: document.getElementById('desc'),
    create: document.getElementById('createBtn'),
    reset: document.getElementById('resetBtn'),
    shows: document.getElementById('shows'),
    toast: document.getElementById('toast')
  };

  function toast(msg, ok=true, ms=3000){
    els.toast.textContent = msg;
    els.toast.className = 'toast ' + (ok ? 'ok' : 'err');
    els.toast.style.display = 'block';
    setTimeout(()=> els.toast.style.display='none', ms);
  }

  function getKey(){
    const k = (els.key.value || '').trim();
    if(!k){ toast('Enter admin key', false); }
    return k;
  }

  function saveKey(){
    localStorage.setItem('chuckl_admin_key', els.key.value.trim());
    toast('Admin key saved');
  }

  async function api(path, options={}){
    const key = getKey();
    if(!key) throw new Error('No admin key');
    const headers = Object.assign({'x-admin-key': key}, options.headers||{});
    const url = path + (path.includes('?') ? '&' : '?') + 'k=' + encodeURIComponent(key);
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if(!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error('HTTP ' + res.status + ' ' + txt);
    }
    return res.json();
  }

  async function loadVenues(){
    try {
      const data = await api('/admin/venues');
      const list = Array.isArray(data?.venues) ? data.venues : [];
      els.venue.innerHTML = '<option value="">Select venue…</option>' + list.map(v => {
        const label = [v.name, v.city, v.postcode].filter(Boolean).join(', ');
        return '<option data-cap="'+(v.capacity ?? '')+'" value="'+v.id+'">'+label+'</option>';
      }).join('');
      els.venueHint.textContent = 'Loaded ' + list.length + ' venues.';
    } catch(e){
      console.error(e);
      toast('Failed to load venues', false);
    }
  }

  function updateCapacityHint(){
    const opt = els.venue.options[els.venue.selectedIndex];
    if(!opt || !opt.value){ els.venueHint.textContent=''; return; }
    const cap = opt.getAttribute('data-cap');
    els.venueHint.textContent = cap ? ('Venue capacity: ' + cap) : 'Venue capacity: unknown';
  }

  async function loadShows(){
    els.shows.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const data = await api('/admin/shows/latest?limit=20');
      const shows = Array.isArray(data?.shows) ? data.shows : [];
      if(!shows.length){ els.shows.innerHTML = '<div class="muted">No shows yet.</div>'; return; }
      els.shows.innerHTML = shows.map(s => {
        const when = new Date(s.date).toLocaleString('en-GB', {weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
        const venue = s.venue ? [s.venue.name, s.venue.city, s.venue.postcode].filter(Boolean).join(', ') : '';
        const types = (s.ticketTypes||[]).map(t => t.name + ' £' + (t.pricePence/100).toFixed(2) + (t.available ? ' ×'+t.available : '')).join(' • ');
        return '<div class="tile">' +
                 '<div class="title">'+ s.title +'</div>' +
                 '<div class="muted">'+ when + (venue ? ' · ' + venue : '') +'</div>' +
                 (types ? '<div class="muted">'+ types +'</div>' : '') +
               '</div>';
      }).join('');
    }catch(e){
      console.error(e);
      els.shows.innerHTML = '<div class="muted">Failed to load shows.</div>';
      toast('Failed to load shows', false);
    }
  }

  async function createShow(){
    const title = els.title.value.trim();
    const venueId = els.venue.value;
    const dt = els.dt.value;
    if(!title){ toast('Title required', false); return; }
    if(!venueId){ toast('Select a venue', false); return; }
    if(!dt){ toast('Pick date & time', false); return; }

    const capacityOverride = els.cap.value ? Number(els.cap.value) : undefined;
    const payload = {
      title,
      description: els.desc.value || undefined,
      date: new Date(dt).toISOString(),
      venueId,
      capacityOverride,
      posterUrl: els.poster.value || undefined
    };

    try{
      els.create.disabled = true;
      const data = await api('/admin/shows', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!data?.ok) throw new Error(data?.message || 'Unknown error');
      toast('Show created', true, 1800);
      els.title.value = '';
      els.desc.value = '';
      els.poster.value = '';
      els.cap.value = '';
      loadShows();
    }catch(e){
      console.error(e);
      toast('Create failed: ' + e.message, false);
    }finally{
      els.create.disabled = false;
    }
  }

  // Wire up
  els.saveKey.addEventListener('click', saveKey);
  els.loadShows.addEventListener('click', loadShows);
  els.create.addEventListener('click', createShow);
  els.reset.addEventListener('click', () => { els.title.value=''; els.desc.value=''; els.poster.value=''; els.cap.value=''; });
  els.venue.addEventListener('change', updateCapacityHint);

  // Boot
  const saved = localStorage.getItem('chuckl_admin_key');
  if(saved) els.key.value = saved;
  // Try preload venues & shows (only if key present)
  if(saved){ loadVenues(); loadShows(); }
})();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
