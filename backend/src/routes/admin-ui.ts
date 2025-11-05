// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Admin UI:
 * - Admin key input (saved to localStorage)
 * - Load venues + latest shows
 * - Create Venue (inline form)
 * - Create Show (poster URL or optional upload if /admin/uploads/presign is configured)
 * - Click a show to expand details
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
  .tile{background:#f8fafc;border:1px solid var(--bd);border-radius:10px;padding:10px 12px;cursor:pointer}
  .tile:hover{background:#f1f5f9}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .details{margin-top:8px;padding-top:8px;border-top:1px dashed var(--bd);display:none}
  .toast{position:fixed;right:14px;bottom:14px;max-width:420px;padding:12px 14px;border-radius:12px;border:1px solid;display:none}
  .toast.ok{display:block;background:#ecfdf5;border-color:#059669;color:#064e3b}
  .toast.err{display:block;background:#fef2f2;border-color:#dc2626;color:#7f1d1d}
  .divider{height:1px;background:var(--bd);margin:12px 0}
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
          <div class="help">API calls send your key as <code>x-admin-key</code>.</div>
        </div>
        <div style="display:flex;align-items:end;gap:8px">
          <button id="saveKeyBtn" class="btn secondary">Save key</button>
          <button id="refreshAllBtn" class="btn">Load venues & shows</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Create Venue</h2>
      <div class="row">
        <div>
          <label>Venue Name</label>
          <input id="v_name" type="text" placeholder="e.g. The Forum Theatre"/>
        </div>
        <div>
          <label>Capacity (optional)</label>
          <input id="v_capacity" type="number" min="1" placeholder="e.g. 650"/>
        </div>
      </div>
      <div class="row">
        <div>
          <label>Address (line)</label>
          <input id="v_address" type="text" placeholder="e.g. 123 High Street"/>
        </div>
        <div>
          <label>City</label>
          <input id="v_city" type="text" placeholder="e.g. Malvern"/>
        </div>
      </div>
      <div class="row">
        <div>
          <label>Postcode</label>
          <input id="v_postcode" type="text" placeholder="e.g. WR14 3HB"/>
        </div>
        <div style="display:flex;align-items:end">
          <button id="createVenueBtn" class="btn">Create Venue</button>
        </div>
      </div>
      <div class="help" id="venueCreateHelp"></div>
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

      <div class="divider"></div>

      <label>Poster Image Upload (optional)</label>
      <input id="posterFile" type="file" accept="image/*"/>
      <div class="help">Uploads use a presigned S3 POST if configured. Otherwise, paste a Poster URL above.</div>

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
    refreshAll: document.getElementById('refreshAllBtn'),

    // create venue
    vName: document.getElementById('v_name'),
    vCap: document.getElementById('v_capacity'),
    vAddress: document.getElementById('v_address'),
    vCity: document.getElementById('v_city'),
    vPostcode: document.getElementById('v_postcode'),
    createVenue: document.getElementById('createVenueBtn'),
    venueCreateHelp: document.getElementById('venueCreateHelp'),

    // create show
    venue: document.getElementById('venue'),
    venueHint: document.getElementById('venueHint'),
    title: document.getElementById('title'),
    dt: document.getElementById('datetime'),
    cap: document.getElementById('capOverride'),
    posterUrl: document.getElementById('posterUrl'),
    posterFile: document.getElementById('posterFile'),
    desc: document.getElementById('desc'),
    create: document.getElementById('createBtn'),
    reset: document.getElementById('resetBtn'),

    // lists
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
    if(!k){ toast('Enter admin key', false, 2000); }
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
      els.venue.innerHTML = '<option value="">(Failed to load venues)</option>';
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
        return '<div class="tile" data-id="'+s.id+'">' +
                 '<div class="title">'+ s.title +'</div>' +
                 '<div class="muted">'+ when + (venue ? ' · ' + venue : '') +'</div>' +
                 (types ? '<div class="muted">'+ types +'</div>' : '') +
                 '<div class="details">' +
                   '<div class="muted">Tickets: '+ (s._count?.tickets ?? 0) +' · Orders: '+ (s._count?.orders ?? 0) +'</div>' +
                   '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
                     '<a class="btn secondary" href="/scan?show='+s.id+'" target="_blank">Open Scanner</a>' +
                     '<a class="btn secondary" href="/admin/ui" onclick="return false">More actions coming…</a>' +
                   '</div>' +
                 '</div>' +
               '</div>';
      }).join('');

      // expand/collapse
      Array.from(els.shows.querySelectorAll('.tile')).forEach(tile => {
        tile.addEventListener('click', (e) => {
          // don’t toggle if clicking a button/link inside
          if ((e.target as HTMLElement).closest('a,button')) return;
          const d = tile.querySelector('.details') as HTMLElement;
          d.style.display = d.style.display === 'block' ? 'none' : 'block';
        });
      });
    }catch(e){
      console.error(e);
      els.shows.innerHTML = '<div class="muted">Failed to load shows.</div>';
      toast('Failed to load shows', false);
    }
  }

  async function uploadPosterIfAny(): Promise<string|undefined>{
    const file = (els.posterFile as HTMLInputElement).files?.[0];
    if(!file) return undefined;

    try{
      // ask server for presigned POST (if available)
      const presign = await api('/admin/uploads/presign?kind=poster&ext=' + encodeURIComponent((file.name.split('.').pop()||'png')));
      if(!presign?.ok || !presign?.url || !presign?.fields) {
        toast('Uploads not configured — using Poster URL instead', false);
        return undefined;
      }
      const form = new FormData();
      Object.entries(presign.fields).forEach(([k,v]) => form.append(k, String(v)));
      form.append('file', file);
      const r = await fetch(presign.url, { method:'POST', body: form });
      if(!r.ok) throw new Error('Upload failed');
      return presign.publicUrl || presign.key || undefined;
    }catch(e){
      console.warn(e);
      toast('Upload failed — paste a Poster URL instead', false);
      return undefined;
    }
  }

  async function createVenue(){
    const name = els.vName.value.trim();
    const capacity = els.vCap.value ? Number(els.vCap.value) : undefined;
    const address = els.vAddress.value.trim() || undefined;
    const city = els.vCity.value.trim() || undefined;
    const postcode = els.vPostcode.value.trim() || undefined;
    if(!name){ toast('Venue name required', false); return; }

    try{
      els.createVenue.setAttribute('disabled','true');
      const data = await api('/admin/venues', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name, capacity, address, city, postcode })
      });
      if(!data?.ok) throw new Error(data?.message || 'Unknown error');
      els.venueCreateHelp.textContent = 'Venue created: ' + data.venue.name;
      // clear form
      els.vName.value=''; els.vCap.value=''; els.vAddress.value=''; els.vCity.value=''; els.vPostcode.value='';
      // refresh venue list
      await loadVenues();
    }catch(e){
      console.error(e);
      toast('Create venue failed: ' + e.message, false);
    }finally{
      els.createVenue.removeAttribute('disabled');
    }
  }

  async function createShow(){
    const title = els.title.value.trim();
    const venueId = els.venue.value;
    const dt = els.dt.value;
    if(!title){ toast('Title required', false); return; }
    if(!venueId){ toast('Select a venue', false); return; }
    if(!dt){ toast('Pick date & time', false); return; }

    // optional: upload image
    let poster = els.posterUrl.value.trim() || undefined;
    if(!poster){
      const uploaded = await uploadPosterIfAny();
      if(uploaded) poster = uploaded;
    }

    const capacityOverride = els.cap.value ? Number(els.cap.value) : undefined;
    const payload = {
      title,
      description: els.desc.value || undefined,
      date: new Date(dt).toISOString(),
      venueId,
      capacityOverride,
      posterUrl: poster
    };

    try{
      els.create.setAttribute('disabled','true');
      const data = await api('/admin/shows', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!data?.ok) throw new Error(data?.message || 'Unknown error');
      toast('Show created', true, 1800);
      els.title.value = '';
      els.desc.value = '';
      els.posterUrl.value = '';
      els.posterFile.value = '';
      els.cap.value = '';
      loadShows();
    }catch(e){
      console.error(e);
      toast('Create failed: ' + e.message, false);
    }finally{
      els.create.removeAttribute('disabled');
    }
  }

  // Wire up
  els.saveKey.addEventListener('click', saveKey);
  els.refreshAll.addEventListener('click', async () => { await loadVenues(); await loadShows(); });
  els.create.addEventListener('click', createShow);
  els.reset.addEventListener('click', () => { els.title.value=''; els.desc.value=''; els.posterUrl.value=''; els.posterFile.value=''; els.cap.value=''; });
  els.venue.addEventListener('change', updateCapacityHint);
  els.createVenue.addEventListener('click', createVenue);

  // Boot
  const saved = localStorage.getItem('chuckl_admin_key');
  if(saved) els.key.value = saved;
  if(saved){ loadVenues(); loadShows(); }
})();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
