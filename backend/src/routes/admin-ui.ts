// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

router.get('/ui', requireAdminOrOrganiser, async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Organiser Console</title>
<style>
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280}
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none;cursor:pointer}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .caret{font-size:12px;color:#64748b;transition:transform .15s ease}
  .caret.rotate{transform:rotate(90deg)}
  .submenu{margin-left:8px;border-left:1px dashed #e5e7eb;padding-left:6px;display:none}
  .submenu.open{display:block}
  .submenu a{display:block;padding:8px 10px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
  .submenu a.active,.submenu a:hover{background:#f1f5f9}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none;width:100%}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  /* venue typeahead */
  .suggest{margin-top:6px}
  .sug-item{padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin:6px 0;display:flex;align-items:center;justify-content:space-between}
  .sug-item:hover{background:#f9fafb}
  .pill{font-size:12px;color:#64748b}
  /* modal */
  .modal-back{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:50}
  .modal-back.show{display:flex}
  .modal{width:min(680px,92vw);background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px}
  .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" href="#home" data-view="home"><span>Home</span></a>

    <div class="sb-group">Manage</div>
    <!-- Shows (collapsible parent) -->
    <a class="sb-link" data-toggle="shows">
      <span>Shows</span>
      <span class="caret">▶</span>
    </a>
    <div class="submenu" id="shows-sub">
      <a href="#shows/create" data-view="shows/create">Create Show</a>
      <a href="#shows/all" data-view="shows/all">All Events</a>
    </div>

    <a class="sb-link" href="#orders" data-view="orders"><span>Orders</span></a>
    <a class="sb-link" href="#venues" data-view="venues"><span>Venues</span></a>

    <div class="sb-group">Insights</div>
    <a class="sb-link" href="#analytics" data-view="analytics"><span>Analytics</span></a>

    <div class="sb-group">Marketing</div>
    <a class="sb-link" href="#audiences" data-view="audiences"><span>Audiences</span></a>
    <a class="sb-link" href="#email" data-view="email"><span>Email Campaigns</span></a>

    <div class="sb-group">Settings</div>
    <a class="sb-link" href="#account" data-view="account"><span>Account</span></a>
    <a class="sb-link" href="/auth/logout"><span>Log out</span></a>
  </aside>

  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<!-- Venue Create Modal -->
<div class="modal-back" id="venueModalBack">
  <div class="modal">
    <div class="modal-header">
      <div class="title">Create venue</div>
      <button id="venueX" class="btn">×</button>
    </div>
    <div class="grid grid-2" style="margin-bottom:8px">
      <div class="grid"><label>Name</label><input id="vn_name" placeholder="e.g. Everyman Theatre"/></div>
      <div class="grid"><label>City / Town</label><input id="vn_city" placeholder="Cheltenham"/></div>
      <div class="grid"><label>Address</label><input id="vn_address" placeholder="Street, area"/></div>
      <div class="grid"><label>Postcode</label><input id="vn_postcode" placeholder="e.g. GL50 1HQ"/></div>
      <div class="grid"><label>Capacity (optional)</label><input id="vn_capacity" type="number" placeholder="e.g. 650"/></div>
      <div class="grid"><label>Phone (optional)</label><input id="vn_phone" placeholder=""/></div>
      <div class="grid"><label>Website (optional)</label><input id="vn_website" placeholder="https://"/></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="venueCancel" class="btn">Cancel</button>
      <button id="venueSave" class="btn">Save venue</button>
    </div>
    <div id="venueErr" class="error" style="margin-top:8px"></div>
  </div>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const main = $('#main');

  function setActive(hash){
    const view = hash.replace(/^#/, '');
    $$('.sb-link').forEach(a => {
      const v = a.getAttribute('data-view');
      a.classList.toggle('active', v && (v === view));
    });
    // submenu items
    $$('#shows-sub a').forEach(a => {
      const v = a.getAttribute('data-view');
      a.classList.toggle('active', v === view);
    });
    // Open submenu if we're on any shows/*
    const caret = document.querySelector('[data-toggle="shows"] .caret');
    const sub = $('#shows-sub');
    const showsOpen = view.startsWith('shows/');
    sub.classList.toggle('open', showsOpen);
    caret && caret.classList.toggle('rotate', showsOpen);
  }

  function setMain(html){ main.innerHTML = html; }

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){
      const text = await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(text?(': '+text.slice(0,200)):''));
    }
    return r.json();
  }

  // ---- Upload helper -> /api/upload ----
  async function uploadPoster(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(\`Upload failed (\${res.status}): \${text.slice(0,300)}\`);
    }
    const data = await res.json().catch(async () => {
      const text = await res.text().catch(()=> '');
      throw new Error(\`Non-JSON response: \${text.slice(0,300)}\`);
    });
    if (!data?.ok) throw new Error(data?.error || "Unknown upload error");
    return data; // { ok, key, url }
  }

  // ---- ROUTER ----
  function route(){
    const hash = location.hash || '#home';
    const view = hash.replace(/^#/, '');
    setActive(hash);
    if (view === 'home') return home();
    if (view === 'venues') return venues();
    if (view === 'orders') return orders();
    if (view === 'analytics') return analytics();
    if (view === 'audiences') return audiences();
    if (view === 'email') return email();
    if (view === 'account') return account();
    if (view === 'shows/create') return showsCreate();
    if (view === 'shows/all') return showsList();
    // default
    return home();
  }
  window.addEventListener('hashchange', route);

  // ---- Sidebar toggles ----
  document.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-toggle="shows"]');
    if(t){
      e.preventDefault();
      $('#shows-sub').classList.toggle('open');
      t.querySelector('.caret')?.classList.toggle('rotate');
    }
  });

  // ---- Views ----
  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  async function showsCreate(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>

        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid">
            <label>Title</label>
            <input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/>
          </div>
          <div class="grid">
            <label>Date & time</label>
            <input id="sh_dt" type="datetime-local"/>
          </div>

          <!-- Venue: text input with type-ahead; same width as Title (left column) -->
          <div class="grid">
            <label>Venue</label>
            <input id="venue_input" placeholder="Start typing a venue…"/>
            <div class="muted" style="font-size:12px;margin-top:6px">Pick an existing venue or create a new one.</div>
            <div id="venue_suggest" class="suggest"></div>
            <input id="sh_venue_id" type="hidden"/>
          </div>

          <!-- Poster -->
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div id="previewRow" style="margin-top:8px;display:none;align-items:center;gap:12px">
              <img id="prev" class="imgprev" alt="Poster preview"/>
              <button id="rmImg" class="btn">Remove</button>
            </div>
          </div>

          <div class="grid" style="grid-column:1/-1">
            <label>Description (optional)</label>
            <textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea>
          </div>
        </div>

        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" placeholder="General Admission" value="General Admission"/></div>
          <div class="grid"><label>Price (£)</label><input id="t_price" type="number" step="0.01" placeholder="25.00"/></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300"/></div>
        </div>

        <div class="row" style="display:flex;gap:8px;align-items:center">
          <button id="create" class="btn">Create show</button>
          <div id="err" class="error"></div>
        </div>
      </div>
    \`);

    // ---- Venue type-ahead ----
    let venuesCache = [];
    try {
      const vj = await j('/admin/venues'); // expects {items:[{id,name,city,...}]}
      venuesCache = vj.items || [];
    } catch {}

    const vInput = $('#venue_input');
    const vSug = $('#venue_suggest');
    const vHidden = $('#sh_venue_id');

    function renderSugs(list, typed){
      vSug.innerHTML = '';
      if(typed && !list.length){
        vSug.innerHTML = \`
          <div class="sug-item">
            <span>Create "<b>\${typed}</b>" as a new venue</span>
            <button id="btnOpenVenue" class="btn">Create venue</button>
          </div>\`;
        $('#btnOpenVenue')?.addEventListener('click', () => openVenueModal(typed));
        return;
      }
      list.slice(0,6).forEach(v=>{
        const item = document.createElement('div');
        item.className='sug-item';
        item.innerHTML=\`<div>\${v.name}\${v.city? ' – <span class="pill">'+v.city+'</span>':''}</div><button class="btn">Select</button>\`;
        item.querySelector('button')!.addEventListener('click', ()=>{
          vInput.value = v.name + (v.city? ' – '+v.city:'');
          vHidden.value = v.id;
          vSug.innerHTML='';
        });
        vSug.appendChild(item);
      });
      if(typed){
        const exists = list.some(v => (v.name||'').toLowerCase() === typed.toLowerCase());
        if(!exists){
          const add = document.createElement('div');
          add.className='sug-item';
          add.innerHTML=\`<span>Create "<b>\${typed}</b>" as a new venue</span><button class="btn">Create venue</button>\`;
          add.querySelector('button')!.addEventListener('click', () => openVenueModal(typed));
          vSug.appendChild(add);
        }
      }
    }

    function filterVenues(q){
      const t = (q||'').trim().toLowerCase();
      if(!t){ vSug.innerHTML=''; return; }
      const list = venuesCache.filter(v=>{
        const s = ((v.name||'') + ' ' + (v.city||'')).toLowerCase();
        return s.includes(t);
      });
      renderSugs(list, q.trim());
    }

    let vDeb;
    vInput.addEventListener('input', ()=>{
      vHidden.value = ''; // reset selected id if text changes
      clearTimeout(vDeb);
      const val = vInput.value;
      vDeb = setTimeout(()=> filterVenues(val), 120);
    });

    // ---- Poster upload preview ----
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), row=$('#previewRow');
    let posterUrl = '';

    function choose(){ file.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{
      const f = file.files && file.files[0];
      if(f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out = await uploadPoster(f);
        posterUrl = out.url;
        prev.src = out.url;
        row.style.display='flex';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%', 600);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent = e.message || 'Upload failed';
      }
    }

    $('#rmImg').addEventListener('click', ()=>{
      posterUrl = '';
      prev.src='';
      row.style.display='none';
    });

    // ---- Create show ----
    $('#create').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const venueId = vHidden.value || null;
        if(!venueId){
          $('#err').textContent = 'Please choose a venue from suggestions or create it first.';
          return;
        }
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId,
          imageUrl: posterUrl || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim() || 'General Admission',
            pricePounds: $('#t_price').value ? Number($('#t_price').value) : null,
            available: $('#t_alloc').value ? Number($('#t_alloc').value) : null
          }
        };
        if(!payload.title || !payload.date){
          $('#err').textContent='Title and date/time are required';
          return;
        }
        const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r.ok) throw new Error(r.error||'Failed to create show');
        // reset
        ['sh_title','sh_dt','sh_desc','t_name','t_price','t_alloc','venue_input','sh_venue_id'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        posterUrl=''; prev.src=''; row.style.display='none';
        alert('Show created.');
      }catch(e){
        $('#err').textContent=e.message||'Failed to create show';
      }
    });
  }

  async function showsList(){
    setMain(\`
      <div class="card">
        <div class="header">
          <div class="title">All Events</div>
          <button id="refresh" class="btn">Refresh</button>
        </div>
        <table>
          <thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
        <div id="lerr" class="error" style="margin-top:8px"></div>
      </div>
    \`);
    async function loadList(){
      try{
        $('#lerr').textContent='';
        const jn = await j('/admin/shows');
        const tb = $('#tbody');
        tb.innerHTML = (jn.items||[]).map(s=>\`
          <tr>
            <td>\${s.title}</td>
            <td>\${new Date(s.date).toLocaleString()}</td>
            <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : ''}</td>
            <td>\${s._count?.ticketTypes ?? 0}</td>
            <td>\${s._count?.orders ?? 0}</td>
          </tr>\`).join('');
      }catch(_e){
        $('#lerr').textContent='Failed to load shows';
      }
    }
    $('#refresh').addEventListener('click', loadList);
    loadList();
  }

  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the Venues tab (already implemented) to add/search venues.</div></div>'); }
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export are available in Orders view.</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'); }
  function account(){ setMain('<div class="card"><div class="title">Account</div><div>Manage your login and security (coming soon).</div></div>'); }

  // ---- Modal helpers ----
  function openVenueModal(prefillName){
    $('#venueErr').textContent='';
    if(prefillName) $('#vn_name').value = prefillName;
    $('#venueModalBack').classList.add('show');
  }
  function closeVenueModal(){
    $('#venueModalBack').classList.remove('show');
  }
  $('#venueX').addEventListener('click', closeVenueModal);
  $('#venueCancel').addEventListener('click', closeVenueModal);

  $('#venueSave').addEventListener('click', async ()=>{
    const name = $('#vn_name').value.trim();
    const city = $('#vn_city').value.trim();
    const address = $('#vn_address').value.trim();
    const postcode = $('#vn_postcode').value.trim();
    const capacity = $('#vn_capacity').value ? Number($('#vn_capacity').value) : null;
    const phone = $('#vn_phone').value.trim() || null;
    const website = $('#vn_website').value.trim() || null;

    if(!name || !city || !address || !postcode){
      $('#venueErr').textContent = 'Name, City, Address and Postcode are required.';
      return;
    }
    try{
      const r = await j('/admin/venues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, city, address, postcode, capacity, phone, website })
      });
      if(!r.ok) throw new Error(r.error || 'Failed to create venue');

      // Put the new venue into the current form
      const vInput = $('#venue_input'), vHidden = $('#sh_venue_id');
      vInput && (vInput.value = r.item.name + (r.item.city ? ' – ' + r.item.city : ''));
      vHidden && (vHidden.value = r.item.id);

      closeVenueModal();
      alert('Venue saved.');
    }catch(e){
      $('#venueErr').textContent = e.message || 'Failed to save venue';
    }
  });

  // initial route
  // default to shows/create when user clicks parent "Shows"
  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a[href^="#"]');
    if(a && a.getAttribute('href')){
      // normal hash routing
    }
  });

  // If user lands on "#shows" exactly, switch to create by default
  if (location.hash === '#shows') location.hash = '#shows/create';

  route();
})();
</script>
</body>
</html>`);
});

export default router;
