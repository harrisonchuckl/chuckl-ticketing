// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// Serve the same HTML for /ui and any /ui/* subpath so hard-refresh & deep links work
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
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  input[type="datetime-local"]{padding-right:6px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  /* modal */
  .modal-back{position:fixed;inset:0;background:rgba(15,23,42,.35);display:none;align-items:center;justify-content:center;z-index:50}
  .modal{background:#fff;border:1px solid var(--border);border-radius:12px;max-width:640px;width:92%;padding:14px}
  .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .row{display:flex;gap:8px;align-items:center}
  .pill{background:#f1f5f9;border:1px solid var(--border);padding:2px 8px;border-radius:999px;font-size:12px}
  .typeahead{position:relative}
  .ta-list{position:absolute;left:0;right:0;top:100%;z-index:10;background:#fff;border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;max-height:220px;overflow:auto;display:none}
  .ta-item{padding:8px 10px;border-top:1px solid var(--border);cursor:pointer}
  .ta-item:hover{background:#f8fafc}
  /* alignment tweak: Title and Venue same width/spacing */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
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
      <a data-route="/admin/ui/shows/create">Create show</a>
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
    if(!r.ok){
      const text=await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(text?(': '+text.slice(0,200)):''));
    }
    return r.json();
  }

  // upload helper -> /api/upload
  async function uploadPoster(file){
    const form=new FormData();
    form.append('file',file);
    const res=await fetch('/api/upload',{method:'POST',body:form,credentials:'include'});
    if(!res.ok){ const t=await res.text(); throw new Error('Upload failed ('+res.status+'): '+t.slice(0,200)); }
    const data=await res.json().catch(async()=>{ const t=await res.text(); throw new Error('Non-JSON: '+t.slice(0,200)); });
    if(!data?.ok) throw new Error(data?.error||'Upload error');
    return data; // { ok, url, key }
  }

  // ---------- client router (path-based) ----------
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

  function currentPath(){
    const p = location.pathname.replace(/\\/+$/, '');
    const base = BASE.replace(/\\/+$/, '');
    const rel = p.startsWith(base) ? p.slice(base.length) || '/home' : '/home';
    return rel;
  }

  function navTo(path){
    const full = BASE + path;
    if(location.pathname!==full){
      history.pushState({}, '', full);
    }
    render();
  }

  function render(){
    // set active classes
    const rel = currentPath();
    $$('#showsMenu a').forEach(a=>a.classList.toggle('active', a.getAttribute('data-route')===BASE+rel));
    $$('.sidebar .sb-link').forEach(a=>{
      const route=a.getAttribute('data-route');
      a.classList.toggle('active', route && (route===BASE+rel || (rel.startsWith('/shows') && route===BASE+'/shows')));
    });

    // open shows submenu automatically on /shows/*
    const openShows = rel.startsWith('/shows');
    $('#showsMenu').classList.toggle('open', openShows);
    $('#showsToggle .chev').classList.toggle('rotate', openShows);

    (routes[rel] || home)();
  }

  window.addEventListener('popstate', render);

  // intercept clicks on sidebar links (data-route)
  document.addEventListener('click', (e)=>{
    const a = e.target?.closest('a[data-route], .sb-link#showsToggle');
    if(!a) return;

    // toggle shows submenu
    if(a.id==='showsToggle'){
      const isOpen = $('#showsMenu').classList.toggle('open');
      $('#showsToggle .chev').classList.toggle('rotate', isOpen);
      e.preventDefault();
      return;
    }

    const route = a.getAttribute('data-route');
    if(route){
      e.preventDefault();
      history.pushState({}, '', route);
      render();
    }
  });

  // ---------- views ----------
  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  function showsBaseForm(){
    return \`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>

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

        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" value="General Admission"/></div>
          <div class="grid"><label>Price (£)</label><input id="t_price" type="number" step="0.01" placeholder="25.00"/></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300"/></div>
        </div>

        <div class="row" style="display:flex;gap:8px;align-items:center">
          <button id="create" class="btn">Create show</button>
          <div id="err" class="error"></div>
        </div>
      </div>\`;
  }

  async function showsCreate(){
    setMain(showsBaseForm());

    // venues preload (for typeahead)
    let venues = [];
    try{
      const vj = await j('/admin/venues');
      venues = vj.items || [];
    }catch{}

    const input = $('#venue_input');
    const list = $('#venue_list');
    const hint = $('#venue_hint');
    let selectedVenueId = null;

    function renderList(items){
      if(!items.length){ list.style.display='none'; return; }
      list.innerHTML = items.map(v=>\`<div class="ta-item" data-id="\${v.id}">\${v.name}\${v.city?' – '+v.city:''}</div>\`).join('');
      list.style.display='block';
    }

    function suggest(){
      const q = (input.value||'').toLowerCase().trim();
      selectedVenueId = null;
      if(!q){ list.style.display='none'; hint.textContent='Pick an existing venue or create a new one.'; return; }
      const matches = venues.filter(v => (v.name||'').toLowerCase().includes(q) || (v.city||'').toLowerCase().includes(q)).slice(0,8);
      renderList(matches);
      if(matches.length===0){
        list.innerHTML = \`<div class="ta-item" data-create="1">Create "\${input.value}" as a new venue</div>\`;
        list.style.display='block';
      }
    }

    input.addEventListener('input', suggest);
    list.addEventListener('click', (e)=>{
      const it = e.target.closest('.ta-item'); if(!it) return;
      const create = it.getAttribute('data-create');
      if(create){
        openVenueModal(input.value);
      }else{
        const id = it.getAttribute('data-id');
        const v = venues.find(x=>String(x.id)===String(id));
        if(v){ input.value = v.name + (v.city? ' – '+v.city : ''); selectedVenueId = v.id; hint.innerHTML = '<span class="pill">Selected</span>'; }
      }
      list.style.display='none';
    });

    // image upload
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), removeBtn=$('#removeImg');
    function choose(){ file.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f=e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{ const f=file.files&&file.files[0]; if(f) await doUpload(f); });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out=await uploadPoster(f);
        prev.src=out.url;
        prev.style.display='block';
        removeBtn.style.display='inline-block';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%', 700);
        prev.dataset.url = out.url; // stash for submit
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent = e.message||'Upload failed';
      }
    }
    removeBtn.addEventListener('click', ()=>{
      prev.src=''; prev.removeAttribute('data-url'); removeBtn.style.display='none';
    });

    // create show
    $('#create').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        // if no selectedVenueId, try to find exact match by name (before forcing modal)
        if(!selectedVenueId){
          const name = (input.value||'').trim();
          const exact = venues.find(v => (v.name||'').toLowerCase()===name.toLowerCase());
          if(exact) selectedVenueId = exact.id;
        }
        if(!selectedVenueId){
          hint.innerHTML = '<span class="pill">No venue selected</span> — choose a venue or create one.';
          input.focus();
          return;
        }
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId: selectedVenueId,
          imageUrl: $('#prev').dataset.url || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim(),
            pricePounds: $('#t_price').value ? Number($('#t_price').value) : null,
            available: $('#t_alloc').value ? Number($('#t_alloc').value) : null
          }
        };
        if(!payload.title || !payload.date){ $('#err').textContent='Title and date/time are required'; return; }
        const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r.ok) throw new Error(r.error||'Failed to create show');
        // reset
        ['sh_title','sh_dt','sh_desc','t_name','t_price','t_alloc'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        input.value=''; selectedVenueId=null; hint.textContent='Pick an existing venue or create a new one.';
        prev.src=''; prev.removeAttribute('data-url'); removeBtn.style.display='none';
        bar.style.width='0%';
        // go to list
        navTo('/shows/current');
      }catch(e){ $('#err').textContent=e.message||'Failed to create show'; }
    });
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
    if(!payload.name || !payload.city || !payload.address || !payload.postcode){
      $('#vm_err').textContent='Name, City, Address and Postcode are required';
      return;
    }
    try{
      const r = await j('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error(r.error||'Failed to create venue');
      closeVenueModal();
      // refresh cached venues for typeahead
      const vj = await j('/admin/venues'); const venuesAll = vj.items||[];
      const created = venuesAll.find(v => String(v.id)===String(r.id));
      // update the create page inputs if still there
      const input = $('#venue_input'); const hint=$('#venue_hint');
      if(input){ input.value = created ? (created.name+(created.city?' – '+created.city:'')) : payload.name+' – '+payload.city; input.focus(); input.blur(); }
      if(hint){ hint.innerHTML = '<span class="pill">Selected</span>'; }
    }catch(e){ $('#vm_err').textContent=e.message||'Failed to create venue'; }
  });

  // initial render
  render();

  // expose modal opener to typeahead (create link)
  window.openVenueModal = openVenueModal;
})();
</script>
</body>
</html>`);
});

export default router;
