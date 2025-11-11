// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// Serve the SPA shell for /admin/ui, /admin/ui/home, and any /admin/ui/*
router.get(['/ui', '/ui/', '/ui/home', '/ui/*'], requireAdminOrOrganiser, async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Organiser Console</title>
<style>
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--ink:#111827}
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
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
  .grid-4{grid-template-columns:repeat(4,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px;display:none}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .row{display:flex;gap:8px;align-items:center}
  .kbd{font:12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
  .canvasWrap{position:relative;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff}
  .canvasToolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .pill{padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:#fff}
  .stat{font-weight:600}
  .kebab{position:relative}
  .menu{position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);display:none;min-width:160px}
  .menu.open{display:block}
  .menu a{display:block;padding:8px 10px;text-decoration:none;color:#111827}
  .menu a:hover{background:#f8fafc}
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
  // Tiny error banner so issues are visible on mobile
  window.addEventListener('error', function(e){
    var el=document.createElement('pre');
    el.textContent='JS error: '+(e.message || '');
    el.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;background:#fee;border:1px solid #fca5a5;color:#991b1b;padding:8px;border-radius:8px;z-index:99999;white-space:pre-wrap';
    document.body.appendChild(el);
  });

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
    if(!r.ok){
      const t=await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(t?(': '+t.slice(0,200)):'')); 
    }
    return r.json();
  }
  function go(path){ history.pushState(null,'',path); route(); }

  // Delegate menu clicks
  document.addEventListener('click',function(e){
    const a = e.target && e.target.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault();
      go(a.getAttribute('data-view'));
    }
  });
  window.addEventListener('popstate', route);

  function route(){
    const path = location.pathname.replace(/\\/?$/, ''); // trim trailing slash if present
    setActive(path);
    if(path==='/admin/ui/home') return home();
    if(path==='/admin/ui/shows/create') return createShow();
    if(path==='/admin/ui/shows/current') return listShows();
    if(/^\\/admin\\/ui\\/orders$/.test(path)) return orders();
    if(/^\\/admin\\/ui\\/venues$/.test(path)) return venues();

    // FIXED: correct matchers (slashes escaped once inside the string sent to browser)
    if(/^\\/admin\\/ui\\/shows\\/[^/]+\\/seating$/.test(path)) return seatingPage(path.split('/')[4]);
    if(/^\\/admin\\/ui\\/shows\\/[^/]+\\/edit$/.test(path)) return editShow(path.split('/')[4]);

    // default
    if(path.startsWith('/admin/ui')) return home();
  }

  function home(){
    main.innerHTML = '<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }

  // -------- Create / Edit show (shell only) --------
  async function uploadPoster(file) {
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) { const t = await res.text(); throw new Error('Upload failed: '+t.slice(0,200)); }
    const data = await res.json(); if (!data?.ok) throw new Error(data?.error||'Upload failed'); return data;
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

  async function createShow(){
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">Create show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><input id="venue_input" placeholder="Start typing a venue…"/></div>
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div class="row" style="margin-top:8px;gap:8px;align-items:center">
              <img id="prev" class="imgprev" alt=""/>
            </div>
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

    // poster upload
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev');
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
      $('#err').textContent=''; bar.style.width='15%';
      try{ const out = await uploadPoster(f); prev.src = out.url; prev.style.display='block'; bar.style.width='100%'; setTimeout(()=>bar.style.width='0%',800);}
      catch(e){ bar.style.width='0%'; $('#err').textContent=e.message||'Upload failed'; }
    }

    $('#save').addEventListener('click', async ()=>{
      const payload = {
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueText: $('#venue_input').value.trim(),
        imageUrl: prev.src || null,
        descriptionHtml: $('#desc').innerHTML.trim()
      };
      if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
        $('#err').textContent='Title, date/time, venue and description are required';
        return;
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
          <td>\${s.title}</td>
          <td>\${when}</td>
          <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : ''}</td>
          <td><span class="pill">\${total} total</span> <span class="muted">Sold \${sold} · Hold \${hold} · Avail \${avail}</span> \${bar}</td>
          <td>£\${(s._revenue?.grossFace ?? 0).toFixed(2)}</td>
          <td>\${s.status || 'DRAFT'}</td>
          <td>
            <div class="kebab">
              <button class="btn" data-kebab="\${s.id}">⋮</button>
              <div class="menu" id="m-\${s.id}">
                <a href="#" data-edit="\${s.id}">Edit</a>
                <a href="#" data-seating="\${s.id}">Seating map</a>
                <a href="#" data-dup="\${s.id}">Duplicate</a>
              </div>
            </div>
          </td>
        </tr>\`;
      }).join('');
      // kebabs
      $$('[data-kebab]').forEach(b=>{
        b.addEventListener('click', (e)=>{ e.preventDefault(); const id=b.getAttribute('data-kebab'); const m=$('#m-'+id); $$('.menu').forEach(x=>x.classList.remove('open')); m.classList.add('open'); });
      });
      document.addEventListener('click',(e)=>{ if(!e.target.closest('.kebab')) $$('.menu').forEach(x=>x.classList.remove('open')); });

      $$('[data-edit]').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-edit')+'/edit'); }));
      $$('[data-seating]').forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); go('/admin/ui/shows/'+a.getAttribute('data-seating')+'/seating'); }));
      $$('[data-dup]').forEach(a=>a.addEventListener('click', async (e)=>{
        e.preventDefault();
        const id = a.getAttribute('data-dup');
        const r = await j('/admin/shows/'+id+'/duplicate', { method:'POST' });
        if(r.ok && r.newId){ go('/admin/ui/shows/'+r.newId+'/edit'); }
      }));
    }
    $('#refresh').addEventListener('click', load);
    load();
  }

  async function editShow(id){
    const s = await j('/admin/shows/'+id);
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">Edit show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><input id="venue_input"/></div>
          <div class="grid"><label>Poster image</label><div class="drop" id="drop">Drop image here or click to choose</div><input id="file" type="file" accept="image/*" style="display:none"/><div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div><img id="prev" class="imgprev" /></div>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Description</label>
          \${editorToolbarHtml()}
          <div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>
          <div class="muted">Event description (required). Use the toolbar to format.</div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="save" class="btn p">Save changes</button>
          <a class="btn" href="#" id="goSeating">Seating map</a>
          <div id="err" class="error"></div>
        </div>
      </div>\`;

    bindWysiwyg(main);
    $('#sh_title').value = s.item?.title ?? '';
    $('#venue_input').value = s.item?.venueText ?? (s.item?.venue?.name || '');
    $('#desc').innerHTML = s.item?.descriptionHtml || '';
    if (s.item?.date) {
      const dt = new Date(s.item.date);
      const iso = dt.toISOString().slice(0,16);
      $('#sh_dt').value = iso;
    }
    if (s.item?.imageUrl) { $('#prev').src = s.item.imageUrl; $('#prev').style.display='block'; }

    $('#goSeating').addEventListener('click',(e)=>{e.preventDefault(); go('/admin/ui/shows/'+id+'/seating');});
    $('#save').addEventListener('click', async ()=>{
      const payload = {
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueText: $('#venue_input').value.trim(),
        imageUrl: $('#prev').src || null,
        descriptionHtml: $('#desc').innerHTML.trim()
      };
      if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
        $('#err').textContent='Title, date/time, venue and description are required';
        return;
      }
      const r = await j('/admin/shows/'+id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(r.ok){ alert('Saved'); }
      else { $('#err').textContent=r.error||'Failed to save'; }
    });
  }

  // Stubs so links won’t 404 if you click them now
  function orders(){ main.innerHTML='<div class="card"><div class="title">Orders</div><div class="muted">Coming soon</div></div>'; }
  function venues(){ main.innerHTML='<div class="card"><div class="title">Venues</div><div class="muted">Coming soon</div></div>'; }

  // -------- Seating management page --------
  async function seatingPage(showId){
    const show = await j('/admin/shows/'+showId);
    const mapRes = await j('/admin/shows/'+showId+'/seatmap');

    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">Seating · \${show.item?.title || ''}</div></div>
        <div class="grid grid-2">
          <div class="grid">
            <label>Quick grid template (new)</label>
            <div class="grid grid-4">
              <input id="secName" placeholder="Section e.g. Stalls"/>
              <input id="rows" type="number" placeholder="Rows" value="10"/>
              <input id="perRow" type="number" placeholder="Seats/row" value="20"/>
              <input id="spacing" type="number" placeholder="Spacing px" value="22"/>
            </div>
            <div class="grid grid-4" style="margin-top:6px">
              <input id="rowStart" placeholder="Row start letter" value="A" maxlength="2"/>
              <input id="seatStart" type="number" placeholder="Seat start #" value="1"/>
              <input id="level" placeholder="Level e.g. Stalls"/>
              <select id="venuePick"><option value="">Venue (auto)</option></select>
            </div>
            <div class="row" style="margin-top:6px">
              <button class="btn" id="gen">Preview grid</button>
              <button class="btn" id="saveTpl">Save template to venue</button>
              <button class="btn" id="attach">Attach template to show</button>
              <div id="vmsg" class="muted"></div>
            </div>
          </div>
          <div class="grid">
            <label>Existing templates (for this venue)</label>
            <div id="tplList" class="grid"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="header"><div class="title">Seat map</div></div>
        <div class="canvasToolbar">
          <span class="pill"><span class="stat" id="selCount">0</span> selected</span>
          <button class="btn" id="makeAvail">Make available</button>
          <button class="btn" id="makeUnavail">Make unavailable</button>
          <button class="btn" id="allocExt">Allocate externally</button>
          <button class="btn" id="copyReport">Copy report</button>
          <button class="btn" id="csvReport">Download CSV</button>
          <span class="muted">Tip: Drag to marquee-select; \`Cmd/Ctrl\` + click to add/remove.</span>
        </div>
        <div class="canvasWrap">
          <canvas id="cnv" width="1000" height="520"></canvas>
        </div>
      </div>\`;

    const venuePick = $('#venuePick');
    if (show.item?.venueId) {
      venuePick.innerHTML = '<option value="'+show.item.venueId+'">'+(show.item?.venue?.name || 'Venue')+'</option>';
      venuePick.value = show.item.venueId;
    }

    async function loadTemplates(){
      const v = venuePick.value || show.item?.venueId;
      if(!v){ $('#tplList').innerHTML='<div class="muted">No venue selected</div>'; return; }
      const t = await j('/admin/venues/'+v+'/seatmaps');
      $('#tplList').innerHTML = (t.items||[]).map(x=>\`
        <div class="row" style="justify-content:space-between;border:1px solid var(--border);border-radius:8px;padding:8px">
          <div><strong>\${x.name}</strong> <span class="muted">(\${x.sections.length} sections)</span></div>
          <div class="row">
            <button class="btn" data-attach="\${x.id}">Attach</button>
          </div>
        </div>\`).join('') || '<div class="muted">No templates yet</div>';
      $$('[data-attach]').forEach(b=>b.addEventListener('click', async ()=>{
        await j('/admin/shows/'+showId+'/seatmap/attach',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ templateId: b.getAttribute('data-attach') }) });
        await reloadSeats();
      }));
    }
    await loadTemplates();

    let previewTemplate = null;
    $('#gen').addEventListener('click', ()=>{
      const secName=$('#secName').value.trim()||'Section';
      const rows=+$('#rows').value||0;
      const perRow=+$('#perRow').value||0;
      const spacing=+$('#spacing').value||22;
      const rowStart=($('#rowStart').value||'A').toUpperCase();
      const seatStart=+$('#seatStart').value||1;
      const level=$('#level').value.trim()||secName;

      const seats=[];
      const startCode=rowStart.charCodeAt(0);
      const originX=60, originY=60;
      for(let r=0;r<rows;r++){
        const rowLabel=String.fromCharCode(startCode+r);
        for(let c=0;c<perRow;c++){
          const seatNumber=seatStart + c;
          seats.push({
            rowLabel, seatNumber, label: rowLabel+'-'+seatNumber,
            x: originX + c*spacing, y: originY + r*spacing, w:18, h:18, tags:[]
          });
        }
      }
      previewTemplate = { sections: [{ name: secName, level, sortIndex: 0, originX: 0, originY: 0, seats }] };
      drawSeatsLocal(previewTemplate.sections[0].seats.map(s=>({ id:'local-'+s.label, ...s, status:'AVAILABLE' })));
    });

    $('#saveTpl').addEventListener('click', async ()=>{
      const v = venuePick.value || show.item?.venueId;
      if(!v){ alert('Pick a venue first'); return; }
      if(!previewTemplate){ alert('Click "Preview grid" first'); return; }
      const name = prompt('Template name?', 'Default map');
      if(!name) return;
      const payload = { venueId: v, name, sections: previewTemplate.sections };
      await j('/admin/seatmaps',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      $('#vmsg').textContent='Saved template';
      loadTemplates();
    });

    $('#attach').addEventListener('click', async ()=>{
      if(!previewTemplate){ alert('Click "Preview grid" first'); return; }
      const v = venuePick.value || show.item?.venueId;
      const payload = { venueId: v, name: 'Quick grid '+new Date().toLocaleString('en-GB'), sections: previewTemplate.sections };
      const t = await j('/admin/seatmaps',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      await j('/admin/shows/'+showId+'/seatmap/attach',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ templateId: t.template.id }) });
      await reloadSeats();
    });

    const cnv = $('#cnv'), ctx = cnv.getContext('2d');
    let seats = [];
    let selected = new Set();
    let dragging = false, dragStart=null, dragRect=null;

    function statusColour(s){
      switch(s){
        case 'AVAILABLE': return '#10b981';
        case 'UNAVAILABLE': return '#9ca3af';
        case 'HELD': return '#f59e0b';
        case 'EXTERNAL_ALLOCATED': return '#7c3aed';
        case 'RESERVED': return '#2563eb';
        case 'SOLD': return '#111827';
        default: return '#10b981';
      }
    }

    function draw(){
      ctx.clearRect(0,0,cnv.width,cnv.height);
      ctx.fillStyle='#f3f4f6'; ctx.fillRect(30,15,150,22);
      ctx.fillStyle='#374151'; ctx.font='12px sans-serif'; ctx.fillText('STAGE', 90, 30);
      for(const s of seats){
        ctx.fillStyle = statusColour(s.status);
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(6, Math.min(s.w,s.h)/2), 0, Math.PI*2);
        ctx.fill();
        if(selected.has(s.id)){
          ctx.strokeStyle='#111827'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(8, Math.min(s.w,s.h)/2 + 2), 0, Math.PI*2); ctx.stroke();
        }
      }
      if(dragRect){
        const {x,y,w,h} = dragRect;
        ctx.strokeStyle='#111827'; ctx.setLineDash([6,4]); ctx.strokeRect(x,y,w,h); ctx.setLineDash([]);
      }
      $('#selCount').textContent = selected.size;
    }

    function seatHit(mx,my){
      for(let i=seats.length-1;i>=0;i--){
        const s=seats[i]; const r = Math.max(6, Math.min(s.w,s.h)/2);
        const dx=mx-s.x, dy=my-s.y;
        if(dx*dx+dy*dy <= r*r) return s;
      }
      return null;
    }

    cnv.addEventListener('mousedown',(e)=>{
      const rect = cnv.getBoundingClientRect();
      const mx = e.clientX-rect.left, my = e.clientY-rect.top;
      const hit = seatHit(mx,my);
      const multi = e.metaKey || e.ctrlKey;
      if(hit){
        if(multi){ if(selected.has(hit.id)) selected.delete(hit.id); else selected.add(hit.id); }
        else { selected = new Set([hit.id]); }
        draw();
      } else {
        dragging = true; dragStart={x:mx,y:my}; dragRect={x:mx,y:my,w:0,h:0};
      }
    });
    cnv.addEventListener('mousemove',(e)=>{
      if(!dragging) return;
      const rect = cnv.getBoundingClientRect();
      const mx = e.clientX-rect.left, my = e.clientY-rect.top;
      dragRect = { x: Math.min(dragStart.x,mx), y: Math.min(dragStart.y,my), w: Math.abs(mx-dragStart.x), h: Math.abs(my-dragStart.y) };
      draw();
    });
    cnv.addEventListener('mouseup',()=>{
      if(dragging && dragRect){
        const rx=dragRect.x, ry=dragRect.y, rw=dragRect.w, rh=dragRect.h;
        for(const s of seats){
          if(s.x >= rx && s.x <= rx+rw && s.y >= ry && s.y <= ry+rh){ selected.add(s.id); }
        }
        dragging=false; dragRect=null; draw();
      }
    });

    async function reloadSeats(){
      const r = await j('/admin/shows/'+showId+'/seatmap');
      if(!r.map){ seats=[]; selected=new Set(); draw(); return; }
      seats = (r.seats||[]).map(s=>({ id:s.id,label:s.label,x:s.x,y:s.y,w:s.w,h:s.h,status:s.status,section:s.section,rowLabel:s.rowLabel,seatNumber:s.seatNumber,allocationRef:s.allocationRef||null }));
      selected=new Set(); draw();
    }

    function drawSeatsLocal(localSeats){
      seats = localSeats;
      selected=new Set(); draw();
    }

    await reloadSeats();

    async function doBulk(action, allocationLabel){
      if(selected.size===0){ alert('Select seats first'); return; }
      const seatIds=[...selected];
      await j('/admin/shows/'+showId+'/seats/bulk',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ seatIds, action, allocationLabel }) });
      await reloadSeats();
    }

    $('#makeAvail').addEventListener('click',()=>doBulk('AVAILABLE'));
    $('#makeUnavail').addEventListener('click',()=>doBulk('UNAVAILABLE'));
    $('#allocExt').addEventListener('click',async ()=>{
      const label = prompt('Allocation label (e.g. Ticketmaster – Promoter A)','External');
      if(!label) return;
      await doBulk('EXTERNAL_ALLOCATE', label);
    });

    $('#copyReport').addEventListener('click', async ()=>{
      const t = await fetch('/admin/shows/'+showId+'/allocations/export?format=text', { credentials:'include' }).then(r=>r.text());
      await navigator.clipboard.writeText(t);
      alert('Allocation report copied to clipboard');
    });
    $('#csvReport').addEventListener('click', async ()=>{
      const t = await fetch('/admin/shows/'+showId+'/allocations/export?format=csv', { credentials:'include' }).then(r=>r.text());
      const blob = new Blob([t],{type:'text/csv'}); const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='allocation.csv'; a.click(); URL.revokeObjectURL(url);
    });
  }

  // Kick off initial render
  route();
})();
</script>
</body>
</html>`);
});

export default router;