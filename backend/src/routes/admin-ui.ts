// backend/src/routes/admin-ui.ts
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

router.get(["/ui", "/ui/", "/ui/*"], requireAdminOrOrganiser, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
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
    try { return await r.json(); } catch { return {}; }
  }
  function go(path){ history.pushState(null,'',path); route(); }

  // Delegate menu clicks
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

  // ---------- Upload helper ----------
  async function uploadPoster(file) {
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/admin/uploads", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) { const t = await res.text(); throw new Error('Upload failed: '+t.slice(0,200)); }
    const data = await res.json(); if (!data?.ok) throw new Error(data?.error||'Upload failed'); return data;
  }

  // ---------- Venue helpers (type-ahead + create-if-missing) ----------
  async function venueSuggest(q){
    if(!q || q.length < 2) { const dl=$('#venue_list'); if(dl) dl.innerHTML = ''; return; }
    try {
      const r = await j('/admin/venues?q=' + encodeURIComponent(q));
      const opts = (r.items||[]).map(v=>{
        const desc = [v.name, v.city, v.postcode].filter(Boolean).join(' — ');
        return \`<option value="\${v.name}">\${desc}</option>\`;
      }).join('');
      const dl = $('#venue_list'); if (dl) dl.innerHTML = opts;
    } catch(e){ /* ignore */ }
  }
  function bindVenueTypeahead(){
    const vin = $('#venue_input');
    if(!vin) return;
    vin.addEventListener('input', ()=>venueSuggest(vin.value.trim()));
    vin.addEventListener('focus', ()=>venueSuggest(vin.value.trim()));
  }
  async function ensureVenueExists(name){
    const q = (name||'').trim();
    if(!q) return null;
    try{
      const r = await j('/admin/venues?q='+encodeURIComponent(q));
      const exact = (r.items||[]).find(v => (v.name||'').toLowerCase() === q.toLowerCase());
      if (exact) return exact;
      const cr = await j('/admin/venues', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:q }) });
      if (cr.ok === false) throw new Error(cr.error||'Failed to create venue');
      return cr.venue || cr.item || null;
    }catch(e){ return null; }
  }

  // ---------- WYSIWYG helpers ----------
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

  // ---------- Create Show ----------
  async function createShow(){
    main.innerHTML = \`
      <div class="card">
        <div class="header"><div class="title">Create show</div></div>
        <div class="grid grid-2">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid">
            <label>Venue</label>
            <input id="venue_input" list="venue_list" placeholder="Start typing a venue…"/>
            <datalist id="venue_list"></datalist>
            <div class="muted">Pick an existing venue or just type a new one.</div>
          </div>
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
    bindVenueTypeahead();

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
      const title = $('#sh_title').value.trim();
      const venueText = $('#venue_input').value.trim();
      const dateIso = $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null;
      const descriptionHtml = $('#desc').innerHTML.trim();

      if(!title || !dateIso || !venueText || !descriptionHtml){
        $('#err').textContent='Title, date/time, venue and description are required';
        return;
      }

      // Ensure venue exists or create it
      const v = await ensureVenueExists(venueText);
      const payload = {
        title,
        date: dateIso,
        venueId: v?.id || null,
        venueText,
        imageUrl: ($('#prev') && $('#prev').src) ? $('#prev').src : null,
        descriptionHtml
      };

      const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(r.ok === false){ $('#err').textContent=r.error||'Failed to create show'; return; }
      go('/admin/ui/shows/current');
    });
  }

  // ---------- All events ----------
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
          <td><span class="muted">Sold \${sold} · Hold \${hold} · Avail \${avail}</span> \${bar}</td>
          <td>£\${Number(s._revenue?.grossFace ?? 0).toFixed(2)}</td>
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

  // ---------- Edit show (minimal shell) ----------
  async function editShow(id){
    const s = await j('/admin/shows/'+id);
    main.innerHTML = \`
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
          <label>Description</label>
          \${editorToolbarHtml()}
          <div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="save" class="btn p">Save changes</button>
          <a class="btn" href="#" id="goSeating">Seating map</a>
          <div id="err" class="error"></div>
        </div>
      </div>\`;

    bindWysiwyg(main);
    $('#sh_title').value = s.item?.title ?? '';
    $('#venue_input').value = s.item?.venue?.name || s.item?.venueText || '';
    $('#desc').innerHTML = s.item?.descriptionHtml || '';
    if (s.item?.date) {
      const dt = new Date(s.item.date);
      const iso = dt.toISOString().slice(0,16);
      $('#sh_dt').value = iso;
    }
    if (s.item?.imageUrl) { $('#prev').src = s.item.imageUrl; $('#prev').style.display='block'; }

    // upload handlers
    const drop=$('#drop'), file=$('#file'), bar=$('#bar');
    drop.addEventListener('click', ()=>file.click());
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0]; if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{ const f=file.files && file.files[0]; if(f) await doUpload(f); });
    async function doUpload(f){
      $('#err').textContent=''; bar.style.width='15%';
      try{ const out = await uploadPoster(f); $('#prev').src = out.url; $('#prev').style.display='block'; bar.style.width='100%'; setTimeout(()=>bar.style.width='0%',800);}
      catch(e){ bar.style.width='0%'; $('#err').textContent=e.message||'Upload failed'; }
    }

    $('#goSeating').addEventListener('click',(e)=>{e.preventDefault(); go('/admin/ui/shows/'+id+'/seating');});
    $('#save').addEventListener('click', async ()=>{
      const payload = {
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueText: $('#venue_input').value.trim(),
        imageUrl: ($('#prev') && $('#prev').src) ? $('#prev').src : null,
        descriptionHtml: $('#desc').innerHTML.trim()
      };
      if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
        $('#err').textContent='Title, date/time, venue and description are required';
        return;
      }
      const r = await j('/admin/shows/'+id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(r.ok){ alert('Saved'); } else { $('#err').textContent=r.error||'Failed to save'; }
    });
  }

  // ---------- Seating placeholder ----------
  function seatingPage(id){
    main.innerHTML = '<div class="card"><div class="title">Seating map</div><div class="muted">Coming soon</div></div>';
  }

  // ---------- Orders/Venues placeholders ----------
  function orders(){ main.innerHTML='<div class="card"><div class="title">Orders</div><div class="muted">Coming soon</div></div>'; }
  function venues(){ main.innerHTML='<div class="card"><div class="title">Venues</div><div class="muted">Use Create show to add/select a venue. A dedicated page will follow.</div></div>'; }

  // initial route
  route();
})();
</script>
</body>
</html>`);
});

export default router;
