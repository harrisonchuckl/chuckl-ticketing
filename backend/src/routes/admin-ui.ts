import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/** Single-page admin console at /admin/ui* */
router.get(
  ["/ui", "/ui/", "/ui/home", "/ui/*"],
  requireAdminOrOrganiser,
  (_req, res) => {
    res.set("Cache-Control", "no-store");
    res
      .type("html")
      .send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Organiser Console</title>
<style>
  :root{
    --bg:#f7f8fb;
    --panel:#fff;
    --border:#e5e7eb;
    --text:#111827;
    --muted:#6b7280;
    --ink:#111827;
    --seat-available:#22c55e;
    --seat-blocked:#e5e7eb;
    --seat-held:#fb923c;
    --seat-sold:#0f172a;
  }
  html,body{
    margin:0;
    padding:0;
    height:100%;
    font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
    color:var(--text);
    background:var(--bg);
  }
  .wrap{display:flex;min-height:100vh}
  .sidebar{
    width:220px;
    background:#fff;
    border-right:1px solid var(--border);
    padding:16px 12px;
    position:sticky;
    top:0;
    height:100vh;
    box-sizing:border-box;
  }
  .sb-group{
    font-size:12px;
    letter-spacing:.04em;
    color:var(--muted);
    margin:14px 8px 6px;
    text-transform:uppercase;
  }
  .sb-link{
    display:block;
    padding:10px 12px;
    margin:4px 4px;
    border-radius:8px;
    color:#111827;
    text-decoration:none;
  }
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .sb-sub{margin-left:10px}
  .content{flex:1;padding:20px}
  .card{
    background:var(--panel);
    border:1px solid var(--border);
    border-radius:12px;
    padding:16px;
    margin-bottom:16px;
  }
  .header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    margin-bottom:12px;
    gap:12px;
  }
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{
    appearance:none;
    border:1px solid var(--border);
    background:#fff;
    border-radius:8px;
    padding:8px 12px;
    cursor:pointer;
    font-size:14px;
  }
  .btn:hover{background:#f9fafb}
  .btn.p{
    background:#111827;
    color:#fff;
    border-color:#111827;
  }
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  .grid-4{grid-template-columns:repeat(4,1fr)}
  input,select,textarea{
    border:1px solid var(--border);
    border-radius:8px;
    padding:8px 10px;
    background:#fff;
    outline:none;
    font-size:14px;
  }
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{
    text-align:left;
    padding:10px;
    border-bottom:1px solid var(--border);
    vertical-align:middle;
  }
  th{
    font-weight:600;
    color:#334155;
    background:#f8fafc;
  }
  .error{color:#b91c1c}
  .drop{
    border:2px dashed #cbd5e1;
    border-radius:12px;
    padding:16px;
    text-align:center;
    color:#64748b;
    cursor:pointer;
  }
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{
    max-height:140px;
    border:1px solid var(--border);
    border-radius:8px;
    display:none;
  }
  .progress{
    height:8px;
    background:#e5e7eb;
    border-radius:999px;
    overflow:hidden;
  }
  .bar{height:8px;background:#111827;width:0%}
  .row{display:flex;gap:8px;align-items:center}
  .kbd{
    font:12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    background:#f3f4f6;
    border:1px solid #e5e7eb;
    border-radius:6px;
    padding:2px 6px;
  }
  .kebab{position:relative}
  .menu{
    position:absolute;
    right:0;
    top:28px;
    background:#fff;
    border:1px solid var(--border);
    border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,.08);
    display:none;
    min-width:160px;
    z-index:20;
  }
  .menu.open{display:block}
  .menu a{
    display:block;
    padding:8px 10px;
    text-decoration:none;
    color:#111827;
  }
  .menu a:hover{background:#f8fafc}
  .tip{font-size:12px;color:#64748b;margin-top:4px}
  .pop{
    position:absolute;
    z-index:20;
    background:#fff;
    border:1px solid var(--border);
    border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,.08);
    min-width:260px;
    display:none;
  }
  .pop.open{display:block}
  .opt{padding:8px 10px;cursor:pointer}
  .opt:hover{background:#f8fafc}
  .pill{
    display:inline-block;
    padding:2px 8px;
    border-radius:999px;
    font-size:12px;
    border:1px solid var(--border);
    background:#f9fafb;
  }

  /* Seating map UI */
  .seat-layout-card{
    min-height:260px;
  }
  .seat-layout-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-bottom:8px;
  }
  .seat-stage{
    text-align:center;
    padding:4px 0;
    margin-bottom:8px;
    border-radius:999px;
    background:#0f172a;
    color:#f9fafb;
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.12em;
  }
  .seat-grid-wrap{
    border-radius:12px;
    padding:12px;
    background:#020617;
    display:inline-block;
    max-width:100%;
    overflow-x:auto;
  }
  .seat-grid{
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .seat-row{
    display:flex;
    align-items:center;
    gap:2px;
  }
  .seat-row-label{
    width:18px;
    font-size:11px;
    color:#e5e7eb;
    text-align:right;
    margin-right:4px;
  }
  .seat{
    width:18px;
    height:18px;
    border-radius:4px;
    border:none;
    margin:1px;
    font-size:10px;
    line-height:18px;
    text-align:center;
    cursor:pointer;
    padding:0;
  }
  .seat span{
    display:block;
    width:100%;
    height:100%;
    line-height:18px;
  }
  .seat-status-AVAILABLE{
    background:var(--seat-available);
    color:#022c22;
  }
  .seat-status-BLOCKED{
    background:var(--seat-blocked);
    color:#6b7280;
  }
  .seat-status-HELD{
    background:var(--seat-held);
    color:#7c2d12;
  }
  .seat-status-SOLD{
    background:var(--seat-sold);
    color:#f97316;
    cursor:default;
  }
  .seat-legend{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    font-size:12px;
    margin-top:8px;
  }
  .seat-legend-item{
    display:flex;
    align-items:center;
    gap:4px;
  }
  .seat-legend-swatch{
    width:14px;
    height:14px;
    border-radius:4px;
  }
  .seat-legend-available{background:var(--seat-available)}
  .seat-legend-blocked{background:var(--seat-blocked)}
  .seat-legend-held{background:var(--seat-held)}
  .seat-legend-sold{background:var(--seat-sold)}
  .seat-empty{
    font-size:13px;
    color:#e5e7eb;
    padding:30px 0;
    text-align:center;
  }
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
    <a class="sb-link" href="/auth/logout">Log out</a>
  </aside>
  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const main = $('#main');

  // Sidebar nested menu
  const showsToggle = $('#showsToggle');
  const showsSub = $('#showsSub');
  showsToggle.addEventListener('click', (e)=>{
    e.preventDefault();
    showsSub.style.display = showsSub.style.display==='none'?'block':'none';
  });

  function setActive(path){
    $$('.sb-link').forEach(a=>{
      a.classList.toggle('active', a.getAttribute('data-view')===path);
    });
  }

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    let bodyText='';
    try{ bodyText=await r.text(); }catch(e){}
    if(!r.ok){
      // Try to parse JSON for nicer error, but don't leak raw {"error":"Not found"}
      try{
        const parsed = bodyText ? JSON.parse(bodyText) : null;
        if(parsed && parsed.error) throw new Error(parsed.error);
      }catch(_){}
      throw new Error(bodyText || ('HTTP '+r.status));
    }
    try{ return bodyText? JSON.parse(bodyText):{}; }catch(_){ return {}; }
  }

  function go(path){ history.pushState(null,'',path); route(); }

  // Delegate SPA navigation
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

    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')) return seatingPage(path.split('/')[4]);
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')) return editShow(path.split('/')[4]);
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')) return ticketsPage(path.split('/')[4]);

    if (path.startsWith('/admin/ui')) return home();
  }

  function home(){
    main.innerHTML = '<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }

  // ---------- Venues (search + inline create) ----------
  async function searchVenues(q){
    if(!q) return [];
    try {
      const out = await j('/admin/venues?q='+encodeURIComponent(q));
      return out.items||[];
    } catch(e){
      return [];
    }
  }

  function mountVenuePicker(input){
    const container = document.createElement('div');
    container.style.position = 'relative';
    input.parentNode.insertBefore(container, input);
    container.appendChild(input);

    const pop = document.createElement('div');
    pop.className = 'pop';
    container.appendChild(pop);

    function close(){ pop.classList.remove('open'); }
    function render(list,q){
      pop.innerHTML='';
      if(list.length){
        list.forEach(v=>{
          const el=document.createElement('div');
          el.className='opt';
          el.textContent=v.name+(v.city?(' — '+v.city):'');
          el.addEventListener('click',()=>{
            input.value=v.name;
            input.dataset.venueId=v.id;
            close();
          });
          pop.appendChild(el);
        });
      }
      if(q && !list.some(v=>(v.name||'').toLowerCase()===q.toLowerCase())){
        const add=document.createElement('div');
        add.className='opt';
        add.innerHTML='➕ Create venue “'+q+'”';
        add.addEventListener('click', async ()=>{
          try{
            const created = await j('/admin/venues', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ name: q })
            });
            if(created && created.ok && created.venue){
              input.value = created.venue.name;
              input.dataset.venueId = created.venue.id;
            }else{
              alert('Failed to create venue');
            }
          }catch(err){
            alert('Create failed: '+(err.message||err));
          }
          close();
        });
        pop.appendChild(add);
      }
      if(pop.children.length){ pop.classList.add('open'); } else { close(); }
    }

    input.addEventListener('input', async ()=>{
      input.dataset.venueId='';
      const q=input.value.trim();
      if(!q){ close(); return; }
      render(await searchVenues(q), q);
    });
    input.addEventListener('focus', async ()=>{
      const q=input.value.trim();
      if(!q) return;
      render(await searchVenues(q), q);
    });
    document.addEventListener('click', (e)=>{
      if(!pop.contains(e.target) && e.target!==input) close();
    });
  }

  // ---------- Upload helper ----------
  async function uploadPoster(file){
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/admin/uploads', { method:'POST', body: form, credentials:'include' });
    const txt = await res.text();
    if(!res.ok) throw new Error(txt || ('HTTP '+res.status));
    const data = txt ? JSON.parse(txt) : {};
    if(!data.ok || !data.url) throw new Error('Unexpected upload response');
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
    container.querySelectorAll('[data-cmd]').forEach(b=>{
      b.addEventListener('click', ()=> document.execCommand(b.getAttribute('data-cmd')));
    });
  }

  // ---------- Create show ----------
  async function createShow(){
    main.innerHTML=\`
      <div class="card">
        <div class="header"><div class="title">Create show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><input id="venue_input" placeholder="Start typing a venue…"/><div class="tip">Pick an existing venue or just type a new one.</div></div>
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div class="row" style="margin-top:8px;gap:8px;align-items:center"><img id="prev" class="imgprev" alt=""/></div>
          </div>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Description</label>\${editorToolbarHtml()}
          <div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>
          <div class="muted">Event description (required). Use the toolbar to format.</div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="save" class="btn p">Save show and add tickets</button>
          <div id="err" class="error"></div>
        </div>
      </div>\`;

    bindWysiwyg(main);
    mountVenuePicker($('#venue_input'));

    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev');
    drop.addEventListener('click', ()=> file.click());
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault();
      drop.classList.remove('drag');
      const f=e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{
      const f=file.files&&file.files[0];
      if(f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out=await uploadPoster(f);
        prev.src=out.url;
        prev.style.display='block';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%',800);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent='Upload failed: '+(e.message||e);
      }
    }

    $('#save').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const payload={
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueText: $('#venue_input').value.trim(),
          venueId: $('#venue_input').dataset.venueId || null,
          imageUrl: $('#prev').src || null,
          descriptionHtml: $('#desc').innerHTML.trim()
        };
        if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
          throw new Error('Title, date/time, venue and description are required');
        }
        const r = await j('/admin/shows',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(r && r.ok && r.id){
          go('/admin/ui/shows/'+r.id+'/tickets');
        } else {
          throw new Error((r && r.error)||'Failed to create show');
        }
      }catch(e){
        $('#err').textContent=e.message||String(e);
      }
    });
  }

  // ---------- Shows list ----------
  async function listShows(){
    main.innerHTML=\`
      <div class="card">
        <div class="header">
          <div class="title">All events</div>
          <button id="refresh" class="btn">Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>When</th>
              <th>Venue</th>
              <th>Total allocation</th>
              <th>Gross face</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>\`;

    async function load(){
      $('#tbody').innerHTML='<tr><td colspan="7" class="muted">Loading…</td></tr>';
      try{
        const jn = await j('/admin/shows');
        const items = jn.items || [];
        const tb=$('#tbody');
        tb.innerHTML = items.map(s=>{
          const when = s.date ? new Date(s.date).toLocaleString('en-GB',{ dateStyle:'short', timeStyle:'short'}) : '';
          const total = (s._alloc?.total ?? 0),
                sold=(s._alloc?.sold ?? 0),
                hold=(s._alloc?.hold ?? 0),
                avail=Math.max(total-sold-hold,0);
          const pct = total? Math.round((sold/total)*100):0;
          const bar = '<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px"><div style="background:#111827;height:6px;width:'+pct+'%"></div></div>';
          return '<tr>'
            +'<td>'+(s.title||'')+'</td>'
            +'<td>'+when+'</td>'
            +'<td>'+(s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : '')+'</td>'
            +'<td><span class="muted">Sold '+sold+' · Hold '+hold+' · Avail '+avail+'</span> '+bar+'</td>'
            +'<td>£'+((s._revenue?.grossFace ?? 0).toFixed(2))+'</td>'
            +'<td>'+(s.status || 'DRAFT')+'</td>'
            +'<td><div class="kebab">'
              +'<button class="btn" data-kebab="'+s.id+'">⋮</button>'
              +'<div class="menu" id="m-'+s.id+'">'
                +'<a href="#" data-edit="'+s.id+'">Edit</a>'
                +'<a href="#" data-seating="'+s.id+'">Seating map</a>'
                +'<a href="#" data-tickets="'+s.id+'">Tickets</a>'
                +'<a href="#" data-dup="'+s.id+'">Duplicate</a>'
              +'</div></div></td>'
            +'</tr>';
        }).join('') || '<tr><td colspan="7" class="muted">No shows yet</td></tr>';

        $$('[data-kebab]').forEach(b=>{
          b.addEventListener('click', (e)=>{
            e.preventDefault();
            const id=b.getAttribute('data-kebab');
            const m=$('#m-'+id);
            $$('.menu').forEach(x=>x.classList.remove('open'));
            m.classList.add('open');
          });
        });
        document.addEventListener('click',(e)=>{
          if(!e.target.closest('.kebab')) $$('.menu').forEach(x=>x.classList.remove('open'));
        });

        $$('[data-edit]').forEach(a=>a.addEventListener('click',(e)=>{
          e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-edit')+'/edit');
        }));
        $$('[data-seating]').forEach(a=>a.addEventListener('click',(e)=>{
          e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-seating')+'/seating');
        }));
        $$('[data-tickets]').forEach(a=>a.addEventListener('click',(e)=>{
          e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-tickets')+'/tickets');
        }));
        $$('[data-dup]').forEach(a=>a.addEventListener('click', async (e)=>{
          e.preventDefault();
          try{
            const id=a.getAttribute('data-dup');
            const r=await j('/admin/shows/'+id+'/duplicate',{method:'POST'});
            if(r.ok && r.newId){ go('/admin/ui/shows/'+r.newId+'/edit'); }
          }catch(e){
            alert('Duplicate failed: '+(e.message||e));
          }
        }));
      }catch(e){
        $('#tbody').innerHTML='<tr><td colspan="7" class="error">Failed to load shows: '+(e.message||e)+'</td></tr>';
      }
    }
    $('#refresh').addEventListener('click', load);
    load();
  }

  // ---------- Edit show ----------
  async function editShow(id){
    let s=null;
    try{
      s=await j('/admin/shows/'+id);
    }catch(e){
      main.innerHTML='<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    main.innerHTML=\`
      <div class="card">
        <div class="header"><div class="title">Edit show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><input id="venue_input"/></div>
          <div class="grid"><label>Poster image</label>
            <div class="drop" id="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <img id="prev" class="imgprev" />
          </div>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Description</label>\${editorToolbarHtml()}
          <div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>
          <div class="muted">Event description (required). Use the toolbar to format.</div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="save" class="btn p">Save changes</button>
          <a class="btn" href="#" id="goSeating">Seating map</a>
          <a class="btn" href="#" id="goTickets">Tickets</a>
          <div id="err" class="error"></div>
        </div>
      </div>\`;

    bindWysiwyg(main);
    mountVenuePicker($('#venue_input'));

    $('#sh_title').value = s.item?.title ?? '';
    $('#venue_input').value = s.item?.venue?.name || s.item?.venueText || '';
    if (s.item?.date) {
      const dt = new Date(s.item.date);
      const iso = dt.toISOString().slice(0,16);
      $('#sh_dt').value = iso;
    }
    $('#desc').innerHTML = s.item?.description || '';
    if (s.item?.imageUrl) {
      $('#prev').src = s.item.imageUrl;
      $('#prev').style.display='block';
    }

    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev');
    drop.addEventListener('click', ()=> file.click());
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault();
      drop.classList.remove('drag');
      const f=e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{
      const f=file.files&&file.files[0];
      if(f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out=await uploadPoster(f);
        prev.src=out.url;
        prev.style.display='block';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%',800);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent='Upload failed: '+(e.message||e);
      }
    }

    $('#goSeating').addEventListener('click',(e)=>{
      e.preventDefault(); go('/admin/ui/shows/'+id+'/seating');
    });
    $('#goTickets').addEventListener('click',(e)=>{
      e.preventDefault(); go('/admin/ui/shows/'+id+'/tickets');
    });

    $('#save').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueText: $('#venue_input').value.trim(),
          venueId: $('#venue_input').dataset.venueId || null,
          imageUrl: $('#prev').src || null,
          descriptionHtml: $('#desc').innerHTML.trim()
        };
        if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
          throw new Error('Title, date/time, venue and description are required');
        }
        const r = await j('/admin/shows/'+id,{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(r && r.ok){ alert('Saved'); }
        else { throw new Error((r && r.error)||'Failed to save'); }
      }catch(e){
        $('#err').textContent=e.message||String(e);
      }
    });
  }

  // ---------- Tickets for a show ----------
  async function ticketsPage(id){
    main.innerHTML = '<div class="card"><div class="title">Loading tickets…</div></div>';
    let showResp;
    try {
      showResp = await j('/admin/shows/'+id);
    } catch (e) {
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    const show = showResp.item || {};
    const when = show.date ? new Date(show.date).toLocaleString('en-GB',{ dateStyle:'full', timeStyle:'short'}) : '';
    const venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : ''))
      : (show.venueText || '');

    main.innerHTML = \`
      <div class="card">
        <div class="header">
          <div>
            <div class="title">Tickets for \${show.title || 'Untitled show'}</div>
            <div class="muted">\${when ? when + ' · ' : ''}\${venueName}</div>
          </div>
          <div class="row">
            <button class="btn" id="backToShows">Back to all events</button>
            <button class="btn" id="editShowBtn">Edit show</button>
          </div>
        </div>

        <div class="grid grid-2" style="margin-bottom:16px">
          <div class="card" style="margin:0">
            <div class="title" style="margin-bottom:4px">Ticket structure</div>
            <div class="muted" style="margin-bottom:8px">
              Tickets can be free (price £0) or paid, and can be sold as general admission or allocated seating.
            </div>
            <div class="row" style="margin-bottom:8px">
              <span class="pill" id="structureGeneral">General admission</span>
              <span class="pill" id="structureAllocated">Allocated seating</span>
            </div>
            <div class="muted" style="font-size:12px">
              Allocated seating uses a seating map for this venue. You can reuse an existing map or create a new one just for this show.
            </div>
          </div>

          <div class="card" style="margin:0">
            <div class="title" style="margin-bottom:4px">Seat maps for this show</div>
            <div class="muted" id="seatMapsSummary">Loading seat maps…</div>
            <div id="seatMapsList" style="margin-top:8px"></div>
            <div class="row" style="margin-top:8px">
              <button class="btn" id="refreshSeatMaps">Refresh seat maps</button>
              <button class="btn" id="editSeatMaps">Create / edit seat map</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin:0">
          <div class="header">
            <div class="title">Ticket types</div>
            <button class="btn" id="addTypeBtn">Add ticket type</button>
          </div>
          <div class="muted" style="margin-bottom:8px">
            Set up the tickets you want to sell for this show. A £0 price will be treated as a free ticket.
          </div>
          <div id="ticketTypesEmpty" class="muted" style="display:none">No ticket types yet. Use “Add ticket type” to create one.</div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ticketTypesBody">
              <tr><td colspan="4" class="muted">Loading…</td></tr>
            </tbody>
          </table>

          <div id="addTypeForm" style="margin-top:12px;display:none">
            <div class="grid grid-3">
              <div class="grid"><label>Name</label><input id="tt_name" placeholder="e.g. Standard" /></div>
              <div class="grid"><label>Price (£)</label><input id="tt_price" type="number" min="0" step="0.01" placeholder="e.g. 15" /></div>
              <div class="grid"><label>Available (optional)</label><input id="tt_available" type="number" min="0" step="1" placeholder="Leave blank for unlimited" /></div>
            </div>
            <div class="row" style="margin-top:8px">
              <button class="btn p" id="tt_save">Save ticket type</button>
              <button class="btn" id="tt_cancel">Cancel</button>
              <div id="tt_err" class="error"></div>
            </div>
          </div>
        </div>
      </div>\`;

    $('#backToShows').addEventListener('click', ()=> go('/admin/ui/shows/current'));
    $('#editShowBtn').addEventListener('click', ()=> go('/admin/ui/shows/'+id+'/edit'));

    // Ticket types UI
    const addTypeForm = $('#addTypeForm');
    const ticketTypesBody = $('#ticketTypesBody');
    const ticketTypesEmpty = $('#ticketTypesEmpty');

    $('#addTypeBtn').addEventListener('click', ()=>{
      addTypeForm.style.display='block';
      $('#tt_name').focus();
    });
    $('#tt_cancel').addEventListener('click', ()=>{
      addTypeForm.style.display='none';
      $('#tt_err').textContent='';
    });

    async function loadTicketTypes(){
      try{
        const res = await j('/admin/shows/'+id+'/ticket-types');
        const items = res.ticketTypes || [];
        if(!items.length){
          ticketTypesBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet.</td></tr>';
          ticketTypesEmpty.style.display = 'block';
        } else {
          ticketTypesEmpty.style.display = 'none';
          ticketTypesBody.innerHTML = items.map(tt=>{
            const price = (tt.pricePence ?? 0) / 100;
            const priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
            const availLabel = tt.available == null ? 'Unlimited' : String(tt.available);
            return '<tr>'
              +'<td>'+ (tt.name || '') +'</td>'
              +'<td>'+ priceLabel +'</td>'
              +'<td>'+ availLabel +'</td>'
              +'<td><button class="btn" data-del="'+tt.id+'">Delete</button></td>'
              +'</tr>';
          }).join('');
          $$('[data-del]', ticketTypesBody).forEach(btn=>{
            btn.addEventListener('click', async (e)=>{
              e.preventDefault();
              const idToDel = btn.getAttribute('data-del');
              if(!idToDel) return;
              if(!confirm('Delete this ticket type?')) return;
              try{
                await j('/admin/ticket-types/'+idToDel, { method:'DELETE' });
                loadTicketTypes();
              }catch(err){
                alert('Failed to delete: '+(err.message||err));
              }
            });
          });
        }
      }catch(e){
        ticketTypesBody.innerHTML = '<tr><td colspan="4" class="error">Failed to load ticket types: '+(e.message||e)+'</td></tr>';
      }
    }

    $('#tt_save').addEventListener('click', async ()=>{
      $('#tt_err').textContent='';
      const name = $('#tt_name').value.trim();
      const priceStr = $('#tt_price').value.trim();
      const availStr = $('#tt_available').value.trim();

      if(!name){
        $('#tt_err').textContent='Name is required';
        return;
      }

      let pricePence = 0;
      if(priceStr){
        const p = Number(priceStr);
        if(!Number.isFinite(p) || p < 0){
          $('#tt_err').textContent='Price must be a non-negative number';
          return;
        }
        pricePence = Math.round(p * 100);
      }

      let available = null;
      if(availStr){
        const a = Number(availStr);
        if(!Number.isFinite(a) || a < 0){
          $('#tt_err').textContent='Available must be a non-negative number';
          return;
        }
        available = a;
      }

      try{
        await j('/admin/shows/'+id+'/ticket-types', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name, pricePence, available })
        });
        $('#tt_name').value='';
        $('#tt_price').value='';
        $('#tt_available').value='';
        addTypeForm.style.display='none';
        loadTicketTypes();
      }catch(err){
        $('#tt_err').textContent = err.message || String(err);
      }
    });

    loadTicketTypes();

    // Seat maps summary for this show
    const seatMapsSummary = $('#seatMapsSummary');
    const seatMapsList = $('#seatMapsList');
    const venueId = show.venue?.id || null;

    async function loadSeatMaps(){
      seatMapsSummary.textContent = 'Loading seat maps…';
      seatMapsList.innerHTML = '';
      try{
        let url = '/admin/seatmaps?showId='+encodeURIComponent(id);
        if(venueId) url += '&venueId='+encodeURIComponent(venueId);
        const maps = await j(url);
        if(!Array.isArray(maps) || !maps.length){
          seatMapsSummary.textContent = 'No seat maps yet for this show/venue.';
          seatMapsList.innerHTML = '<div class="muted" style="font-size:13px">You can create a seat map using the “Create / edit seat map” button.</div>';
          return;
        }
        seatMapsSummary.textContent = maps.length + ' seat map'+(maps.length>1?'s':'')+' found.';
        seatMapsList.innerHTML = maps.map(m=>{
          const def = m.isDefault ? ' · <strong>Default</strong>' : '';
          return '<div class="row" style="margin-bottom:4px;justify-content:space-between">'
            +'<div><strong>'+m.name+'</strong> <span class="muted">v'+(m.version||1)+'</span>'+def+'</div>'
            +'<div class="row" style="gap:4px">'
            +(!m.isDefault ? '<button class="btn" data-make-default="'+m.id+'">Make default</button>' : '')
            +'</div>'
            +'</div>';
        }).join('');

        $$('[data-make-default]', seatMapsList).forEach(btn=>{
          btn.addEventListener('click', async (e)=>{
            e.preventDefault();
            const mapId = btn.getAttribute('data-make-default');
            if(!mapId) return;
            try{
              await j('/admin/seatmaps/'+mapId+'/default', {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ isDefault: true })
              });
              loadSeatMaps();
            }catch(err){
              alert('Failed to update default: '+(err.message||err));
            }
          });
        });
      }catch(e){
        seatMapsSummary.textContent = 'Failed to load seat maps.';
        seatMapsList.innerHTML = '<div class="error" style="font-size:13px">'+(e.message||e)+'</div>';
      }
    }

    $('#refreshSeatMaps').addEventListener('click', loadSeatMaps);
    $('#editSeatMaps').addEventListener('click', ()=> go('/admin/ui/shows/'+id+'/seating'));

    loadSeatMaps();
  }

  // ---------- Seating editor ----------
  async function seatingPage(showId){
    main.innerHTML = '<div class="card"><div class="title">Loading seating…</div></div>';

    let showResp;
    try{
      showResp = await j('/admin/shows/'+showId);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    const show = showResp.item || {};
    const when = show.date ? new Date(show.date).toLocaleString('en-GB',{ dateStyle:'full', timeStyle:'short'}) : '';
    const venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : ''))
      : (show.venueText || '');
    const venueId = show.venue?.id || null;

    main.innerHTML = \`
      <div class="card">
        <div class="header">
          <div>
            <div class="title">Seating map for \\${show.title || 'Untitled show'}</div>
            <div class="muted">\\${when ? when + ' · ' : ''}\\${venueName || 'No venue set yet'}</div>
          </div>
          <div class="row">
            <button class="btn" id="backToTickets">Back to tickets</button>
            <button class="btn" id="editShowBtn">Edit show</button>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="grid" style="align-content:flex-start;gap:12px">
            <div class="card" style="margin:0">
              <div class="title" style="margin-bottom:4px">Seat maps for this show</div>
              <div class="muted" style="font-size:13px;margin-bottom:8px" id="seatMapsMsg">Loading seat maps…</div>
              <select id="seatMapSelect" style="width:100%;margin-bottom:8px">
                <option value="">No seat map selected</option>
              </select>
              <div class="muted" style="font-size:12px;margin-bottom:8px">
                Seat maps are stored per show and can optionally be linked to a venue.
              </div>
              <div class="grid" style="margin-top:4px">
                <label>Create new seat map</label>
                <input id="newSeatMapName" placeholder="e.g. Stalls layout" />
                <button class="btn p" id="createSeatMapBtn">Create seat map</button>
              </div>
              <div id="seatMapErr" class="error" style="margin-top:6px"></div>
            </div>

            <div class="card" style="margin:0">
              <div class="title" style="margin-bottom:4px">Quick seat generator</div>
              <div class="muted" style="font-size:13px;margin-bottom:8px">
                Fast way to create a basic rectangular layout. You can then tweak individual seats.
              </div>
              <div class="grid grid-2">
                <div class="grid">
                  <label>Rows</label>
                  <input id="q_rows" type="number" min="1" max="40" value="5" />
                </div>
                <div class="grid">
                  <label>Seats per row</label>
                  <input id="q_perRow" type="number" min="1" max="60" value="10" />
                </div>
              </div>
              <div class="grid" style="margin-top:8px">
                <label>Row labels</label>
                <select id="q_rowLabels">
                  <option value="letters">A, B, C…</option>
                  <option value="numbers">1, 2, 3…</option>
                </select>
              </div>
              <div class="grid" style="margin-top:8px">
                <label>Seat type</label>
                <select id="q_seatType">
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="RESTRICTED">Restricted view</option>
                  <option value="ACCESS">Accessible</option>
                  <option value="CARER">Carer</option>
                </select>
              </div>
              <div class="grid" style="margin-top:8px">
                <label>Level (optional)</label>
                <input id="q_level" placeholder="e.g. Stalls, Circle" />
              </div>
              <div class="row" style="margin-top:10px">
                <button class="btn p" id="generateSeatsBtn">Generate seats</button>
                <div id="q_err" class="error"></div>
              </div>
              <div class="tip" style="margin-top:6px">
                For complex layouts (boxes, walkways, balcony) you can generate a base and then refine seat-by-seat.
              </div>
            </div>
          </div>

          <div class="card seat-layout-card" style="margin:0">
            <div class="seat-layout-header">
              <div>
                <div class="title">Seat layout</div>
                <div class="muted" id="seatLayoutSub">No seat map selected.</div>
              </div>
              <div class="row" style="gap:6px;font-size:12px">
                <label class="row" style="gap:4px">
                  <input type="checkbox" id="toggleNumbers" checked />
                  <span>Show seat numbers</span>
                </label>
              </div>
            </div>
            <div class="seat-stage">Stage</div>
            <div id="seatGridWrap" class="seat-grid-wrap">
              <div id="seatGrid" class="seat-grid">
                <div class="seat-empty">Select or create a seat map on the left.</div>
              </div>
            </div>
            <div class="seat-legend">
              <div class="seat-legend-item">
                <div class="seat-legend-swatch seat-legend-available"></div><span>Available</span>
              </div>
              <div class="seat-legend-item">
                <div class="seat-legend-swatch seat-legend-blocked"></div><span>Blocked / no seat</span>
              </div>
              <div class="seat-legend-item">
                <div class="seat-legend-swatch seat-legend-held"></div><span>Held</span>
              </div>
              <div class="seat-legend-item">
                <div class="seat-legend-swatch seat-legend-sold"></div><span>Sold (read-only)</span>
              </div>
            </div>
          </div>
        </div>
      </div>\`;

    $('#backToTickets').addEventListener('click', ()=> go('/admin/ui/shows/'+showId+'/tickets'));
    $('#editShowBtn').addEventListener('click', ()=> go('/admin/ui/shows/'+showId+'/edit'));

    const seatMapsMsg = $('#seatMapsMsg');
    const seatMapSelect = $('#seatMapSelect');
    const seatMapErr = $('#seatMapErr');
    const newSeatMapName = $('#newSeatMapName');
    const createSeatMapBtn = $('#createSeatMapBtn');

    const q_rows = $('#q_rows');
    const q_perRow = $('#q_perRow');
    const q_rowLabels = $('#q_rowLabels');
    const q_seatType = $('#q_seatType');
    const q_level = $('#q_level');
    const q_err = $('#q_err');
    const generateSeatsBtn = $('#generateSeatsBtn');

    const seatGrid = $('#seatGrid');
    const seatLayoutSub = $('#seatLayoutSub');
    const toggleNumbers = $('#toggleNumbers');

    let currentSeatMapId = '';
    let currentSeats = [];
    let showNumbers = true;

    function loadShowNumbersPreference(mapId){
      const key = 'seatmap_showNumbers_'+mapId;
      const val = localStorage.getItem(key);
      if(val === null) return true;
      return val === '1';
    }
    function saveShowNumbersPreference(mapId, value){
      const key = 'seatmap_showNumbers_'+mapId;
      localStorage.setItem(key, value ? '1' : '0');
    }

    function renderSeatGrid(){
      if(!currentSeatMapId){
        seatGrid.innerHTML = '<div class="seat-empty">Select or create a seat map on the left.</div>';
        return;
      }
      if(!currentSeats.length){
        seatGrid.innerHTML = '<div class="seat-empty">No seats yet. Use the quick generator or add seats via tools.</div>';
        return;
      }

      const byRow = {};
      currentSeats.forEach(s=>{
        if(!byRow[s.row]) byRow[s.row]=[];
        byRow[s.row].push(s);
      });

      const rows = Object.keys(byRow).sort().map(k=>{
        const list = byRow[k].slice().sort((a,b)=>a.number - b.number);
        return { key:k, seats:list };
      });

      seatGrid.innerHTML = '';
      rows.forEach(r=>{
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'seat-row-label';
        labelDiv.textContent = r.seats[0]?.rowLabel || r.key;
        rowDiv.appendChild(labelDiv);

        r.seats.forEach(seat=>{
          const btn = document.createElement('button');
          btn.className = 'seat seat-status-'+seat.status;
          btn.dataset.seatId = seat.id;
          btn.dataset.status = seat.status;
          const span = document.createElement('span');
          span.textContent = showNumbers ? (seat.seatNumber ?? seat.number ?? '') : '';
          btn.appendChild(span);
          rowDiv.appendChild(btn);
        });

        seatGrid.appendChild(rowDiv);
      });

      bindSeatClicks();
    }

    function bindSeatClicks(){
      const cycle = {
        'AVAILABLE':'BLOCKED',
        'BLOCKED':'HELD',
        'HELD':'AVAILABLE',
        'SOLD':'SOLD'
      };
      $$('.seat', seatGrid).forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const seatId = btn.dataset.seatId;
          const cur = btn.dataset.status || 'AVAILABLE';
          if(cur === 'SOLD') return;
          const next = cycle[cur] || 'AVAILABLE';
          btn.disabled = true;
          try{
            const updated = await j('/seatmaps/seat/'+encodeURIComponent(seatId)+'/status', {
              method:'PATCH',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ status: next })
            });
            btn.dataset.status = updated.status;
            btn.className = 'seat seat-status-'+updated.status;
          }catch(e){
            alert('Failed to update seat: '+(e.message||e));
          }finally{
            btn.disabled = false;
          }
        });
      });
    }

    toggleNumbers.addEventListener('change', ()=>{
      if(!currentSeatMapId) return;
      showNumbers = toggleNumbers.checked;
      saveShowNumbersPreference(currentSeatMapId, showNumbers);
      renderSeatGrid();
    });

    async function loadSeatMaps(){
      seatMapsMsg.textContent = 'Loading seat maps…';
      seatMapSelect.innerHTML = '<option value="">No seat map selected</option>';
      seatMapErr.textContent = '';
      try{
        let url = '/admin/seatmaps?showId='+encodeURIComponent(showId);
        if(venueId) url += '&venueId='+encodeURIComponent(venueId);
        const maps = await j(url);
        if(!Array.isArray(maps) || !maps.length){
          seatMapsMsg.textContent = 'No seat maps yet. Create one to get started.';
          currentSeatMapId = '';
          currentSeats = [];
          renderSeatGrid();
          return;
        }
        seatMapsMsg.textContent = maps.length + ' seat map'+(maps.length>1?'s':'')+' for this show.';
        seatMapSelect.innerHTML = '<option value="">Select a seat map…</option>'
          + maps.map(m=>'<option value="'+m.id+'">'+m.name+' (v'+(m.version||1)+ (m.isDefault ? ', default' : '')+')</option>').join('');

        const def = maps.find(m=>m.isDefault) || maps[0];
        seatMapSelect.value = def.id;
        await loadSeatsForMap(def.id, def.name);
      }catch(e){
        seatMapsMsg.textContent = 'Failed to load seat maps.';
        seatMapErr.textContent = e.message || String(e);
        currentSeatMapId = '';
        currentSeats = [];
        renderSeatGrid();
      }
    }

    async function loadSeatsForMap(mapId, mapName){
      if(!mapId){
        currentSeatMapId = '';
        currentSeats = [];
        seatLayoutSub.textContent = 'No seat map selected.';
        renderSeatGrid();
        return;
      }
      try{
        const seats = await j('/seatmaps/'+encodeURIComponent(mapId)+'/seats');
        currentSeatMapId = mapId;
        currentSeats = seats || [];
        showNumbers = loadShowNumbersPreference(mapId);
        toggleNumbers.checked = showNumbers;
        seatLayoutSub.textContent = (mapName || 'Seat map') + ' · '+(currentSeats.length)+' seats';
        renderSeatGrid();
      }catch(e){
        seatMapErr.textContent = e.message || String(e);
        currentSeatMapId = '';
        currentSeats = [];
        renderSeatGrid();
      }
    }

    seatMapSelect.addEventListener('change', async ()=>{
      const id = seatMapSelect.value || '';
      const label = seatMapSelect.options[seatMapSelect.selectedIndex]?.text || '';
      await loadSeatsForMap(id, label);
    });

    createSeatMapBtn.addEventListener('click', async ()=>{
      seatMapErr.textContent = '';
      const name = newSeatMapName.value.trim();
      if(!name){
        seatMapErr.textContent = 'Name is required';
        return;
      }
      try{
        const payload = {
          showId: showId,
          name,
          venueId: venueId || undefined,
          isDefault: true
        };
        await j('/admin/seatmaps', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        newSeatMapName.value='';
        await loadSeatMaps();
      }catch(e){
        seatMapErr.textContent = e.message || String(e);
      }
    });

    generateSeatsBtn.addEventListener('click', async ()=>{
      q_err.textContent='';
      if(!currentSeatMapId){
        q_err.textContent='Select or create a seat map first.';
        return;
      }
      const rows = Number(q_rows.value || '0');
      const perRow = Number(q_perRow.value || '0');
      if(!rows || !perRow){
        q_err.textContent='Rows and seats per row are required.';
        return;
      }
      if(rows<1 || perRow<1){
        q_err.textContent='Rows and seats per row must be at least 1.';
        return;
      }

      const labelMode = q_rowLabels.value;
      const seatType = q_seatType.value || 'STANDARD';
      const level = q_level.value.trim() || undefined;

      const seatsPayload = [];
      for(let r=0;r<rows;r++){
        let rowLabel;
        if(labelMode==='numbers'){
          rowLabel = String(r+1);
        }else{
          // letters
          rowLabel = String.fromCharCode(65 + (r % 26)); // A-Z then repeat
        }
        const rowKey = rowLabel;
        for(let c=0;c<perRow;c++){
          const seatNumber = c+1;
          seatsPayload.push({
            row: rowKey,
            number: seatNumber,
            rowLabel,
            seatNumber,
            label: rowLabel+seatNumber,
            kind: seatType,
            level
          });
        }
      }

      try{
        await j('/seatmaps/'+encodeURIComponent(currentSeatMapId)+'/seats/bulk', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ seats: seatsPayload })
        });
        await loadSeatsForMap(currentSeatMapId, seatMapSelect.options[seatMapSelect.selectedIndex]?.text || '');
      }catch(e){
        q_err.textContent = e.message || String(e);
      }
    });

    loadSeatMaps();
  }

  // ---------- Other sections (stubs) ----------
  function orders(){
    main.innerHTML='<div class="card"><div class="title">Orders</div><div class="muted">Coming soon</div></div>';
  }
  function venues(){
    main.innerHTML='<div class="card"><div class="title">Venues</div><div class="muted">Use the venue picker in Create Show to add/search venues.</div></div>';
  }

  // Boot
  route();
})();
</script>
</body>
</html>`);
  }
);

export default router;
