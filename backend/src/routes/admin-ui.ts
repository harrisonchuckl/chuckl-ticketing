// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

router.get('/ui', requireAdminOrOrganiser, async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Organiser Console</title>
<style>
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--primary:#111827}
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box;overflow:auto}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .sb-sub{padding-left:14px}
  .sb-sub .sb-link{padding-left:18px}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .btn.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  .row{display:flex;gap:8px;align-items:center}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none;width:100%;box-sizing:border-box}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b;cursor:pointer}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .pill{display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;border:1px solid var(--border);border-radius:10px;padding:6px 8px}
  .pill .btn{padding:4px 8px}
  /* typeahead */
  .typeahead{position:relative}
  .ta-list{position:absolute;z-index:10;top:100%;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:8px;margin-top:6px;box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden}
  .ta-item{padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border)}
  .ta-item:last-child{border-bottom:none}
  .ta-item:hover{background:#f8fafc}
  .ta-empty{padding:10px 12px;color:#64748b}
  /* modal */
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;padding:16px}
  .modal.open{display:flex}
  .modal-card{background:#fff;border:1px solid var(--border);border-radius:14px;max-width:760px;width:100%;padding:16px}
  .modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .close-x{cursor:pointer;color:#6b7280}
  .req:after{content:" *";color:#b91c1c}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" href="#home" data-view="home">Home</a>

    <div class="sb-group">Manage</div>
    <div class="sb-sub">
      <a class="sb-link" href="#shows/create" data-view="shows/create">Shows · Create</a>
      <a class="sb-link" href="#shows/list" data-view="shows/list">Shows · Current</a>
    </div>
    <a class="sb-link" href="#orders" data-view="orders">Orders</a>
    <a class="sb-link" href="#venues" data-view="venues">Venues</a>

    <div class="sb-group">Insights</div>
    <a class="sb-link" href="#analytics" data-view="analytics">Analytics</a>

    <div class="sb-group">Marketing</div>
    <a class="sb-link" href="#audiences" data-view="audiences">Audiences</a>
    <a class="sb-link" href="#email" data-view="email">Email Campaigns</a>

    <div class="sb-group">Settings</div>
    <a class="sb-link" href="#account" data-view="account">Account</a>
    <a class="sb-link" href="/auth/logout">Log out</a>
  </aside>

  <main class="content" id="main">
    <div class="card"><div class="title">Loading…</div></div>
  </main>
</div>

<!-- Create Venue Modal -->
<div id="venueModal" class="modal" aria-hidden="true">
  <div class="modal-card">
    <div class="modal-head">
      <div class="title">Create venue</div>
      <span id="vmClose" class="close-x">✕</span>
    </div>
    <div class="grid grid-2" style="margin-bottom:8px">
      <div class="grid"><label class="req">Name</label><input id="vm_name" placeholder="e.g. Littleport Village Hall"/></div>
      <div class="grid"><label>City / Town</label><input id="vm_city" placeholder="e.g. Littleport"/></div>
      <div class="grid"><label class="req">Address</label><input id="vm_addr" placeholder="Street, area"/></div>
      <div class="grid"><label class="req">Postcode</label><input id="vm_post" placeholder="e.g. CB6 1AB"/></div>
      <div class="grid"><label>Capacity (optional)</label><input id="vm_cap" type="number" placeholder="e.g. 300"/></div>
      <div class="grid"><label>Phone (optional)</label><input id="vm_phone" placeholder=""/></div>
      <div class="grid" style="grid-column:1/-1"><label>Website (optional)</label><input id="vm_web" placeholder="https://"/></div>
    </div>
    <div class="row" style="justify-content:flex-end">
      <button id="vmCancel" class="btn">Cancel</button>
      <button id="vmSave" class="btn primary">Save venue</button>
    </div>
    <div id="vmErr" class="error" style="margin-top:8px"></div>
  </div>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function setActive(v){ $$('.sb-link').forEach(a=>a.classList.toggle('active',a.getAttribute('data-view')===v)); }
  function setMain(html){ $('#main').innerHTML=html; }
  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){
      const text = await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(text?(': '+text.slice(0,200)):''));
    }
    return r.json();
  }

  // Upload helper (POST /api/upload). Returns { ok, url, key }
  async function uploadPoster(file){
    const form=new FormData(); form.append('file',file);
    const res=await fetch('/api/upload',{method:'POST',body:form,credentials:'include'});
    if(!res.ok){ const t=await res.text(); throw new Error('Upload failed ('+res.status+'): '+t.slice(0,200)); }
    const data=await res.json().catch(async()=>{ const t=await res.text(); throw new Error('Non-JSON: '+t.slice(0,200)); });
    if(!data?.ok) throw new Error(data?.error||'Upload error');
    return data;
  }

  // Router
  function route(){
    const raw=(location.hash||'#home').slice(1);
    const v = raw || 'home';
    setActive(v);
    if(v==='shows/create') return showsCreate();
    if(v==='shows/list')   return showsList();
    if(v==='venues') return venues();
    if(v==='orders') return orders();
    if(v==='analytics') return analytics();
    if(v==='audiences') return audiences();
    if(v==='email') return email();
    if(v==='account') return account();
    return home();
  }
  window.addEventListener('hashchange',route);

  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  // ---------- Shows · Create ----------
  async function showsCreate(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>
        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>

          <!-- Venue (left column, same width/spacing as Title) -->
          <div class="grid">
            <label>Venue</label>
            <div class="typeahead">
              <input id="venue_input" placeholder="Start typing a venue…" autocomplete="off"/>
              <div id="venue_list" class="ta-list" style="display:none"></div>
            </div>
            <div id="venue_pick" class="muted" style="margin-top:8px"></div>
          </div>

          <!-- Poster (right column) -->
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div id="poster_pill" class="pill" style="margin-top:8px;display:none">
              <img id="prev" class="imgprev" alt="Poster preview"/>
              <button id="rmv" type="button" class="btn">Remove</button>
            </div>
          </div>

          <div class="grid" style="grid-column:1/-1"><label>Description (optional)</label><textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea></div>
        </div>

        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" placeholder="General Admission"/></div>
          <div class="grid"><label>Price (£)</label><input id="t_price" type="number" step="0.01" placeholder="25.00"/></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300"/></div>
        </div>
        <div class="row">
          <button id="create" class="btn primary">Create show</button>
          <div id="err" class="error"></div>
        </div>
      </div>
    \`);

    // ---- Venue typeahead ----
    let venuesCache = [];
    let selectedVenue = null;
    const vInput = $('#venue_input');
    const vList  = $('#venue_list');
    const vPick  = $('#venue_pick');

    function renderVenuePick(){
      if(selectedVenue){
        vPick.innerHTML = \`\${selectedVenue.name}\${selectedVenue.city ? ' – '+selectedVenue.city : ''}\`;
      }else{
        vPick.innerHTML = '<span class="muted">Pick an existing venue or create a new one.</span>';
      }
    }
    renderVenuePick();

    async function ensureVenues(){
      if(venuesCache.length) return;
      try{
        const r = await j('/admin/venues');
        venuesCache = r.items || [];
      }catch{}
    }

    function openCreatePrompt(label){
      // Offer "Create venue" inline item
      const div = document.createElement('div');
      div.className = 'ta-item';
      div.innerHTML = \`Create "\${label}" as a new venue\`;
      div.addEventListener('click', ()=> openVenueModal(label));
      vList.appendChild(div);
    }

    function showList(items, needle){
      vList.innerHTML = '';
      if(items.length){
        items.slice(0,8).forEach(it=>{
          const div = document.createElement('div');
          div.className='ta-item';
          div.innerHTML = \`\${it.name}\${it.city?' – '+it.city:''}\`;
          div.addEventListener('click', ()=>{ selectedVenue=it; vInput.value=it.name; vList.style.display='none'; renderVenuePick(); });
          vList.appendChild(div);
        });
      }else{
        openCreatePrompt(needle);
      }
      vList.style.display='block';
    }

    vInput.addEventListener('input', async ()=>{
      const q = vInput.value.trim();
      selectedVenue = null;
      renderVenuePick();
      if(!q){ vList.style.display='none'; return; }
      await ensureVenues();
      const needle = q.toLowerCase();
      const hits = venuesCache.filter(v=>{
        return (v.name||'').toLowerCase().includes(needle) || (v.city||'').toLowerCase().includes(needle);
      });
      showList(hits, q);
    });

    document.addEventListener('click', (e)=>{
      if(!(e.target && (e.target.id==='venue_input' || e.target.closest('.typeahead')))){
        vList.style.display='none';
      }
    });

    // ---- Venue modal controls ----
    function openVenueModal(presetName){
      $('#venueModal').classList.add('open');
      $('#vmErr').textContent='';
      $('#vm_name').value = presetName || vInput.value || '';
      $('#vm_city').value = '';
      $('#vm_addr').value = '';
      $('#vm_post').value = '';
      $('#vm_cap').value  = '';
      $('#vm_phone').value= '';
      $('#vm_web').value  = '';
    }
    function closeVenueModal(){ $('#venueModal').classList.remove('open'); }
    $('#vmClose').addEventListener('click', closeVenueModal);
    $('#vmCancel').addEventListener('click', closeVenueModal);

    $('#vmSave').addEventListener('click', async ()=>{
      const name = $('#vm_name').value.trim();
      const city = $('#vm_city').value.trim();
      const addr = $('#vm_addr').value.trim();
      const post = $('#vm_post').value.trim();
      const cap  = $('#vm_cap').value ? Number($('#vm_cap').value) : null;
      const phone= $('#vm_phone').value.trim() || null;
      const web  = $('#vm_web').value.trim() || null;

      if(!name || !addr || !post){
        $('#vmErr').textContent = 'Name, Address and Postcode are required.';
        return;
      }
      try{
        const payload = { name, city, address: addr, postcode: post, capacity: cap, phone, website: web };
        const r = await j('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r?.ok) throw new Error(r?.error || 'Failed to create venue');
        // Cache + pick it
        venuesCache.unshift(r.venue);
        selectedVenue = r.venue;
        vInput.value = r.venue.name;
        renderVenuePick();
        closeVenueModal();
      }catch(e){
        $('#vmErr').textContent = e.message || 'Failed to create venue';
      }
    });

    // ---- Poster upload (no URL/name/size; just preview + Remove) ----
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), pill=$('#poster_pill'), prev=$('#prev'), rmv=$('#rmv');
    let imageUrl = null;
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
    rmv.addEventListener('click', ()=>{
      imageUrl=null; prev.removeAttribute('src'); pill.style.display='none';
    });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out = await uploadPoster(f);
        imageUrl = out.url;
        prev.src = out.url;
        pill.style.display='inline-flex';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%', 800);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent = e.message || 'Upload failed';
      }
    }

    // ---- Create show ----
    $('#create').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const payload = {
          title: $('#sh_title').value.trim(),
          date:  $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId: selectedVenue?.id || null,
          imageUrl: imageUrl || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim(),
            pricePounds: $('#t_price').value ? Number($('#t_price').value) : null,
            available:   $('#t_alloc').value ? Number($('#t_alloc').value) : null
          }
        };
        if(!payload.title || !payload.date || !payload.venueId){
          $('#err').textContent='Title, date/time and venue are required';
          return;
        }
        const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r.ok) throw new Error(r.error||'Failed to create show');

        // Reset form
        ['sh_title','sh_dt','sh_desc','t_name','t_price','t_alloc'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        vInput.value=''; selectedVenue=null; renderVenuePick();
        imageUrl=null; prev.removeAttribute('src'); pill.style.display='none';
        alert('Show created.');
      }catch(e){
        $('#err').textContent=e.message||'Failed to create show';
      }
    });
  }

  // ---------- Shows · Current ----------
  async function showsList(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Current Shows</div><button id="refresh" class="btn">Refresh</button></div>
        <table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead><tbody id="tbody"></tbody></table>
        <div id="lerr" class="error"></div>
      </div>\`);
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

  // Other views (placeholders)
  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the typeahead in Shows · Create, or manage venues here (coming soon).</div></div>'); }
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export are available in Orders view (coming soon).</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'); }
  function account(){ setMain('<div class="card"><div class="title">Account</div><div>Manage your login and security (coming soon).</div></div>'); }

  // Sidebar client routing
  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault();
      history.pushState(null,'',a.getAttribute('href'));
      route();
    }
  });

  // Default route
  if(!location.hash){ location.hash = '#shows/create'; }
  route();
})();
</script>
</body>
</html>`);
});

export default router;
