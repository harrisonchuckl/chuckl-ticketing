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
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none;cursor:pointer}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .sb-caret{float:right;opacity:.6}
  .submenu{margin-left:8px;padding-left:8px;border-left:2px solid #eef2f7;display:none}
  .submenu.show{display:block}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  input,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none;width:100%;box-sizing:border-box}
  textarea{min-height:140px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border);vertical-align:middle}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .toolbar{display:flex;gap:6px;margin-bottom:8px}
  .chip{display:inline-block;padding:2px 8px;border:1px solid var(--border);border-radius:999px;font-size:12px;margin-right:6px}
  .barwrap{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .kebab{border:1px solid var(--border);background:#fff;border-radius:6px;padding:4px 8px;cursor:pointer}
  .menu{position:absolute;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.08);display:none;min-width:140px;z-index:30}
  .menu.show{display:block}
  .menu a{display:block;padding:8px 10px;text-decoration:none;color:#111827}
  .menu a:hover{background:#f8fafc}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" data-view="home">Home</a>

    <div class="sb-group">Manage</div>
    <a class="sb-link" id="sb-shows" data-toggle="submenu">Shows <span class="sb-caret">▾</span></a>
    <div class="submenu" id="sb-shows-sub">
      <a class="sb-link" data-view="shows_create" style="padding-left:18px">Create show</a>
      <a class="sb-link" data-view="shows_current" style="padding-left:18px">All events</a>
    </div>
    <a class="sb-link" data-view="orders">Orders</a>
    <a class="sb-link" data-view="venues">Venues</a>

    <div class="sb-group">Insights</div>
    <a class="sb-link" data-view="analytics">Analytics</a>

    <div class="sb-group">Marketing</div>
    <a class="sb-link" data-view="audiences">Audiences</a>
    <a class="sb-link" data-view="email">Email Campaigns</a>

    <div class="sb-group">Settings</div>
    <a class="sb-link" href="/auth/logout">Log out</a>
  </aside>

  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  // simple in-memory cache for shows list so Edit/Duplicate can prefill without extra roundtrips
  let SHOW_CACHE = new Map();

  // --- router ---
  function setActive(id){ $$('.sb-link').forEach(a=>a.classList.toggle('active', a.getAttribute('data-view')===id)); }
  function setMain(html){ $('#main').innerHTML=html; }
  $('#sb-shows').addEventListener('click', ()=>$('#sb-shows-sub').classList.toggle('show'));

  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    const ct=r.headers.get('content-type')||'';
    if(!r.ok){ throw new Error('HTTP '+r.status); }
    if(ct.includes('application/json')) return r.json();
    // try to parse JSON even if header is wrong
    try{ return JSON.parse(await r.text()); }catch{ return {}; }
  }

  function go(view, params={}){
    setActive(view);
    if(view==='home') return home();
    if(view==='shows_create') return shows_create({mode:'create', ...params});
    if(view==='shows_edit') return shows_create({mode:'edit', ...params});
    if(view==='shows_duplicate') return shows_create({mode:'duplicate', ...params});
    if(view==='shows_current') return shows_current();
    if(view==='orders') return orders();
    if(view==='venues') return venues();
    if(view==='analytics') return analytics();
    if(view==='audiences') return audiences();
    if(view==='email') return email();
    home();
  }

  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  // ---------- CREATE / EDIT ----------
  async function shows_create(opts){
    const mode = opts.mode || 'create';
    // Prefer prefill passed from list; fallback to API by ID; fallback to list by ID
    let prefill = opts.prefill || null;

    if(!prefill && opts.id){
      try{
        prefill = await j('/admin/shows/'+encodeURIComponent(opts.id)); // if your API serves JSON here
      }catch{}
      if(!prefill){
        try{
          const all = await j('/admin/shows');
          const found = (all.items||[]).find(s=>s.id===opts.id);
          if(found) prefill = found;
        }catch{}
      }
    }

    setMain(\`
      <div class="card">
        <div class="header"><div class="title">\${mode==='edit' ? 'Edit show' : 'Create show'}</div></div>
        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>

          <div class="grid" style="grid-column:1/-1"><label>Venue</label>
            <input id="venue_search" placeholder="Start typing a venue..." autocomplete="off"/>
            <div id="venue_results" class="card" style="padding:6px;margin-top:6px;display:none"></div>
          </div>

          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="barwrap" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
              <img id="prev" class="imgprev" alt="" style="display:none"/>
              <button id="removeImg" class="btn" style="display:none">Remove</button>
            </div>
          </div>

          <div class="grid" style="grid-column:1/-1">
            <label>Description</label>
            <div class="toolbar">
              <button class="btn" data-cmd="bold">B</button>
              <button class="btn" data-cmd="italic"><i>I</i></button>
              <button class="btn" data-cmd="underline"><u>U</u></button>
              <button class="btn" data-cmd="insertUnorderedList">• List</button>
              <button class="btn" data-cmd="insertOrderedList">1. List</button>
            </div>
            <div id="desc" contenteditable="true" style="border:1px solid var(--border);border-radius:8px;padding:10px;min-height:160px;background:#fff"></div>
            <div class="muted" style="margin-top:6px">Event description (required). Use the toolbar to format.</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center">
          <button id="saveShell" class="btn">\${mode==='edit' ? 'Save changes' : 'Save show & add tickets'}</button>
          <div id="err" class="error"></div>
        </div>
      </div>
    \`);

    // formatting
    $$('.toolbar .btn').forEach(b=>{
      const cmd=b.getAttribute('data-cmd');
      b.addEventListener('click', ()=>document.execCommand(cmd,false,null));
    });

    // image upload
    async function uploadPoster(file){
      const form=new FormData(); form.append('file',file);
      const res=await fetch('/api/upload',{method:'POST',body:form,credentials:'include'});
      if(!res.ok) throw new Error('Upload failed');
      const data=await res.json(); if(!data?.ok) throw new Error(data?.error||'Upload error');
      return data;
    }
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), removeImg=$('#removeImg');
    drop.addEventListener('click', ()=>file.click());
    drop.addEventListener('dragover', e=>{e.preventDefault();drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async e=>{e.preventDefault();drop.classList.remove('drag'); const f=e.dataTransfer.files?.[0]; if(f) await doUpload(f);});
    file.addEventListener('change', async ()=>{const f=file.files?.[0]; if(f) await doUpload(f);});
    let posterUrl=null;
    async function doUpload(f){
      $('#err').textContent=''; bar.style.width='15%';
      try{
        const out=await uploadPoster(f);
        posterUrl=out.url; prev.src=posterUrl; prev.style.display='inline-block'; removeImg.style.display='inline-block';
        bar.style.width='100%'; setTimeout(()=>bar.style.width='0%',500);
      }catch(e){ bar.style.width='0%'; $('#err').textContent=e.message||'Upload failed'; }
    }
    removeImg.addEventListener('click',()=>{ posterUrl=null; prev.src=''; prev.style.display='none'; removeImg.style.display='none'; });

    // venues typeahead (required fields enforced on save)
    let selectedVenueId=null;
    async function searchVenues(q){
      if(!q){ $('#venue_results').style.display='none'; return; }
      try{
        const vj=await j('/admin/venues?q='+encodeURIComponent(q));
        const box=$('#venue_results');
        const items=(vj.items||[]);
        box.innerHTML = items.map(v=>\`<a href="#" data-vid="\${v.id}" class="sb-link">\${v.name}\${v.city?(' – '+v.city):''}</a>\`).join('')
          || '<div class="muted" style="padding:8px">No match.</div>';
        box.style.display='block';
        box.querySelectorAll('a[data-vid]').forEach(a=>{
          a.addEventListener('click',(e)=>{e.preventDefault(); selectedVenueId=a.getAttribute('data-vid'); $('#venue_search').value=a.textContent.trim(); box.style.display='none';});
        });
      }catch(e){}
    }
    $('#venue_search').addEventListener('input', e=>searchVenues(e.target.value.trim()));

    // prefill (Edit / Duplicate)
    let editId=null;
    if(prefill){
      if(mode==='edit') editId=prefill.id;
      $('#sh_title').value = (mode==='duplicate' && prefill.title) ? (prefill.title+' (Copy)') : (prefill.title||'');
      try{
        if(prefill.date){
          const d=new Date(prefill.date);
          const iso = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
          $('#sh_dt').value = iso;
        }
      }catch{}
      if(prefill.venue){
        selectedVenueId=prefill.venue.id;
        $('#venue_search').value = prefill.venue.name + (prefill.venue.city?(' – '+prefill.venue.city):'');
      }
      if(prefill.imageUrl){ posterUrl=prefill.imageUrl; prev.src=posterUrl; prev.style.display='inline-block'; removeImg.style.display='inline-block'; }
      if(prefill.descriptionHtml){ $('#desc').innerHTML=prefill.descriptionHtml; }
    }

    // save
    $('#saveShell').addEventListener('click', async ()=>{
      $('#err').textContent='';
      const payload={
        title: $('#sh_title').value.trim(),
        date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
        venueId: selectedVenueId,
        imageUrl: posterUrl,
        descriptionHtml: $('#desc').innerHTML.trim()
      };
      if(!payload.title || !payload.date || !payload.venueId || !payload.descriptionHtml){
        $('#err').textContent='Title, date/time, venue and description are required.'; return;
      }
      try{
        if(editId){
          await j('/admin/shows/'+encodeURIComponent(editId),{
            method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
          });
        }else{
          const out = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
          editId = out?.id || null;
        }
        // once saved, jump to tickets screen later; for now go back to list:
        go('shows_current');
      }catch(e){ $('#err').textContent=e.message||'Failed to save show'; }
    });
  }

  // ---------- LIST ----------
  async function shows_current(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">All events</div><button id="refresh" class="btn">Refresh</button></div>
        <table>
          <thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Total allocation</th><th>Gross face</th><th>Status</th><th></th></tr></thead>
          <tbody id="tbody"><tr><td colspan="7" class="muted">Loading…</td></tr></tbody>
        </table>
        <div id="lerr" class="error"></div>
      </div>
    \`);

    async function load(){
      try{
        $('#lerr').textContent='';
        const jn=await j('/admin/shows');
        const tb=$('#tbody');
        SHOW_CACHE = new Map();
        (jn.items||[]).forEach(s=>SHOW_CACHE.set(s.id,s));

        if(!jn.items || !jn.items.length){ tb.innerHTML='<tr><td colspan="7" class="muted">No events yet.</td></tr>'; return; }

        tb.innerHTML = jn.items.map(s=>{
          const dt = s.date ? new Date(s.date) : null;
          const uk = dt ? dt.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
          const total = (s.stats?.total||s._count?.ticketTypes||0);
          const sold = (s.stats?.sold||0);
          const hold = (s.stats?.hold||0);
          const avail = Math.max(0, total - sold - hold);
          const pct = total ? Math.round((sold/total)*100) : 0;
          return \`
            <tr data-id="\${s.id}">
              <td>\${s.title||''}</td>
              <td>\${uk}</td>
              <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : ''}</td>
              <td>
                <span class="chip">\${total} total</span>
                <span class="chip">Sold \${sold}</span>
                <span class="chip">Hold \${hold}</span>
                <span class="chip">Avail \${avail}</span>
                <div class="barwrap" style="margin-top:6px;width:160px"><div class="bar" style="width:\${pct}%"></div></div>
              </td>
              <td>£\${(s.stats?.grossFace||0).toFixed(2)}</td>
              <td>\${(s.status||'DRAFT')}</td>
              <td style="position:relative">
                <button class="kebab">⋯</button>
                <div class="menu">
                  <a href="#" data-act="edit">Edit</a>
                  <a href="#" data-act="dup">Duplicate</a>
                </div>
              </td>
            </tr>\`;
        }).join('');

        tb.querySelectorAll('.kebab').forEach(btn=>{
          btn.addEventListener('click', (e)=>{
            const tr=e.target.closest('tr');
            const m=tr.querySelector('.menu');
            tb.querySelectorAll('.menu').forEach(x=>{ if(x!==m) x.classList.remove('show'); });
            m.classList.toggle('show');
          });
        });
        document.addEventListener('click', (e)=>{
          if(!e.target.closest('.menu') && !e.target.closest('.kebab')){
            tb.querySelectorAll('.menu').forEach(x=>x.classList.remove('show'));
          }
        });
        tb.querySelectorAll('.menu a').forEach(a=>{
          a.addEventListener('click', (e)=>{
            e.preventDefault();
            const tr = a.closest('tr'); const id = tr.getAttribute('data-id');
            const prefill = SHOW_CACHE.get(id) || null;
            if(a.getAttribute('data-act')==='edit'){
              go('shows_edit',{id, prefill});
            }else{
              go('shows_duplicate',{id, prefill});
            }
          });
        });
      }catch(e){ $('#lerr').textContent=e.message||'Failed to load events'; }
    }
    $('#refresh').addEventListener('click', load);
    load();
  }

  // stubs
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Use the Orders view to search & export.</div></div>'); }
  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the Venues tab to add/search venues.</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'); }

  // boot
  go('shows_current');
})();
</script>
</body>
</html>`);
});

export default router;
