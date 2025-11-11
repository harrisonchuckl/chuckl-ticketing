// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// Serve UI for /admin/ui and any nested route (deep-link friendly)
router.get(['/ui', '/ui/*'], requireAdminOrOrganiser, async (_req, res) => {
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
  .sb-link:hover,.sb-link.active{background:#f1f5f9}
  .chev{margin-left:8px;transition:transform .15s ease}
  .chev.rotate{transform:rotate(90deg)}
  .submenu{margin:2px 0 8px 8px;display:none}
  .submenu.open{display:block}
  .submenu a{display:block;padding:8px 10px;margin:2px 8px;border-radius:8px;color:#111827;text-decoration:none}
  .submenu a:hover,.submenu a.active{background:#f1f5f9}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .btn.pri{background:#111827;color:#fff;border-color:#111827}
  .btn.pri:hover{opacity:.92}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  input[type="datetime-local"]{padding-right:6px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .ok{color:#15803d}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .row{display:flex;gap:8px;align-items:center}
  .pill{background:#f1f5f9;border:1px solid var(--border);padding:2px 8px;border-radius:999px;font-size:12px}
  .typeahead{position:relative}
  .ta-list{position:absolute;left:0;right:0;top:100%;z-index:10;background:#fff;border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;max-height:220px;overflow:auto;display:none}
  .ta-item{padding:8px 10px;border-top:1px solid var(--border);cursor:pointer}
  .ta-item:hover{background:#f8fafc}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  /* modal */
  .modal-back{position:fixed;inset:0;background:rgba(15,23,42,.35);display:none;align-items:center;justify-content:center;z-index:50}
  .modal{background:#fff;border:1px solid var(--border);border-radius:12px;max-width:640px;width:92%;padding:14px}
  .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .disabled{opacity:.55;pointer-events:none}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" data-route="/admin/ui/home"><span>Home</span></a>

    <div class="sb-group">Manage</div>
    <div class="sb-link" id="showsToggle"><span>Shows</span><span class="chev">▶</span></div>
    <div class="submenu" id="showsMenu">
      <a data-route="/admin/ui/shows/create">Add tickets</a>
      <a data-route="/admin/ui/shows/current">All events</a>
    </div>
    <a class="sb-link" data-route="/admin/ui/orders"><span>Orders</span></a>
    <a class="sb-link" data-route="/admin/ui/venues"><span>Venues</span></a>

    <div class="sb-group">Insights</div>
    <a class="sb-link" data-route="/admin/ui/analytics"><span>Analytics</span></a>

    <div class="sb-group">Marketing</div>
    <a class="sb-link" data-route="/admin/ui/audiences"><span>Audiences</span></a>
    <a class="sb-link" data-route="/admin/ui/email"><span>Email Campaigns</span></a>

    <div class="sb-group">Settings</div>
    <a class="sb-link" data-route="/admin/ui/account"><span>Account</span></a>
    <a class="sb-link" href="/auth/logout">Log out</a>
  </aside>

  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<!-- Modal: Create Venue -->
<div class="modal-back" id="venueModalBack" aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="venueModalTitle">
    <div class="modal-header">
      <div class="title" id="venueModalTitle">Create venue</div>
      <button class="btn" id="venueModalClose">✕</button>
    </div>
    <div class="grid grid-2" style="margin-bottom:8px">
      <div class="grid"><label>Name</label><input id="vm_name"/></div>
      <div class="grid"><label>City / Town</label><input id="vm_city"/></div>
      <div class="grid"><label>Address</label><input id="vm_addr" placeholder="Street & number"/></div>
      <div class="grid"><label>Postcode</label><input id="vm_pc" placeholder="e.g. SW1A 1AA"/></div>
      <div class="grid"><label>Capacity (optional)</label><input id="vm_cap" type="number"/></div>
      <div class="grid"><label>Phone (optional)</label><input id="vm_phone"/></div>
      <div class="grid"><label>Website (optional)</label><input id="vm_www" placeholder="https://…"/></div>
    </div>
    <div class="row" style="justify-content:flex-end">
      <button class="btn" id="venueModalCancel">Cancel</button>
      <button class="btn" id="venueModalSave">Save venue</button>
      <div id="vm_err" class="error" style="margin-left:8px"></div>
    </div>
  </div>
</div>

<script>
(function(){
  const BASE = '/admin/ui';

  // ---------- helpers ----------
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function setMain(html){ $('#main').innerHTML=html; }

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){ const t=await r.text().catch(()=> ''); throw new Error('HTTP '+r.status+(t?(': '+t.slice(0,200)):'')); }
    return r.json();
  }

  // Upload helper
  async function uploadPoster(file){
    const form=new FormData(); form.append('file',file);
    const res=await fetch('/api/upload',{method:'POST',body:form,credentials:'include'});
    if(!res.ok){ const t=await res.text(); throw new Error('Upload failed ('+res.status+'): '+t.slice(0,200)); }
    const data=await res.json().catch(async()=>{ const t=await res.text(); throw new Error('Non-JSON: '+t.slice(0,200)); });
    if(!data?.ok) throw new Error(data?.error||'Upload error');
    return data; // { ok, url, key }
  }

  // ---------- router ----------
  const routes = {
    '/home': home,
    '/shows': ()=>navTo('/shows/create'),
    '/shows/create': showsCreate,
    '/shows/current': showsList,
    '/orders': orders,
    '/venues': venues,
    '/analytics': analytics,
    '/audiences': audiences,
    '/email': email,
    '/account': account
  };

  function relPath(){
    const p = location.pathname.replace(/\\/+$/, '');
    const base = BASE.replace(/\\/+$/, '');
    return p.startsWith(base) ? (p.slice(base.length) || '/home') : '/home';
  }

  function navTo(path){
    const full = BASE + path;
    if(location.pathname!==full) history.pushState({}, '', full);
    render();
  }

  function render(){
    const rel = relPath();

    // active nav
    $$('#showsMenu a').forEach(a=>a.classList.toggle('active', a.getAttribute('data-route')===BASE+rel));
    $$('.sidebar .sb-link').forEach(a=>{
      const r=a.getAttribute('data-route');
      a.classList.toggle('active', r && (r===BASE+rel || (rel.startsWith('/shows') && r===BASE+'/shows')));
    });

    const openShows = rel.startsWith('/shows');
    $('#showsMenu').classList.toggle('open', openShows);
    $('#showsToggle .chev').classList.toggle('rotate', openShows);

    (routes[rel] || home)();
  }

  window.addEventListener('popstate', render);

  document.addEventListener('click', (e)=>{
    const a = e.target?.closest('a[data-route], .sb-link#showsToggle');
    if(!a) return;

    if(a.id==='showsToggle'){
      const isOpen = $('#showsMenu').classList.toggle('open');
      $('#showsToggle .chev').classList.toggle('rotate', isOpen);
      e.preventDefault(); return;
    }

    const route = a.getAttribute('data-route');
    if(route){ e.preventDefault(); history.pushState({}, '', route); render(); }
  });

  // ---------- views ----------
  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  function showsCreate(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Tickets</div></div>

        <div class="two-col">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
        </div>

        <div class="two-col" style="margin-top:8px">
          <div class="grid">
            <label>Venue</label>
            <div class="typeahead">
              <input id="venue_input" placeholder="Start typing a venue…" autocomplete="off"/>
              <div id="venue_list" class="ta-list"></div>
            </div>
            <div id="venue_hint" class="muted" style="margin-top:6px">Pick an existing venue or create a new one.</div>
          </div>

          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div class="row" style="margin-top:8px;gap:8px;align-items:center">
              <img id="prev" class="imgprev" alt="Poster preview"/>
              <button id="removeImg" class="btn" style="display:none">Remove</button>
            </div>
          </div>
        </div>

        <div class="grid" style="grid-column:1/-1;margin-top:8px">
          <label>Description (optional)</label>
          <textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea>
        </div>

        <div class="row" style="margin-top:12px">
          <button id="saveShow" class="btn pri">Save show & continue</button>
          <div id="err" class="error"></div>
          <div id="ok" class="ok"></div>
        </div>
      </div>

      <div class="card disabled" id="ticketsCard" aria-disabled="true">
        <div class="header"><div class="title">Tickets</div>
          <div class="muted" id="ticketsHint">Save the show to add tickets.</div>
        </div>

        <div class="row" style="margin-bottom:8px">
          <button class="btn" id="addPaid">Add paid ticket</button>
          <button class="btn" id="addFree">Add free ticket</button>
        </div>

        <div id="newTicketForm" class="grid" style="display:none;margin-bottom:12px">
          <div class="grid-2">
            <div class="grid"><label>Ticket name</label><input id="tk_name" placeholder="e.g. General Admission"/></div>
            <div class="grid"><label>Level (optional)</label>
              <select id="tk_level">
                <option value="">—</option>
                <option>Stalls</option>
                <option>Circle</option>
                <option>Upper Circle</option>
                <option>Balcony</option>
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="grid" id="priceWrap"><label>Price (£)</label><input id="tk_price" type="number" step="0.01" placeholder="25.00"/></div>
            <div class="grid"><label>Allocation (qty)</label><input id="tk_alloc" type="number" placeholder="e.g. 300"/></div>
          </div>

          <div class="row" style="margin:6px 0 2px">
            <span class="pill" id="tk_kind_badge">PAID</span>
            <label style="margin-left:10px" class="muted">Seating:</label>
            <span class="pill">Unallocated</span>
            <span class="pill muted" title="Coming soon" style="opacity:.6">Allocated (seating map)</span>
          </div>

          <div class="row" style="justify-content:flex-end">
            <button class="btn" id="tk_cancel">Cancel</button>
            <button class="btn pri" id="tk_save">Add ticket</button>
            <div id="tk_err" class="error" style="margin-left:8px"></div>
          </div>
        </div>

        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Seating</th><th>Level</th><th>Price</th><th>Qty</th></tr></thead>
          <tbody id="tk_body"><tr><td colspan="6" class="muted">No tickets yet.</td></tr></tbody>
        </table>

        <div class="row" style="margin-top:12px">
          <button class="btn" id="gotoAll">Done – go to All events</button>
        </div>
      </div>
    \`);

    // preload venues for typeahead
    let venues = [];
    j('/admin/venues').then(vj=>{ venues = vj.items || []; }).catch(()=>{});

    const input = $('#venue_input'), list=$('#venue_list'), hint=$('#venue_hint');
    let selectedVenueId = null;

    function renderList(items){
      if(!items.length){ list.style.display='none'; return; }
      list.innerHTML = items.map(v=>\`<div class="ta-item" data-id="\${v.id}">\${v.name}\${v.city?' – '+v.city:''}</div>\`).join('');
      list.style.display='block';
    }
    function suggest(){
      const q=(input.value||'').toLowerCase().trim(); selectedVenueId=null;
      if(!q){ list.style.display='none'; hint.textContent='Pick an existing venue or create a new one.'; return; }
      const matches = venues.filter(v => (v.name||'').toLowerCase().includes(q) || (v.city||'').toLowerCase().includes(q)).slice(0,8);
      if(matches.length){ renderList(matches); }
      else{ list.innerHTML = \`<div class="ta-item" data-create="1">Create "\${input.value}" as a new venue</div>\`; list.style.display='block'; }
    }
    input.addEventListener('input', suggest);
    list.addEventListener('click',(e)=>{
      const it=e.target.closest('.ta-item'); if(!it) return;
      const create=it.getAttribute('data-create');
      if(create){ openVenueModal(input.value); }
      else{
        const id=it.getAttribute('data-id'); const v=venues.find(x=>String(x.id)===String(id));
        if(v){ input.value=v.name+(v.city?' – '+v.city:''); selectedVenueId=v.id; hint.innerHTML='<span class="pill">Selected</span>'; }
      }
      list.style.display='none';
    });

    // image upload
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), removeBtn=$('#removeImg');
    function choose(){ file.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{ e.preventDefault(); drop.classList.remove('drag'); const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) await doUpload(f);});
    file.addEventListener('change', async ()=>{ const f=file.files&&file.files[0]; if(f) await doUpload(f); });

    async function doUpload(f){
      $('#err').textContent=''; bar.style.width='15%';
      try{
        const out=await uploadPoster(f);
        prev.src=out.url; prev.style.display='block'; removeBtn.style.display='inline-block';
        bar.style.width='100%'; setTimeout(()=>bar.style.width='0%',700);
        prev.dataset.url=out.url;
      }catch(e){ bar.style.width='0%'; $('#err').textContent=e.message||'Upload failed'; }
    }
    removeBtn.addEventListener('click', ()=>{ prev.src=''; prev.removeAttribute('data-url'); removeBtn.style.display='none'; });

    // save show -> then unlock Tickets card
    let currentShowId = null;
    $('#saveShow').addEventListener('click', async ()=>{
      $('#err').textContent=''; $('#ok').textContent='';
      try{
        if(!selectedVenueId){
          // try exact match by name
          const name=(input.value||'').trim();
          const exact = venues.find(v => (v.name||'').toLowerCase()===name.toLowerCase());
          if(exact) selectedVenueId = exact.id;
        }
        if(!$('#sh_title').value.trim() || !$('#sh_dt').value){ $('#err').textContent='Title and date/time are required'; return; }
        if(!selectedVenueId){ hint.innerHTML='<span class="pill">No venue selected</span> — choose a venue or create one.'; input.focus(); return; }

        const payload = {
          title: $('#sh_title').value.trim(),
          date: new Date($('#sh_dt').value).toISOString(),
          venueId: selectedVenueId,
          imageUrl: $('#prev').dataset.url || null,
          description: $('#sh_desc').value.trim() || null
        };

        const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        // expect id in r.id or r.show.id
        currentShowId = r?.id ?? r?.show?.id ?? null;
        if(!currentShowId) throw new Error('Missing show id from response');

        // lock basic fields (optional UX), unlock tickets
        ['sh_title','sh_dt','venue_input','sh_desc'].forEach(id=>{ const el=$('#'+id); if(el) el.setAttribute('disabled',''); });
        $('#ticketsCard').classList.remove('disabled'); $('#ticketsCard').removeAttribute('aria-disabled');
        $('#ticketsHint').textContent='Add at least one ticket to start selling.';
        $('#ok').textContent='Show saved. You can now add tickets.';
        loadTickets(); // show any existing (likely none)
      }catch(e){
        $('#err').textContent=e.message||'Failed to save show';
      }
    });

    // ---- Tickets builder (unallocated only for now) ----
    let pendingKind = 'PAID'; // or 'FREE'

    function openTicketForm(kind){
      pendingKind = kind;
      $('#newTicketForm').style.display='grid';
      $('#tk_name').value = kind==='FREE' ? 'Free Ticket' : 'General Admission';
      $('#tk_price').value = kind==='FREE' ? '' : '';
      $('#tk_price').disabled = (kind==='FREE');
      $('#tk_kind_badge').textContent = kind;
      $('#tk_alloc').value='';
      $('#tk_err').textContent='';
    }
    function closeTicketForm(){
      $('#newTicketForm').style.display='none';
      $('#tk_err').textContent='';
    }

    $('#addPaid').addEventListener('click', ()=> openTicketForm('PAID'));
    $('#addFree').addEventListener('click', ()=> openTicketForm('FREE'));
    $('#tk_cancel').addEventListener('click', closeTicketForm);

    async function loadTickets(){
      const body = $('#tk_body');
      if(!currentShowId){ body.innerHTML='<tr><td colspan="6" class="muted">Save the show first.</td></tr>'; return; }
      try{
        // TODO: adapt to your tickettypes API if different
        const t = await j('/admin/tickettypes?showId='+encodeURIComponent(currentShowId));
        const items = t.items || t || [];
        if(!items.length){ body.innerHTML='<tr><td colspan="6" class="muted">No tickets yet.</td></tr>'; return; }
        body.innerHTML = items.map(x=>\`
          <tr>
            <td>\${x.name||''}</td>
            <td>\${x.kind||'PAID'}</td>
            <td>\${x.seating||'UNALLOCATED'}</td>
            <td>\${x.level||''}</td>
            <td>\${typeof x.pricePounds==='number' ? '£'+x.pricePounds.toFixed(2) : (x.kind==='FREE'?'Free':'')}</td>
            <td>\${x.available ?? ''}</td>
          </tr>\`).join('');
      }catch(_e){
        body.innerHTML='<tr><td colspan="6" class="muted">Tickets unavailable (API not implemented yet).</td></tr>';
      }
    }

    $('#tk_save').addEventListener('click', async ()=>{
      $('#tk_err').textContent='';
      try{
        if(!currentShowId) throw new Error('Save the show first');
        const name = $('#tk_name').value.trim();
        const level = $('#tk_level').value || null;
        const alloc = $('#tk_alloc').value ? Number($('#tk_alloc').value) : null;
        const price = pendingKind==='FREE' ? 0 : ($('#tk_price').value ? Number($('#tk_price').value) : null);
        if(!name){ $('#tk_err').textContent='Ticket name required'; return; }
        if(pendingKind==='PAID' && (price===null || isNaN(price))){ $('#tk_err').textContent='Price required for paid tickets'; return; }
        if(alloc===null || isNaN(alloc)){ $('#tk_err').textContent='Allocation (quantity) required'; return; }

        // TODO: adapt to your tickettypes API if different
        const payload = {
          showId: currentShowId,
          name,
          pricePounds: pendingKind==='FREE' ? 0 : price,
          available: alloc,
          kind: pendingKind,
          seating: 'UNALLOCATED',
          level
        };
        await j('/admin/tickettypes',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });

        closeTicketForm();
        loadTickets();
      }catch(e){
        $('#tk_err').textContent=e.message||'Failed to add ticket';
      }
    });

    $('#gotoAll').addEventListener('click', ()=> navTo('/shows/current'));
  }

  async function showsList(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">All events</div><button id="refresh" class="btn">Refresh</button></div>
        <table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead><tbody id="tbody"></tbody></table>
        <div id="lerr" class="error"></div>
      </div>\`);
    async function load(){
      try{
        $('#lerr').textContent='';
        const jn = await j('/admin/shows');
        const tb = $('#tbody');
        tb.innerHTML=(jn.items||[]).map(s=>\`
          <tr>
            <td>\${s.title}</td>
            <td>\${new Date(s.date).toLocaleString()}</td>
            <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : ''}</td>
            <td>\${s._count?.ticketTypes ?? 0}</td>
            <td>\${s._count?.orders ?? 0}</td>
          </tr>\`).join('');
      }catch(e){ $('#lerr').textContent='Failed to load shows'; }
    }
    $('#refresh').addEventListener('click', load);
    load();
  }

  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the Venues tab (already implemented) to add/search venues.</div></div>'); }
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export are available in Orders view.</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div class="muted">Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div class="muted">Coming soon.</div></div>'); }
  function account(){ setMain('<div class="card"><div class="title">Account</div><div class="muted">Manage your login and security (coming soon).</div></div>'); }

  // ---------- venue modal ----------
  function openVenueModal(prefillName){
    $('#venueModalBack').style.display='flex';
    $('#vm_err').textContent='';
    if(prefillName) $('#vm_name').value=prefillName;
    ['vm_city','vm_addr','vm_pc','vm_cap','vm_phone','vm_www'].forEach(id=>{$('#'+id).value='';});
  }
  function closeVenueModal(){ $('#venueModalBack').style.display='none'; }
  $('#venueModalClose').addEventListener('click', closeVenueModal);
  $('#venueModalCancel').addEventListener('click', closeVenueModal);

  $('#venueModalSave').addEventListener('click', async ()=>{
    $('#vm_err').textContent='';
    const payload = {
      name: $('#vm_name').value.trim(),
      city: $('#vm_city').value.trim(),
      address: $('#vm_addr').value.trim(),
      postcode: $('#vm_pc').value.trim(),
      capacity: $('#vm_cap').value ? Number($('#vm_cap').value) : null,
      phone: $('#vm_phone').value.trim() || null,
      website: $('#vm_www').value.trim() || null
    };
    if(!payload.name || !payload.city || !payload.address || !payload.postcode){ $('#vm_err').textContent='Name, City, Address and Postcode are required'; return; }
    try{
      const r = await j('/admin/venues',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok && r.error) throw new Error(r.error);
      closeVenueModal();
      // refresh local venues cache
      const vj = await j('/admin/venues'); const venuesAll = vj.items||[];
      const created = venuesAll.find(v => String(v.id)===String(r.id));
      const input = $('#venue_input'), hint=$('#venue_hint');
      if(input){ input.value = created ? (created.name+(created.city?' – '+created.city:'')) : payload.name+' – '+payload.city; input.focus(); input.blur(); }
      if(hint){ hint.innerHTML='<span class="pill">Selected</span>'; }
    }catch(e){ $('#vm_err').textContent=e.message||'Failed to create venue'; }
  });

  // initial render
  render();
})();
</script>
</body>
</html>`);
});

export default router;
