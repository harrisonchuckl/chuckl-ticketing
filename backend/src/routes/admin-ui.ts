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
  :root { color-scheme: light; }
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;color:#0b1020}
  .wrap{max-width:1100px;margin:28px auto;padding:0 16px}
  .card{background:#fff;border:1px solid #e7e8f0;border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.04);padding:16px}
  h1{font-size:24px;margin:0 0 12px}
  label{display:block;font-size:12px;color:#606578;margin:10px 0 6px}
  input,select,textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d7d9e2;background:#fff;color:#0b1020;font-size:14px}
  textarea{min-height:92px}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  .row > *{flex:1}
  .btn{appearance:none;border:0;border-radius:10px;padding:10px 14px;background:#1976d2;color:#fff;font-weight:600;cursor:pointer}
  .btn.secondary{background:#eef1f6;color:#0b1020;border:1px solid #d7d9e2}
  .btn.warn{background:#e53935}
  .toolbar{display:flex;gap:10px;align-items:center;margin-top:12px}
  .list{margin-top:16px;display:flex;flex-direction:column;gap:10px}
  .item{background:#fff;border:1px solid #e7e8f0;border-radius:12px;padding:12px}
  .item h3{margin:0 0 6px;font-size:16px}
  .muted{color:#606578;font-size:12px}
  .toast{position:fixed;left:16px;right:16px;bottom:16px;padding:12px 14px;border-radius:10px;font-weight:600;border:1px solid}
  .toast.ok{background:#edf7ed;color:#145a32;border-color:#c7e6c8}
  .toast.err{background:#fdeaea;color:#7f1d1d;border-color:#f5c2c2}
  .hidden{display:none}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .divider{height:1px;background:#eceff5;margin:12px 0}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;background:#eef1f6;border:1px solid #d7d9e2;color:#0b1020;font-size:12px}
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
        </div>
        <div style="align-self:flex-end">
          <button id="loadBtn" class="btn">Load latest shows</button>
        </div>
      </div>
      <p class="muted">Shows load from <code>/admin/shows/latest</code> (limit 20). Your key is sent as <code>x-admin-key</code>.</p>
    </div>

    <!-- Create Show -->
    <div class="card" style="margin-top:12px">
      <h2 style="font-size:18px;margin:0 0 8px">Create Show</h2>
      <div class="grid">
        <div>
          <label>Title</label>
          <input id="cs_title" type="text" placeholder="e.g. Chuckl. Comedy Night"/>
        </div>
        <div>
          <label>Date & Time</label>
          <input id="cs_date" type="datetime-local"/>
        </div>
        <div>
          <label>Venue</label>
          <select id="cs_venue"></select>
        </div>
        <div>
          <label>Capacity Override (optional)</label>
          <input id="cs_capacity" type="number" placeholder="leave blank to use venue capacity"/>
        </div>
      </div>
      <label style="margin-top:10px">Description (optional)</label>
      <textarea id="cs_desc" placeholder="One-line blurb or leave empty"></textarea>

      <div class="row">
        <div>
          <label>Poster Image</label>
          <input id="cs_file" type="file" accept="image/*"/>
          <p class="muted">Uploads directly to S3 via a presigned POST.</p>
        </div>
        <div style="align-self:flex-end">
          <button id="cs_create" class="btn">Create Show</button>
        </div>
      </div>
    </div>

    <!-- Shows list -->
    <div class="card" style="margin-top:12px">
      <h2 style="font-size:18px;margin:0 0 8px">Latest Shows</h2>
      <div id="shows" class="list"></div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

<script>
const keyEl = document.getElementById('adminkey');
const loadBtn = document.getElementById('loadBtn');
const showsEl = document.getElementById('shows');
const toast = document.getElementById('toast');

// Create show elements
const cs_title = document.getElementById('cs_title');
const cs_date = document.getElementById('cs_date');
const cs_venue = document.getElementById('cs_venue');
const cs_capacity = document.getElementById('cs_capacity');
const cs_desc = document.getElementById('cs_desc');
const cs_file = document.getElementById('cs_file');
const cs_create = document.getElementById('cs_create');

function showToast(msg, ok=true, ms=2600) {
  toast.textContent = msg;
  toast.className = 'toast ' + (ok ? 'ok' : 'err');
  toast.classList.remove('hidden');
  setTimeout(()=> toast.classList.add('hidden'), ms);
}

// Helpers
async function fetchJSON(url, opts={}) {
  const key = keyEl.value.trim();
  const headers = Object.assign({ 'x-admin-key': key }, (opts.headers||{}));
  const r = await fetch(url, Object.assign({}, opts, { headers }));
  if (!r.ok) throw new Error((await r.text()) || ('HTTP ' + r.status));
  return r.json();
}

// Populate venues
async function loadVenues() {
  try {
    const r = await fetchJSON('/admin/venues');
    const venues = r.venues || [];
    cs_venue.innerHTML = venues.map(v => 
      '<option value="'+v.id+'">'+(v.name || 'Untitled')+(v.capacity ? ' ('+v.capacity+')':'')+'</option>'
    ).join('');
  } catch(e) {
    showToast('Failed to load venues: ' + e.message, false);
  }
}

// Load shows
async function loadShows() {
  try {
    const r = await fetchJSON('/admin/shows/latest?limit=20');
    const list = r.shows || [];
    showsEl.innerHTML = list.map(itemHTML).join('');
    // attach handlers
    list.forEach(s => attachRowHandlers(s.id));
  } catch(e) {
    showToast('Failed to load shows: ' + e.message, false);
  }
}

// Single show row
function itemHTML(s) {
  const dateStr = new Date(s.date).toLocaleString('en-GB');
  const vn = s.venue ? (s.venue.name || 'Untitled venue') : 'No venue';
  const tt = (s.ticketTypes||[]).map(t => 
    '<span class="badge">'+t.name+': £'+(t.pricePence/100).toFixed(2)+(t.available!=null?(' • avail '+t.available):'')+'</span>'
  ).join(' ');
  return \`
    <div class="item" id="row-\${s.id}">
      <h3>\${s.title}</h3>
      <div class="muted">\${dateStr} • \${vn}</div>
      <div style="margin-top:8px">\${tt || '<span class="muted">No ticket types yet</span>'}</div>
      <div class="toolbar">
        <button class="btn secondary" data-edit="\${s.id}">Edit</button>
        <button class="btn warn" data-del="\${s.id}">Delete</button>
        <button class="btn secondary" data-stats="\${s.id}">Pre-show stats</button>
        <button class="btn secondary" data-tt="\${s.id}">Manage ticket types</button>
      </div>
      <div class="divider"></div>
      <div id="panel-\${s.id}" class="muted"></div>
    </div>\`;
}

function attachRowHandlers(id) {
  const row = document.getElementById('row-'+id);
  row.querySelector('[data-edit]').addEventListener('click', ()=> openEdit(id));
  row.querySelector('[data-del]').addEventListener('click', ()=> delShow(id));
  row.querySelector('[data-stats]').addEventListener('click', ()=> loadStats(id));
  row.querySelector('[data-tt]').addEventListener('click', ()=> manageTT(id));
}

// Delete
async function delShow(id){
  if(!confirm('Delete this show?')) return;
  try {
    await fetchJSON('/admin/shows/'+id, { method:'DELETE' });
    showToast('Deleted');
    await loadShows();
  } catch(e){ showToast(e.message, false); }
}

// Edit panel (title, date, venue, capacity override, imageUrl)
function openEdit(id){
  const panel = document.getElementById('panel-'+id);
  panel.innerHTML = \`
    <div class="grid">
      <div><label>Title</label><input id="e_title-\${id}" type="text"/></div>
      <div><label>Date & Time</label><input id="e_date-\${id}" type="datetime-local"/></div>
      <div><label>Venue</label><select id="e_venue-\${id}"></select></div>
      <div><label>Capacity Override</label><input id="e_cap-\${id}" type="number"/></div>
    </div>
    <div class="row" style="margin-top:8px">
      <div>
        <label>Poster Image</label>
        <input id="e_file-\${id}" type="file" accept="image/*"/>
      </div>
      <div style="align-self:flex-end">
        <button class="btn" id="e_save-\${id}">Save changes</button>
      </div>
    </div>\`;

  // preload venues
  fetchJSON('/admin/venues').then(r=>{
    const s = document.getElementById('e_venue-'+id);
    s.innerHTML = (r.venues||[]).map(v => '<option value="'+v.id+'">'+v.name+'</option>').join('');
  });

  document.getElementById('e_save-'+id).addEventListener('click', async ()=>{
    try{
      let imageUrl = null;
      const f = (document.getElementById('e_file-'+id) as HTMLInputElement).files?.[0];
      if(f){
        imageUrl = await uploadToS3(f);
      }
      const payload:any = {
        title: (document.getElementById('e_title-'+id) as HTMLInputElement).value || undefined,
        dateISO: (document.getElementById('e_date-'+id) as HTMLInputElement).value || undefined,
        venueId: (document.getElementById('e_venue-'+id) as HTMLSelectElement).value || undefined,
        capacityOverride: Number((document.getElementById('e_cap-'+id) as HTMLInputElement).value) || undefined,
        imageUrl: imageUrl || undefined
      };
      await fetchJSON('/admin/shows/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      showToast('Saved');
      await loadShows();
    }catch(e){ showToast(e.message, false); }
  });
}

// Stats
async function loadStats(id){
  try{
    const r = await fetchJSON('/admin/shows/'+id+'/stats');
    const panel = document.getElementById('panel-'+id);
    panel.innerHTML = '<div>Total: <b>'+r.total+
      '</b> • Checked-in: <b>'+r.checkedIn+
      '</b> • Remaining: <b>'+r.remaining+'</b></div>';
  }catch(e){ showToast(e.message, false); }
}

// Ticket types manager
async function manageTT(id){
  const panel = document.getElementById('panel-'+id);
  panel.innerHTML = '<div class="muted">Loading ticket types…</div>';
  try{
    const r = await fetchJSON('/admin/shows/'+id+'/ticket-types');
    const list = r.ticketTypes || [];
    panel.innerHTML = \`
      <div>\${list.map(tt=> \`
        <div class="row" style="margin-bottom:8px">
          <input id="tt-name-\${tt.id}" value="\${tt.name}"/>
          <input id="tt-price-\${tt.id}" type="number" value="\${tt.pricePence}"/>
          <input id="tt-avail-\${tt.id}" type="number" value="\${tt.available ?? ''}" placeholder="available"/>
          <button class="btn secondary" data-ttsave="\${tt.id}">Save</button>
          <button class="btn warn" data-ttdel="\${tt.id}">Delete</button>
        </div>\`).join('')}
      </div>
      <div class="divider"></div>
      <div class="row">
        <input id="tt-new-name-\${id}" placeholder="Name e.g. General Admission"/>
        <input id="tt-new-price-\${id}" type="number" placeholder="price in pence e.g. 2000"/>
        <input id="tt-new-avail-\${id}" type="number" placeholder="available (optional)"/>
        <button class="btn" data-ttadd="\${id}">Add</button>
      </div>\`;

    // bind save/delete
    list.forEach(tt=>{
      panel.querySelector('[data-ttsave="'+tt.id+'"]').addEventListener('click', async ()=>{
        try{
          const payload = {
            name: (document.getElementById('tt-name-'+tt.id) as HTMLInputElement).value,
            pricePence: Number((document.getElementById('tt-price-'+tt.id) as HTMLInputElement).value),
            available: (document.getElementById('tt-avail-'+tt.id) as HTMLInputElement).value === '' ? null :
              Number((document.getElementById('tt-avail-'+tt.id) as HTMLInputElement).value)
          };
          await fetchJSON('/admin/ticket-types/'+tt.id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          showToast('Ticket type updated');
          manageTT(id);
        }catch(e){ showToast(e.message, false); }
      });
      panel.querySelector('[data-ttdel="'+tt.id+'"]').addEventListener('click', async ()=>{
        if(!confirm('Delete ticket type?')) return;
        try{
          await fetchJSON('/admin/ticket-types/'+tt.id, { method:'DELETE' });
          showToast('Deleted ticket type');
          manageTT(id);
        }catch(e){ showToast(e.message, false); }
      });
    });

    // add new
    panel.querySelector('[data-ttadd="'+id+'"]').addEventListener('click', async ()=>{
      try{
        const payload = {
          name: (document.getElementById('tt-new-name-'+id) as HTMLInputElement).value,
          pricePence: Number((document.getElementById('tt-new-price-'+id) as HTMLInputElement).value),
          available: (document.getElementById('tt-new-avail-'+id) as HTMLInputElement).value === '' ? null :
            Number((document.getElementById('tt-new-avail-'+id) as HTMLInputElement).value)
        };
        await fetchJSON('/admin/shows/'+id+'/ticket-types', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        showToast('Added ticket type');
        manageTT(id);
      }catch(e){ showToast(e.message, false); }
    });

  }catch(e){ showToast(e.message, false); }
}

// S3 direct upload helper
async function uploadToS3(file){
  // Ask backend for a presigned POST
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const presign = await fetchJSON('/admin/uploads/presign?ext='+encodeURIComponent(ext), { method:'POST' });
  const { url, fields, publicUrl } = presign;

  const fd = new FormData();
  Object.entries(fields).forEach(([k,v]) => fd.append(k, v as any));
  fd.append('file', file);

  const r = await fetch(url, { method:'POST', body: fd });
  if (r.status !== 204) {
    throw new Error('S3 upload failed: HTTP ' + r.status);
  }
  return publicUrl; // Return the final public URL to store on the show
}

// On create show
cs_create.addEventListener('click', async ()=>{
  try{
    let imageUrl = null;
    const f = cs_file.files?.[0];
    if (f) imageUrl = await uploadToS3(f);

    const payload = {
      title: cs_title.value.trim(),
      description: cs_desc.value.trim() || null,
      dateISO: cs_date.value,
      venueId: cs_venue.value,
      capacityOverride: cs_capacity.value ? Number(cs_capacity.value) : null,
      imageUrl
    };
    await fetchJSON('/admin/shows', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    showToast('Show created');
    cs_title.value = ''; cs_desc.value = ''; cs_date.value = ''; cs_capacity.value = ''; cs_file.value='';
    await loadShows();
  }catch(e){ showToast(e.message, false); }
});

loadBtn.addEventListener('click', loadShows);

// Load venues once (so the Create Show selector is ready)
loadVenues();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
