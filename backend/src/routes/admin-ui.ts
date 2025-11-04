// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  .h1{font-size:24px;font-weight:800;margin:0 0 16px}
  .row{display:flex;gap:16px;flex-wrap:wrap}
  .card{flex:1;min-width:320px;background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px}
  h2{font-size:16px;margin:0 0 12px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input,select,textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:14px}
  textarea{min-height:88px}
  button{appearance:none;border:0;border-radius:10px;padding:12px 14px;background:#4053ff;color:#fff;font-weight:700;cursor:pointer}
  .secondary{background:#2a2f46}
  .stack{display:flex;flex-direction:column;gap:10px}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
  th,td{padding:8px;border-bottom:1px solid #22263a;text-align:left;vertical-align:top}
  .k{color:#9aa0b5}
  .rowcols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  @media (max-width: 720px){ .rowcols{grid-template-columns:1fr} }
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:700}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
</style>
</head>
<body>
  <div class="wrap">
    <div class="h1">Chuckl. Admin</div>

    <div class="row">
      <div class="card" style="max-width:380px">
        <h2>Auth</h2>
        <label>Admin Key</label>
        <input id="adminkey" type="text" placeholder="x-admin-key"/>

        <div style="height:6px"></div>
        <button id="saveKey">Save Key</button>
      </div>

      <div class="card">
        <h2>Create Show</h2>
        <div class="rowcols">
          <div>
            <label>Title</label>
            <input id="title" type="text" placeholder="e.g. Chuckl. Retford – January Comedy Club"/>
          </div>
          <div>
            <label>Date & Time</label>
            <input id="date" type="datetime-local"/>
          </div>
          <div>
            <label>Venue</label>
            <select id="venue"></select>
          </div>
          <div>
            <label>Standard Ticket Price (£)</label>
            <input id="price" type="number" step="0.01" min="0" placeholder="23.00"/>
          </div>
          <div>
            <label>Manual Capacity Override (optional)</label>
            <input id="capacityOverride" type="number" min="0" placeholder="Leave blank to use venue capacity"/>
          </div>
          <div>
            <label>Header Image URL (temporary)</label>
            <input id="image" type="url" placeholder="https://…"/>
          </div>
        </div>

        <label>Description (optional)</label>
        <textarea id="description" placeholder="Short blurb. Image URL saved in description for now; will move to real column later."></textarea>

        <div style="height:10px"></div>
        <div class="row">
          <button id="createShowBtn">Create Show</button>
          <button id="reloadShowsBtn" class="secondary">Reload Shows</button>
        </div>
      </div>
    </div>

    <div style="height:16px"></div>

    <div class="row">
      <div class="card">
        <h2>Venues</h2>
        <div class="row">
          <button id="loadVenuesBtn" class="secondary">Load Venues</button>
        </div>
        <table id="venuesTbl">
          <thead>
            <tr><th>Name</th><th>Address</th><th>City</th><th>Postcode</th><th>Capacity</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <h2>Shows (latest)</h2>
        <table id="showsTbl">
          <thead>
            <tr><th>Title</th><th>Date</th><th>Venue</th><th>Price</th><th>Available</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

  </div>

  <div id="toast" class="toast hidden"></div>

<script>
  const toast = document.getElementById('toast');
  const adminkey = document.getElementById('adminkey');

  function showToast(msg, ok=true, ms=2200){
    toast.textContent = msg;
    toast.className = 'toast ' + (ok ? 'ok' : 'err');
    toast.classList.remove('hidden');
    setTimeout(()=> toast.classList.add('hidden'), ms);
  }

  function getKey(){ return (localStorage.getItem('adminKey') || '').trim(); }
  function setKey(v){ localStorage.setItem('adminKey', v || ''); }

  document.getElementById('saveKey').addEventListener('click', ()=>{
    setKey(adminkey.value.trim());
    showToast('Admin key saved.', true, 1600);
  });

  // --- Venues ---
  async function loadVenues(){
    try{
      const r = await fetch('/admin/venues/list', { headers: { 'x-admin-key': getKey() } });
      const j = await r.json();
      if(!j.ok) throw new Error(j.message || 'Failed to load venues');
      const sel = document.getElementById('venue');
      sel.innerHTML = '';
      (j.venues || []).forEach(v=>{
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name + (v.city ? ' – ' + v.city : '');
        opt.dataset.capacity = v.capacity || '';
        sel.appendChild(opt);
      });

      const tb = document.getElementById('venuesTbl').querySelector('tbody');
      tb.innerHTML = '';
      (j.venues || []).forEach(v=>{
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>'+ (v.name||'') +'</td>'
          + '<td>'+ (v.address||'') +'</td>'
          + '<td>'+ (v.city||'') +'</td>'
          + '<td>'+ (v.postcode||'') +'</td>'
          + '<td>'+ (v.capacity ?? '') +'</td>';
        tb.appendChild(tr);
      });

      showToast('Venues loaded.', true, 1200);
    }catch(e){ showToast(e.message || 'Error', false); }
  }

  document.getElementById('loadVenuesBtn').addEventListener('click', loadVenues);

  // --- Shows ---
  async function loadShows(){
    try{
      const r = await fetch('/admin/shows/list?limit=50', { headers: { 'x-admin-key': getKey() }});
      const j = await r.json();
      if(!j.ok) throw new Error(j.message || 'Failed to load shows');

      const tb = document.getElementById('showsTbl').querySelector('tbody');
      tb.innerHTML = '';
      (j.shows || []).forEach(s=>{
        const when = new Date(s.date).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' });
        const tt = (s.ticketTypes && s.ticketTypes[0]) ? s.ticketTypes[0] : null;
        const price = tt ? ('£' + (tt.pricePence/100).toFixed(2)) : '';
        const avail = tt && (tt.available!==null && tt.available!==undefined) ? tt.available : '';
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>'+ s.title +'</td>'
          + '<td>'+ when +'</td>'
          + '<td>'+ (s.venue?.name || '') +'</td>'
          + '<td>'+ price +'</td>'
          + '<td>'+ avail +'</td>';
        tb.appendChild(tr);
      });

      showToast('Shows loaded.', true, 1200);
    }catch(e){ showToast(e.message || 'Error', false); }
  }

  document.getElementById('reloadShowsBtn').addEventListener('click', loadShows);

  // --- Create Show ---
  async function createShow(){
    const key = getKey();
    if(!key){ showToast('Enter admin key first', false); return; }

    const title = document.getElementById('title').value.trim();
    const dateLocal = document.getElementById('date').value; // yyyy-MM-ddTHH:mm
    const venueId = document.getElementById('venue').value;
    const priceStr = document.getElementById('price').value;
    const capacityStr = document.getElementById('capacityOverride').value;
    const imageUrl = document.getElementById('image').value.trim();
    const description = document.getElementById('description').value;

    if(!title){ showToast('Title required', false); return; }
    if(!dateLocal){ showToast('Date required', false); return; }
    if(!venueId){ showToast('Venue required', false); return; }

    const pricePence = Math.round(parseFloat(priceStr||'0') * 100);
    const capacityOverride = capacityStr ? parseInt(capacityStr, 10) : null;

    // convert local datetime-local to ISO (assumes local timezone)
    const iso = new Date(dateLocal).toISOString();

    try{
      const r = await fetch('/admin/shows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ title, description, date: iso, venueId, pricePence, capacityOverride, imageUrl })
      });
      const j = await r.json();
      if(!j.ok) throw new Error(j.message || 'Failed to create show');

      showToast('Show created.', true, 1500);
      await loadShows();
    }catch(e){ showToast(e.message || 'Error', false); }
  }

  document.getElementById('createShowBtn').addEventListener('click', createShow);

  // Boot
  (function init(){
    adminkey.value = getKey();
    loadVenues();
    loadShows();
  })();
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
