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
  :root{
    --bg:#f7f8fb; --panel:#fff; --border:#e5e7eb;
    --text:#111827; --muted:#6b7280; --brand:#111827; --brand-ghost:#f1f5f9;
    --green:#16a34a; --amber:#f59e0b; --red:#dc2626; --blue:#2563eb;
  }
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .sb-parent{user-select:none;display:flex;align-items:center;justify-content:space-between}
  .caret{font-size:12px;color:var(--muted)}
  .submenu{margin-left:8px;display:none}
  .submenu.open{display:block}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .btn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
  .btn.ghost{background:var(--brand-ghost);border-color:var(--brand-ghost)}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  .grid-4{grid-template-columns:repeat(4,1fr)}
  .row{display:flex;gap:8px;align-items:center}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  input[type="datetime-local"]{padding-right:6px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  /* uploader */
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  /* rich text */
  .rte-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
  .rte-toolbar button{border:1px solid var(--border);background:#fff;border-radius:6px;padding:6px 8px;cursor:pointer}
  .rte{border:1px solid var(--border);border-radius:8px;padding:10px;min-height:120px;background:#fff}
  .rte:focus{outline:2px solid #e5e7eb}
  /* allocations bar */
  .alloc{display:flex;gap:6px;align-items:center}
  .allocbar{flex:1;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;position:relative}
  .allocbar span{position:absolute;left:0;top:0;height:100%}
  .seg-sold{background:var(--green)}
  .seg-hold{background:var(--amber)}
  .seg-avail{background:#60a5fa}
  /* menu (kebab) */
  .kebab{position:relative}
  .kebab-btn{border:1px solid var(--border);background:#fff;border-radius:8px;padding:6px 8px;cursor:pointer}
  .kebab-menu{position:absolute;right:0;top:36px;background:#fff;border:1px solid var(--border);border-radius:8px;min-width:160px;box-shadow:0 10px 20px rgba(0,0,0,.06);display:none;z-index:5}
  .kebab-menu.open{display:block}
  .kebab-menu a{display:block;padding:10px 12px;color:#111827;text-decoration:none}
  .kebab-menu a:hover{background:#f8fafc}
  /* modal */
  .modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;padding:20px}
  .modal.open{display:flex}
  .modalcard{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;max-width:640px;width:100%}
  .modalhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .closex{cursor:pointer;color:var(--muted)}
  .wfull{width:100%}
  .hint{font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" href="#home" data-view="home">Home</a>

    <div class="sb-group">Manage</div>

    <div class="sb-link sb-parent" data-parent="shows">
      <span>Shows</span><span class="caret">▸</span>
    </div>
    <div class="submenu" id="submenu-shows">
      <a class="sb-link" href="#shows/create" data-view="shows/create">Create show</a>
      <a class="sb-link" href="#shows/current" data-view="shows/current">All events</a>
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

  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<!-- Create Venue Modal -->
<div class="modal" id="venueModal">
  <div class="modalcard">
    <div class="modalhead"><div class="title">Create venue</div><span class="closex" id="venueClose">✕</span></div>
    <div class="grid grid-2" style="margin-bottom:8px">
      <div class="grid"><label>Name</label><input id="v_name" /></div>
      <div class="grid"><label>City / Town</label><input id="v_city" /></div>
      <div class="grid"><label>Address</label><input id="v_address" /></div>
      <div class="grid"><label>Postcode</label><input id="v_postcode" /></div>
      <div class="grid"><label>Capacity (optional)</label><input id="v_capacity" type="number" /></div>
      <div class="grid"><label>Phone (optional)</label><input id="v_phone" /></div>
      <div class="grid"><label>Website (optional)</label><input id="v_website" /></div>
    </div>
    <div class="row" style="justify-content:flex-end">
      <button class="btn" id="venueCancel">Cancel</button>
      <button class="btn primary" id="venueSave">Save venue</button>
      <div id="venueErr" class="error" style="margin-left:8px"></div>
    </div>
  </div>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const main = $('#main');

  function setActive(view){
    $$('.sb-link').forEach(a=>a.classList.toggle('active',a.getAttribute('data-view')===view));
    // keep submenu open for Shows routes
    const sub = $('#submenu-shows');
    const caret = $('.sb-parent[data-parent="shows"] .caret');
    if(view && view.startsWith('shows/')){ sub.classList.add('open'); caret.textContent='▾'; }
  }

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){
      const text = await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(text?(': '+text.slice(0,200)):''));
    }
    // try json first, fall back to text (for safety)
    try { return await r.json(); } catch { return await r.text(); }
  }

  // -------- Left-nav: Shows submenu toggle
  const parent = $('.sb-parent[data-parent="shows"]');
  parent.addEventListener('click', ()=>{
    const sub = $('#submenu-shows');
    const caret = $('.sb-parent[data-parent="shows"] .caret');
    sub.classList.toggle('open');
    caret.textContent = sub.classList.contains('open') ? '▾' : '▸';
  });

  // -------- Poster uploader
  async function uploadPoster(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`Upload failed (\${res.status}): \${text.slice(0, 300)}\`);
    }
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "Unknown upload error");
    return data; // { ok:true, key, url }
  }

  // -------- Lightweight Rich Text Editor
  function mountRTE(container, initialHtml=''){
    container.innerHTML = \`
      <div class="rte-toolbar">
        <button type="button" data-cmd="bold"><b>B</b></button>
        <button type="button" data-cmd="italic"><i>I</i></button>
        <button type="button" data-cmd="underline"><u>U</u></button>
        <button type="button" data-cmd="insertUnorderedList">• List</button>
        <button type="button" data-cmd="insertOrderedList">1. List</button>
        <button type="button" data-cmd="createLink">Link</button>
        <button type="button" data-cmd="removeFormat">Clear</button>
      </div>
      <div class="rte" id="rteArea" contenteditable="true"></div>
      <div class="hint">Event description (required). Use the toolbar to format.</div>
    \`;
    const area = $('#rteArea', container);
    area.innerHTML = initialHtml || '';
    container.querySelectorAll('[data-cmd]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const cmd = btn.getAttribute('data-cmd');
        if(cmd==='createLink'){
          const url = prompt('Enter URL');
          if(url) document.execCommand('createLink', false, url);
          return;
        }
        document.execCommand(cmd,false,null);
        area.focus();
      });
    });
    return {
      getHTML(){ return area.innerHTML.trim(); },
      setHTML(html){ area.innerHTML = html || ''; }
    };
  }

  // -------- Venue modal helpers
  const venueModal = $('#venueModal'), venueErr = $('#venueErr');
  function openVenueModal(prefillName){
    venueErr.textContent='';
    ['v_name','v_city','v_address','v_postcode','v_capacity','v_phone','v_website'].forEach(id=>$('#'+id).value='');
    if(prefillName) $('#v_name').value = prefillName;
    venueModal.classList.add('open');
  }
  function closeVenueModal(){ venueModal.classList.remove('open'); }
  $('#venueClose').onclick = closeVenueModal;
  $('#venueCancel').onclick = closeVenueModal;

  // -------- Router
  function route(){
    const hash = (location.hash||'#home').slice(1);
    setActive(hash);
    if(hash==='home') return home();
    if(hash==='orders') return orders();
    if(hash==='venues') return venues();
    if(hash==='analytics') return analytics();
    if(hash==='audiences') return audiences();
    if(hash==='email') return email();
    if(hash==='shows/create') return showsCreate();       // create (and edit if ?id=)
    if(hash==='shows/current') return showsCurrent();     // list
    // default
    return home();
  }
  window.addEventListener('hashchange', route);

  // -------- Views
  function home(){
    main.innerHTML = '<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }
  function orders(){ main.innerHTML = '<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export coming soon.</div></div>'; }
  function venues(){ main.innerHTML = '<div class="card"><div class="title">Venues</div><div class="muted">Use the Venues tab (already implemented) to add/search venues.</div></div>'; }
  function analytics(){ main.innerHTML = '<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'; }
  function audiences(){ main.innerHTML = '<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'; }
  function email(){ main.innerHTML = '<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'; }

  // ---------- SHOWS: Create / Edit
  async function showsCreate(){
    // Detect edit mode
    const params = new URLSearchParams(location.search);
    const editId = params.get('id');

    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">\${editId ? 'Edit show' : 'Create show'}</div></div>

        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid">
            <label>Title</label>
            <input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/>
          </div>
          <div class="grid">
            <label>Date & time</label>
            <input id="sh_dt" type="datetime-local"/>
          </div>

          <div class="grid">
            <label>Venue</label>
            <input id="venueSearch" placeholder="Start typing a venue..." />
            <div id="venueResults" class="card" style="padding:8px;display:none;margin-top:6px"></div>
            <div class="hint">Pick an existing venue or create a new one.</div>
          </div>

          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="row" style="margin-top:8px;gap:12px;align-items:center">
              <img id="prev" class="imgprev" alt="Poster preview"/>
              <button id="removeImg" class="btn" style="display:none">Remove</button>
            </div>
          </div>

          <div class="grid" style="grid-column:1/-1">
            <label>Description</label>
            <div id="rteHost"></div>
            <div id="descErr" class="error"></div>
          </div>
        </div>

        <div class="row" style="gap:8px">
          <button id="saveShow" class="btn primary">\${editId ? 'Save changes' : 'Save show shell'}</button>
          <div id="err" class="error"></div>
        </div>
      </div>

      <div class="card" id="ticketsCard" style="display:\${editId ? 'block' : 'none'}">
        <div class="header"><div class="title">Tickets</div>
          <div class="row">
            <input id="onSaleAt" type="datetime-local" />
            <button id="scheduleBtn" class="btn">Schedule on-sale</button>
            <button id="publishBtn" class="btn primary">Publish show</button>
          </div>
        </div>
        <div class="row" style="margin-bottom:8px;gap:8px">
          <button id="addPaid" class="btn">Add paid ticket</button>
          <button id="addFree" class="btn">Add free ticket</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Seating</th><th>Level</th><th>Price</th><th>Qty</th></tr></thead>
          <tbody id="ticketsBody"><tr><td colspan="6" class="muted">No tickets yet.</td></tr></tbody>
        </table>
      </div>
    \`;

    // Rich text editor (required)
    const rte = mountRTE($('#rteHost'), '');

    // Venue search / suggest / create
    const vInput = $('#venueSearch'), vResults = $('#venueResults');
    let venueId = null, imageUrl = null, currentShowId = editId || null;

    async function searchVenues(q){
      const data = await j('/admin/venues?q='+encodeURIComponent(q));
      const list = (data.items||[]);
      if(!q || (!list.length && !q.trim())){ vResults.style.display='none'; return; }
      let html = '';
      if(list.length){
        html += list.map(v=>\`<div class="row" style="justify-content:space-between;padding:6px 4px">
          <span>\${v.name}\${v.city?' – '+v.city:''}</span>
          <button class="btn ghost pickVenue" data-id="\${v.id}" data-name="\${v.name}">Select</button>
        </div>\`).join('');
      }else{
        html += \`<div class="row" style="justify-content:space-between;padding:6px 4px">
          <span>Create "\${q}" as a new venue</span>
          <button class="btn primary" id="createVenueBtn">Create venue</button>
        </div>\`;
      }
      vResults.innerHTML = html;
      vResults.style.display='block';

      // wire picks
      $$('.pickVenue', vResults).forEach(btn=>{
        btn.addEventListener('click', ()=>{
          venueId = btn.getAttribute('data-id');
          vInput.value = btn.getAttribute('data-name');
          vResults.style.display='none';
        });
      });
      const createBtn = $('#createVenueBtn', vResults);
      if(createBtn){
        createBtn.addEventListener('click', ()=>{
          openVenueModal(vInput.value.trim());
        });
      }
    }
    vInput.addEventListener('input', e=>{
      const q = e.target.value || '';
      if(q.trim().length<1){ vResults.style.display='none'; return; }
      searchVenues(q);
    });

    // Venue modal save (Address + Postcode required)
    $('#venueSave').addEventListener('click', async ()=>{
      venueErr.textContent='';
      const payload = {
        name: $('#v_name').value.trim(),
        city: $('#v_city').value.trim(),
        address: $('#v_address').value.trim(),
        postcode: $('#v_postcode').value.trim(),
        capacity: $('#v_capacity').value ? Number($('#v_capacity').value) : null,
        phone: $('#v_phone').value.trim() || null,
        website: $('#v_website').value.trim() || null
      };
      if(!payload.name || !payload.address || !payload.postcode){
        venueErr.textContent='Name, Address and Postcode are required.';
        return;
      }
      try{
        const out = await j('/admin/venues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!out?.ok && !out?.id) throw new Error(out?.error || 'Failed to create venue');
        venueId = out.id || out.venue?.id;
        vInput.value = payload.name + (payload.city?(' – '+payload.city):'');
        closeVenueModal();
      }catch(e){ venueErr.textContent = e.message || 'Failed to save venue'; }
    });

    // Poster upload
    const drop=$('#drop'), file=$('#file'), prev=$('#prev'), removeImg=$('#removeImg');
    drop.addEventListener('click', ()=>file.click());
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
      try{
        const out = await uploadPoster(f);
        imageUrl = out.url;
        prev.src = imageUrl;
        removeImg.style.display='inline-block';
      }catch(e){
        $('#err').textContent = e.message || 'Upload failed';
      }
    }
    removeImg.addEventListener('click', ()=>{
      imageUrl = null;
      prev.src = '';
      removeImg.style.display='none';
    });

    // Load edit data
    if(editId){
      try{
        const s = await j('/admin/shows/'+encodeURIComponent(editId));
        if(s){
          $('#sh_title').value = s.title || '';
          if(s.date){ // ISO -> local value
            const d = new Date(s.date);
            const pad=n=>String(n).padStart(2,'0');
            const val = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
            $('#sh_dt').value = val;
          }
          if(s.venue){ venueId = s.venue.id; vInput.value = s.venue.name + (s.venue.city?(' – '+s.venue.city):''); }
          imageUrl = s.imageUrl || null; if(imageUrl){ prev.src=imageUrl; removeImg.style.display='inline-block'; }
          rte.setHTML(s.descriptionHtml || s.description || '');
          currentShowId = s.id;
          $('#ticketsCard').style.display = 'block';
          await loadTickets();
        }
      }catch(e){ console.warn(e); }
    }

    // Save show shell / changes
    $('#saveShow').addEventListener('click', async ()=>{
      $('#err').textContent='';
      $('#descErr').textContent='';
      const payload = {
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueId: venueId || null,
        imageUrl: imageUrl || null,
        descriptionHtml: rte.getHTML()
      };
      if(!payload.title || !payload.date || !payload.venueId){
        $('#err').textContent='Title, date/time and venue are required';
        return;
      }
      if(!payload.descriptionHtml){
        $('#descErr').textContent='Description is required.';
        return;
      }
      try{
        let out;
        if(currentShowId){
          out = await j('/admin/shows/'+encodeURIComponent(currentShowId),{
            method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
          });
        }else{
          out = await j('/admin/shows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          currentShowId = out.id || out.show?.id;
        }
        if(!currentShowId) throw new Error('Show ID not returned');
        $('#ticketsCard').style.display = 'block';
        await loadTickets();
      }catch(e){
        $('#err').textContent = e.message || 'Failed to save show';
      }
    });

    // Tickets (unallocated for now)
    async function loadTickets(){
      const body = $('#ticketsBody');
      if(!currentShowId){ body.innerHTML='<tr><td colspan="6" class="muted">Save the show to add tickets.</td></tr>'; return; }
      try{
        const data = await j('/admin/tickets?showId='+encodeURIComponent(currentShowId));
        const items = data.items || [];
        if(!items.length){ body.innerHTML='<tr><td colspan="6" class="muted">No tickets yet.</td></tr>'; return; }
        body.innerHTML = items.map(t=>\`<tr>
          <td>\${t.name}</td>
          <td>\${t.kind || (t.pricePence>0?'Paid':'Free')}</td>
          <td>Unallocated</td>
          <td>\${t.level || '-'}</td>
          <td>£\${(t.pricePence||0/100).toFixed(2)}</td>
          <td>\${t.available ?? ''}</td>
        </tr>\`).join('');
      }catch(_e){
        body.innerHTML='<tr><td colspan="6" class="muted">No tickets yet.</td></tr>';
      }
    }

    async function addTicket(kind){
      if(!currentShowId){ alert('Save the show first.'); return; }
      const name = prompt('Ticket name (e.g. General Admission)');
      if(!name) return;
      let pricePence = 0;
      if(kind==='paid'){
        const p = prompt('Price in pounds (e.g. 25.00)');
        if(!p) return;
        pricePence = Math.round(parseFloat(p)*100);
      }
      const qtyStr = prompt('Quantity (e.g. 300)');
      const qty = qtyStr ? Number(qtyStr) : 0;
      const payload = {
        showId: currentShowId,
        name,
        pricePence,
        available: qty,
        kind: (kind==='paid'?'Paid':'Free'),
        seating: 'Unallocated',
      };
      try{
        await j('/admin/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        await loadTickets();
      }catch(e){ alert(e.message || 'Failed to add ticket'); }
    }
    $('#addPaid').addEventListener('click', ()=>addTicket('paid'));
    $('#addFree').addEventListener('click', ()=>addTicket('free'));

    // Publish / Schedule
    $('#publishBtn').addEventListener('click', async ()=>{
      if(!currentShowId){ alert('Save the show first.'); return; }
      try{
        await j('/admin/shows/'+encodeURIComponent(currentShowId),{
          method:'PATCH',headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ published: true })
        });
        alert('Show published');
      }catch(e){ alert(e.message || 'Failed to publish'); }
    });
    $('#scheduleBtn').addEventListener('click', async ()=>{
      if(!currentShowId){ alert('Save the show first.'); return; }
      const val = $('#onSaleAt').value;
      if(!val){ alert('Pick a date/time for on-sale'); return; }
      try{
        await j('/admin/shows/'+encodeURIComponent(currentShowId),{
          method:'PATCH',headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ onSaleAt: new Date(val).toISOString() })
        });
        alert('On-sale scheduled');
      }catch(e){ alert(e.message || 'Failed to schedule'); }
    });
  }

  // ---------- SHOWS: Current (list + edit/duplicate + allocation bars)
  async function showsCurrent(){
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">All events</div>
          <button id="refresh" class="btn">Refresh</button>
        </div>
        <table>
          <thead>
            <tr><th>Title</th><th>When</th><th>Venue</th><th style="width:360px">Total allocation</th><th>Gross face</th><th>Status</th><th></th></tr>
          </thead>
          <tbody id="tbody"><tr><td colspan="7">Loading…</td></tr></tbody>
        </table>
        <div id="lerr" class="error"></div>
      </div>
    \`;

    async function load(){
      $('#lerr').textContent='';
      const tb = $('#tbody');
      try{
        const jn = await j('/admin/shows');
        const items = jn.items || [];
        if(!items.length){ tb.innerHTML='<tr><td colspan="7" class="muted">No events yet.</td></tr>'; return; }
        tb.innerHTML = items.map(s=>{
          // best-effort stats; if missing, default to 0
          const sold = Number(s.stats?.sold ?? s.sold ?? 0);
          const hold = Number(s.stats?.onHold ?? 0);
          const avail = Number(s.stats?.available ?? s.available ?? 0);
          const total = Math.max(1, sold+hold+avail);
          const soldPct = Math.round((sold/total)*100);
          const holdPct = Math.round((hold/total)*100);
          const availPct = Math.max(0, 100 - soldPct - holdPct);
          const gross = s.grossFace ?? s.revenue?.grossFace ?? 0;
          const when = s.date ? new Date(s.date).toLocaleString() : '';
          const venueLabel = s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : '';
          const status = s.published ? 'ON SALE' : 'DRAFT';
          return \`
            <tr data-id="\${s.id||''}" class="eventRow" style="cursor:pointer">
              <td>\${s.title||''}</td>
              <td>\${when}</td>
              <td>\${venueLabel}</td>
              <td>
                <div class="alloc">
                  <div class="allocbar">
                    <span class="seg-sold" style="width:\${soldPct}%;"></span>
                    <span class="seg-hold" style="left:\${soldPct}%;width:\${holdPct}%;"></span>
                    <span class="seg-avail" style="left:\${soldPct+holdPct}%;width:\${availPct}%;"></span>
                  </div>
                  <div class="hint" style="min-width:120px;text-align:right">\${total} total</div>
                </div>
                <div class="hint">Sold \${sold} • Hold \${hold} • Avail \${avail}</div>
              </td>
              <td>£\${Number(gross/100).toFixed(2)}</td>
              <td><span class="\${s.published?'muted':''}">\${status}</span></td>
              <td>
                <div class="kebab">
                  <button class="kebab-btn">⋮</button>
                  <div class="kebab-menu">
                    <a href="#" class="editItem">Edit</a>
                    <a href="#" class="dupItem">Duplicate</a>
                  </div>
                </div>
              </td>
            </tr>\`;
        }).join('');
        // Row click to edit
        $$('.eventRow', tb).forEach(tr=>{
          tr.addEventListener('click', (ev)=>{
            // ignore clicks on kebab
            if(ev.target.closest('.kebab')) return;
            const id = tr.getAttribute('data-id');
            history.pushState(null,'','#shows/create?id='+encodeURIComponent(id));
            route();
          });
          const kebabBtn = $('.kebab-btn', tr), menu = $('.kebab-menu', tr);
          kebabBtn.addEventListener('click', (e)=>{ e.stopPropagation(); menu.classList.toggle('open'); });
          document.addEventListener('click', ()=>menu.classList.remove('open'), { once:true });
          $('.editItem', menu).addEventListener('click', (e)=>{ e.preventDefault(); const id = tr.getAttribute('data-id'); history.pushState(null,'','#shows/create?id='+encodeURIComponent(id)); route(); });
          $('.dupItem', menu).addEventListener('click', async (e)=>{
            e.preventDefault();
            const id = tr.getAttribute('data-id');
            try{
              // Try server-side duplicate; fallback to client copy
              let out;
              try{
                out = await j('/admin/shows/'+encodeURIComponent(id)+'/duplicate',{method:'POST'});
              }catch(_ee){}
              if(out?.id){
                history.pushState(null,'','#shows/create?id='+encodeURIComponent(out.id));
                return route();
              }
              const s = await j('/admin/shows/'+encodeURIComponent(id));
              const payload = {
                title: (s.title||'')+' (Copy)',
                date: s.date,
                venueId: s.venue?.id || null,
                imageUrl: s.imageUrl || null,
                descriptionHtml: s.descriptionHtml || s.description || ''
              };
              const created = await j('/admin/shows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
              const newId = created.id || created.show?.id;
              if(newId){
                alert('Show duplicated. Update details, then publish.');
                history.pushState(null,'','#shows/create?id='+encodeURIComponent(newId));
                route();
              }
            }catch(err){ alert(err.message || 'Failed to duplicate'); }
          });
        });
      }catch(e){ $('#lerr').textContent = e.message || 'Failed to load shows'; }
    }

    $('#refresh').addEventListener('click', load);
    load();
  }

  // Intercept clicks on left-nav links (single-page)
  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault(); history.pushState(null,'',a.getAttribute('href')); route();
    }
  });

  // Boot
  route();
})();
</script>
</body>
</html>`);
});

export default router;
