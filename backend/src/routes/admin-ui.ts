// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;background:#0b0b10;color:#e8ebf7;font-family:system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  h1{margin:0 0 12px;font-size:22px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px;margin-bottom:14px}
  .row{display:flex;flex-wrap:wrap;gap:10px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 4px}
  input,select,textarea{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7}
  textarea{min-height:80px;resize:vertical}
  button{appearance:none;border:0;border-radius:10px;padding:10px 12px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .list{display:grid;gap:10px}
  .show{border:1px solid #22263a;border-radius:12px;padding:12px;background:#0f1220}
  .muted{color:#9aa0b5}
  .inline{display:flex;gap:8px;align-items:center}
  details{background:#141724;border:1px solid #22263a;border-radius:10px;padding:8px}
  summary{cursor:pointer;font-weight:700;margin:6px 0}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border-bottom:1px solid #22263a;padding:8px;text-align:left}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:700}
  .ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>
      <div class="grid">
        <div>
          <label>Admin Key</label>
          <input id="adminkey" type="text" placeholder="enter your admin key"/>
        </div>
        <div>
          <label>Actions</label>
          <div class="row">
            <button id="loadShows">Load latest shows</button>
            <button id="createShow">Create new show</button>
          </div>
        </div>
      </div>
    </div>

    <div id="shows" class="list"></div>
  </div>

  <div id="toast" class="toast hidden"></div>

<script>
  const api = {
    latest: (k, limit=20) => \`/admin/shows/latest?k=\${encodeURIComponent(k)}&limit=\${limit}\`,
    show: (id, k) => \`/admin/shows/\${id}?k=\${encodeURIComponent(k)}\`,
    patchShow: (id) => \`/admin/shows/\${id}\`,
    showTicketTypes: (id, k) => \`/admin/shows/\${id}/ticket-types?k=\${encodeURIComponent(k)}\`,
    postTicketType: (id) => \`/admin/shows/\${id}/ticket-types\`,
    patchTicketType: (id) => \`/admin/ticket-types/\${id}\`,
    deleteTicketType: (id) => \`/admin/ticket-types/\${id}\`,
  };

  const toast = document.getElementById('toast');
  function showToast(msg, ok=true) {
    toast.textContent = msg;
    toast.className = 'toast ' + (ok ? 'ok' : 'err');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000); // 5s
  }

  function val(id){ return document.getElementById(id).value.trim(); }

  function fmtDate(value){
    try {
      const d = new Date(value);
      return d.toLocaleString('en-GB', {weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch(e){ return value; }
  }

  async function fetchJSON(url, opts={}){
    const r = await fetch(url, opts);
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j?.error){ throw new Error(j?.message || 'Request failed'); }
    return j;
  }

  async function loadLatest(){
    const k = val('adminkey');
    if(!k){ showToast('Enter admin key', false); return; }
    try {
      const data = await fetchJSON(api.latest(k, 50));
      renderShows(data.shows || [], k);
      showToast('Loaded latest shows');
    } catch(e){ showToast(e.message || 'Failed to load shows', false); }
  }

  function renderShows(shows, k){
    const host = document.getElementById('shows');
    host.innerHTML = '';
    shows.forEach(s => {
      const el = document.createElement('div');
      el.className = 'show';
      el.innerHTML = \`
        <div class="inline" style="justify-content:space-between;">
          <div>
            <div><strong>\${s.title}</strong></div>
            <div class="muted">\${fmtDate(s.date)} — \${s.venue?.name || 'No venue'}</div>
            <div class="muted">Tickets: \${s._count?.tickets ?? 0} | Orders: \${s._count?.orders ?? 0}</div>
          </div>
          <div class="row">
            <a class="secondary" style="padding:8px 10px;border-radius:8px;background:#2a2f46;color:#e8ebf7;text-decoration:none" href="/scan?k=\${encodeURIComponent(k)}" target="_blank">Open Scanner</a>
          </div>
        </div>

        <details style="margin-top:8px">
          <summary>Edit show & ticket types</summary>

          <div class="grid" style="margin-top:10px">
            <div>
              <label>Title</label>
              <input id="title-\${s.id}" type="text" value="\${s.title}"/>

              <label>Date/Time (ISO or local)</label>
              <input id="date-\${s.id}" type="text" value="\${s.date}"/>

              <label>Description</label>
              <textarea id="desc-\${s.id}">\${s.description || ''}</textarea>
            </div>
            <div>
              <label>Venue</label>
              <div class="row">
                <input id="venueId-\${s.id}" type="text" placeholder="venueId" value="\${s.venue?.id || ''}"/>
                <a class="secondary" style="padding:10px 12px;border-radius:10px;background:#2a2f46;color:#e8ebf7;text-decoration:none" href="/admin/venues/ui?k=\${encodeURIComponent(k)}" target="_blank">Open Venues</a>
              </div>
              <label>Venue info</label>
              <div class="muted">\${s.venue?.name || ''} — \${[s.venue?.address, s.venue?.city, s.venue?.postcode].filter(Boolean).join(', ')}</div>

              <div class="row" style="margin-top:10px">
                <button id="save-\${s.id}">Save show</button>
                <button class="secondary" id="reload-\${s.id}">Reload</button>
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:12px">
            <div class="inline" style="justify-content:space-between;">
              <strong>Ticket Types</strong>
              <div class="inline">
                <input id="tt-name-\${s.id}" placeholder="Name (e.g. GA)"/>
                <input id="tt-price-\${s.id}" placeholder="Price (pence)" type="number" min="0"/>
                <input id="tt-avail-\${s.id}" placeholder="Available (blank = unlimited)" type="number" min="0"/>
                <button id="tt-add-\${s.id}">Add</button>
              </div>
            </div>
            <table id="tt-table-\${s.id}">
              <thead>
                <tr><th>Name</th><th>Price (p)</th><th>Available</th><th style="width:140px">Actions</th></tr>
              </thead>
              <tbody><tr><td colspan="4" class="muted">Loading…</td></tr></tbody>
            </table>
          </div>
        </details>
      \`;
      host.appendChild(el);

      // Wire handlers
      el.querySelector('#save-' + s.id).addEventListener('click', () => saveShow(s.id));
      el.querySelector('#reload-' + s.id).addEventListener('click', () => reloadShow(el, s.id));
      el.querySelector('#tt-add-' + s.id).addEventListener('click', () => addTicketType(s.id));

      // initial load of ticket types
      loadTicketTypes(s.id);
    });
  }

  async function reloadShow(container, showId){
    const k = val('adminkey');
    try {
      const j = await fetchJSON(api.show(showId, k));
      // Replace the segment by re-rendering just this show would be heavy.
      // Simpler: just refresh the whole list for now.
      await loadLatest();
      showToast('Show reloaded');
    } catch(e){ showToast(e.message || 'Failed to reload', false); }
  }

  async function saveShow(showId){
    const k = val('adminkey');
    if(!k){ showToast('Enter admin key', false); return; }

    const title = document.getElementById('title-' + showId).value.trim();
    const date = document.getElementById('date-' + showId).value.trim();
    const description = document.getElementById('desc-' + showId).value;
    const venueId = document.getElementById('venueId-' + showId).value.trim();

    try {
      const r = await fetchJSON(api.patchShow(showId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
        body: JSON.stringify({ title, date, description, venueId })
      });
      showToast('Show updated');
      await loadLatest();
    } catch(e){ showToast(e.message || 'Update failed', false); }
  }

  async function loadTicketTypes(showId){
    const k = val('adminkey');
    const tableBody = document.querySelector('#tt-table-' + showId + ' tbody');
    tableBody.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
    try {
      const data = await fetchJSON(api.showTicketTypes(showId, k));
      const list = data.ticketTypes || [];
      if(list.length === 0){
        tableBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet</td></tr>';
        return;
      }
      tableBody.innerHTML = '';
      list.forEach(tt => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><input id="ttn-\${tt.id}" value="\${tt.name}" /></td>
          <td><input id="ttp-\${tt.id}" type="number" min="0" value="\${tt.pricePence}" /></td>
          <td><input id="tta-\${tt.id}" type="number" min="0" value="\${tt.available ?? ''}" /></td>
          <td class="inline">
            <button class="secondary" data-act="save" data-id="\${tt.id}" data-show="\${showId}">Save</button>
            <button data-act="delete" data-id="\${tt.id}" data-show="\${showId}">Delete</button>
          </td>
        \`;
        tableBody.appendChild(tr);
      });

      tableBody.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const id = ev.currentTarget.getAttribute('data-id');
          const act = ev.currentTarget.getAttribute('data-act');
          const sid = ev.currentTarget.getAttribute('data-show');
          if(act === 'save') {
            await saveTicketType(id, sid);
          } else if (act === 'delete') {
            await deleteTicketType(id, sid);
          }
        });
      });
    } catch(e){ 
      tableBody.innerHTML = '<tr><td colspan="4" class="muted">Failed to load ticket types</td></tr>';
      showToast(e.message || 'Failed to load ticket types', false); 
    }
  }

  async function addTicketType(showId){
    const k = val('adminkey');
    if(!k){ showToast('Enter admin key', false); return; }
    const name = document.getElementById('tt-name-' + showId).value.trim();
    const pricePence = Number(document.getElementById('tt-price-' + showId).value.trim());
    const availableStr = document.getElementById('tt-avail-' + showId).value.trim();
    const available = availableStr === '' ? null : Number(availableStr);

    try {
      await fetchJSON(api.postTicketType(showId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
        body: JSON.stringify({ name, pricePence, available })
      });
      showToast('Ticket type added');
      document.getElementById('tt-name-' + showId).value = '';
      document.getElementById('tt-price-' + showId).value = '';
      document.getElementById('tt-avail-' + showId).value = '';
      await loadTicketTypes(showId);
    } catch(e){ showToast(e.message || 'Failed to add ticket type', false); }
  }

  async function saveTicketType(ttId, showId){
    const k = val('adminkey');
    if(!k){ showToast('Enter admin key', false); return; }
    const name = document.getElementById('ttn-' + ttId).value.trim();
    const pricePence = Number(document.getElementById('ttp-' + ttId).value.trim());
    const availStr = document.getElementById('tta-' + ttId).value.trim();
    const available = availStr === '' ? null : Number(availStr);

    try {
      await fetchJSON(api.patchTicketType(ttId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
        body: JSON.stringify({ name, pricePence, available })
      });
      showToast('Ticket type saved');
      await loadTicketTypes(showId);
    } catch(e){ showToast(e.message || 'Failed to save ticket type', false); }
  }

  async function deleteTicketType(ttId, showId){
    const k = val('adminkey');
    if(!k){ showToast('Enter admin key', false); return; }
    if(!confirm('Delete this ticket type?')) return;
    try {
      await fetchJSON(api.deleteTicketType(ttId), {
        method: 'DELETE',
        headers: { 'x-admin-key': k }
      });
      showToast('Ticket type deleted');
      await loadTicketTypes(showId);
    } catch(e){ showToast(e.message || 'Failed to delete ticket type', false); }
  }

  // Create show shortcut (opens your Create Show UI if present)
  document.getElementById('createShow').addEventListener('click', () => {
    const k = val('adminkey');
    const url = '/admin/create/ui' + (k ? ('?k=' + encodeURIComponent(k)) : '');
    window.open(url, '_blank');
  });

  document.getElementById('loadShows').addEventListener('click', loadLatest);

  // If ?k= present, prefill
  const params = new URLSearchParams(location.search);
  if(params.get('k')) document.getElementById('adminkey').value = params.get('k');

</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
