import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// Serve the SPA shell for /admin/ui and any subpath
router.get(['/ui', '/ui/', '/ui/home', '/ui/*'], requireAdminOrOrganiser, (_req, res) => {
  res.set('Cache-Control', 'no-store');
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
  .sb-link{display:block;padding:10px 12px;margin:4px;border-radius:8px;color:#111827;text-decoration:none}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .sb-sub{margin-left:10px}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .btn.p{background:#111827;color:#fff;border-color:#111827}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px;display:none}
  .row{display:flex;gap:8px;align-items:center}
  .menu{position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);display:none;min-width:160px}
  .menu.open{display:block}
  .menu a{display:block;padding:8px 10px;text-decoration:none;color:#111827}
  .menu a:hover{background:#f8fafc}
  .typeahead{position:relative}
  .ta-list{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:40;max-height:240px;overflow:auto;display:none}
  .ta-item{padding:8px 10px;cursor:pointer}
  .ta-item:hover{background:#f8fafc}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" href="/admin/ui/home" data-view="/admin/ui/home">Home</a>

    <div class="sb-group">Manage</div>
    <div>
      <a class="sb-link" href="#" id="showsToggle">Shows ▾</a>
      <div id="showsSub" class="sb-sub" style="display:none">
        <a class="sb-link" href="/admin/ui/shows/create" data-view="/admin/ui/shows/create">Create show</a>
        <a class="sb-link" href="/admin/ui/shows/current" data-view="/admin/ui/shows/current">All events</a>
      </div>
    </div>
    <a class="sb-link" href="/admin/ui/orders" data-view="/admin/ui/orders">Orders</a>
    <a class="sb-link" href="/admin/ui/venues" data-view="/admin/ui/venues">Venues</a>

    <div class="sb-group">Insights</div>
    <a class="sb-link" href="/admin/ui/analytics" data-view="/admin/ui/analytics">Analytics</a>

    <div class="sb-group">Marketing</div>
    <a class="sb-link" href="/admin/ui/audiences" data-view="/admin/ui/audiences">Audiences</a>
    <a class="sb-link" href="/admin/ui/email" data-view="/admin/ui/email">Email Campaigns</a>

    <div class="sb-group">Settings</div>
    <a class="sb-link" href="/admin/ui/account" data-view="/admin/ui/account">Account</a>
    <a class="sb-link" href="/auth/logout" id="logoutLink">Log out</a>
  </aside>
  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const main = $('#main');

  // sidebar shows submenu
  const showsToggle = $('#showsToggle');
  const showsSub = $('#showsSub');
  showsToggle.addEventListener('click', (e)=>{ e.preventDefault(); showsSub.style.display = showsSub.style.display==='none'?'block':'none'; });

  function setActive(path){
    $$('.sb-link').forEach(a=>{
      a.classList.toggle('active', a.getAttribute('data-view')===path);
    });
  }

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){ const t=await r.text().catch(()=> ''); throw new Error('HTTP '+r.status+(t?(': '+t.slice(0,200)):'')); }
    return r.json();
  }
  function go(path){ history.pushState(null,'',path); route(); }

  // handle logout via fetch so UI doesn't get stuck on JSON
  $('#logoutLink').addEventListener('click', async (e)=>{
    e.preventDefault();
    try { await j('/auth/logout'); location.href='/admin/ui/home'; } catch {}
  });

  document.addEventListener('click',function(e){
    const a = e.target && e.target.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault(); go(a.getAttribute('data-view'));
    }
  });
  window.addEventListener('popstate', route);

  function route(){
    const path = location.pathname.replace(/\\/$/, '');
    setActive(path);

    if (path === '/admin/ui' || path === '/admin/ui/home' || path === '/admin/ui/index.html') return home();
    if (path === '/admin/ui/shows/create') return createShow();
    if (path === '/admin/ui/shows/current') return listShows();
    if (path === '/admin/ui/orders') return orders();
    if (path === '/admin/ui/venues') return venues();

    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')) {
      return seatingPage(path.split('/')[4]);
    }
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')) {
      return editShow(path.split('/')[4]);
    }

    if (path.startsWith('/admin/ui')) return home();
  }

  function home(){
    main.innerHTML = '<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }

  async function uploadPoster(file, showId) {
    const form = new FormData();
    form.append("file", file);
    if (showId) form.append("showId", showId);
    const res = await fetch("/admin/uploads/poster", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) { const t = await res.text(); throw new Error('Upload failed: '+t.slice(0,200)); }
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error||'Upload failed');
    return data;
  }

  function editorToolbarHtml(){
    return '<div class="row" style="gap:6px;margin-bottom:6px">'
      +'<button type="button" class="btn" data-cmd="bold">B</button>'
      +'<button type="button" class="btn" data-cmd="italic"><span style="font-style:italic">I</span></button>'
      +'<button type="button" class="btn" data-cmd="underline"><span style="text-decoration:underline">U</span></button>'
      +'<button type="button" class="btn" data-cmd="insertUnorderedList">• List</button>'
      +'<button type="button" class="btn" data-cmd="insertOrderedList">1. List</button>'
      +'</div>';
  }

  function bindWysiwyg(container){
    const ed = container.querySelector('[data-editor]');
    container.querySelectorAll('[data-cmd]').forEach(b=>{
      b.addEventListener('click', ()=> document.execCommand(b.getAttribute('data-cmd')));
    });
    return ed;
  }

  // ---------- Typeahead for venues ----------
  function attachVenueTypeahead(input){
    input.setAttribute('autocomplete','off');
    input.parentElement.classList.add('typeahead');
    const list = document.createElement('div');
    list.className = 'ta-list';
    input.parentElement.appendChild(list);

    let lastQ = '';
    async function search(q){
      lastQ = q;
      if (!q || q.trim().length < 2) { list.style.display='none'; list.innerHTML=''; return; }
      try{
        const data = await j('/admin/venues?q='+encodeURIComponent(q));
        const items = data.items || [];
        let html = items.map(v=>'<div class="ta-item" data-id="'+v.id+'" data-name="'+(v.name||'')+'">'+(v.name||'')+(v.city?(' – '+v.city):'')+'</div>').join('');
        if (!items.length){
          html += '<div class="ta-item" data-create="'+q+'">➕ Create venue “'+q.replace(/"/g,'&quot;')+'”</div>';
        }
        list.innerHTML = html || '<div class="ta-item" data-create="'+q+'">➕ Create venue “'+q.replace(/"/g,'&quot;')+'”</div>';
        list.style.display = 'block';
      }catch(e){
        list.style.display='none';
      }
    }

    input.addEventListener('input', ()=> search(input.value));
    input.addEventListener('focus', ()=> { if (input.value) search(input.value); });

    list.addEventListener('click', async (e)=>{
      const item = e.target.closest('.ta-item');
      if(!item) return;
      const id = item.getAttribute('data-id');
      const create = item.getAttribute('data-create');
      if (id){
        input.dataset.venueId = id;
        input.value = item.getAttribute('data-name') || input.value;
        list.style.display='none';
      } else if (create){
        // create venue on the fly
        try{
          const r = await j('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: create }) });
          if (r.ok && r.venue){
            input.dataset.venueId = r.venue.id;
            input.value = r.venue.name;
          }
        }catch{}
        list.style.display='none';
      }
    });

    document.addEventListener('click',(e)=>{
      if (!list.contains(e.target) && e.target !== input){ list.style.display='none'; }
    });
  }

  async function createShow(){
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">Create show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><div class="typeahead"><input id="venue_input" placeholder="Start typing a venue…"/><div class="ta-list"></div></div><div class="muted">Pick an existing venue or just type a new one.</div></div>
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <img id="prev" class="imgprev" alt=""/>
          </div>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Description</label>
          \${editorToolbarHtml()}
          <div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>
          <div class="muted">Event description (required). Use the toolbar to format.</div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="save" class="btn p">Save show and add tickets</button>
          <div id="err" class="error"></div>
        </div>
      </div>\`;

    bindWysiwyg(main);
    attachVenueTypeahead($('#venue_input'));

    const drop=$('#drop'), file=$('#file'), prev=$('#prev');
    function choose(){ file.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0]; if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{ const f=file.files && file.files[0]; if(f) await doUpload(f); });

    async function doUpload(f){
      $('#err').textContent='';
      try{
        const out = await uploadPoster(f, null);
        prev.src = out.url; prev.style.display='block';
      }catch(e){ $('#err').textContent = e.message || 'Upload failed'; }
    }

    $('#save').addEventListener('click', async ()=>{
      const payload = {
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueId: $('#venue_input').dataset.venueId || null,
        venueText: $('#venue_input').value.trim(),
        imageUrl: $('#prev').src || null,
        descriptionHtml: $('#desc').innerHTML.trim()
      };
      if(!payload.title || !payload.date || !payload.venueText){
        $('#err').textContent='Title, date/time and venue are required';
        return;
      }

      // if no venueId but user typed a new one, create it first
      if (!payload.venueId && payload.venueText){
        try{
          const r = await j('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: payload.venueText }) });
          if (r.ok && r.venue){ payload.venueId = r.venue.id; }
        }catch{}
      }

      const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok) { $('#err').textContent=r.error||'Failed to create show'; return; }
      go('/admin/ui/shows/current');
    });
  }

  async function listShows(){
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">All events</div><button id="refresh" class="btn">Refresh</button></div>
        <table>
          <thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Total allocation</th><th>Gross face</th><th>Status</th><th></th></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>\`;

    async function load(){
      const jn = await j('/admin/shows');
      const tb = $('#tbody');
      tb.innerHTML = (jn.items||[]).map(s=>{
        const when = s.date ? new Date(s.date).toLocaleString('en-GB',{ dateStyle:'short', timeStyle:'short'}) : '';
        const total = (s._alloc?.total ?? 0);
        const sold = (s._alloc?.sold ?? 0);
        const hold = (s._alloc?.hold ?? 0);
        const avail = Math.max(total - sold - hold, 0);
        const pct = total? Math.round((sold/total)*100) : 0;
        const bar = \`<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px"><div style="background:#111827;height:6px;width:\${pct}%"></div></div>\`;
        return \`
        <tr>
          <td>\${s.title||''}</td>
          <td>\${when}</td>
          <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : (s.venueText||'')}</td>
          <td><span>\${total}</span> <span class="muted">Sold \${sold} · Hold \${hold} · Avail \${avail}</span> \${bar}</td>
          <td>£\${(s._revenue?.grossFace ?? 0).toFixed(2)}</td>
          <td>\${s.status || 'DRAFT'}</td>
          <td><a href="#" data-edit="\${s.id}">Edit</a></td>
        </tr>\`;
      }).join('');
      $$('[data-edit]').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-edit')+'/edit'); }));
    }
    $('#refresh').addEventListener('click', load);
    load();
  }

  async function editShow(id){
    const s = await j('/admin/shows/'+id);
    main.innerHTML = '<div class="card"><div class="title">Edit show '+id+'</div><div class="muted">Coming soon</div></div>';
  }

  function seatingPage(id){ main.innerHTML = '<div class="card"><div class="title">Seating for '+id+'</div><div class="muted">Coming soon</div></div>'; }
  function orders(){ main.innerHTML='<div class="card"><div class="title">Orders</div><div class="muted">Coming soon</div></div>'; }
  function venues(){ main.innerHTML='<div class="card"><div class="title">Venues</div><div class="muted">Use the Venue input on Create Show to add/search.</div></div>'; }

  route();
})();
</script>
</body>
</html>`);
});

export default router;