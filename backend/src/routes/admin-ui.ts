// backend/src/routes/admin-ui.ts
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
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--ink:#111827;--seat-bg:#10b981;--seat-border:#022c22}
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
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none;font:inherit}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b;cursor:pointer}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px;display:none}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .row{display:flex;gap:8px;align-items:center}
  .kbd{font:12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
  .kebab{position:relative}
  .menu{position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);display:none;min-width:160px;z-index:20}
  .menu.open{display:block}
  .menu a{display:block;padding:8px 10px;text-decoration:none;color:#111827}
  .menu a:hover{background:#f8fafc}
  .tip{font-size:12px;color:#64748b;margin-top:4px}
  .pop{position:absolute;z-index:30;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);min-width:260px;display:none}
  .pop.open{display:block}
  .opt{padding:8px 10px;cursor:pointer}
  .opt:hover{background:#f8fafc}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid var(--border);background:#f9fafb}

  .seat-layout-wrap{
    background:#020617;
    border-radius:12px;
    padding:16px;
    color:#e5e7eb;
    min-height:320px;
    display:flex;
    flex-direction:column;
    gap:12px;
    position:relative;
  }
  #seatCanvas{
    position:relative;
    min-width:900px;
    min-height:220px;
    transform-origin:0 0;
  }
  .guide-line{position:absolute;background:rgba(248,250,252,.85);pointer-events:none;z-index:5}
  .guide-line.h{height:1px;width:100%}
  .guide-line.v{width:1px;height:100%}

  .seat-zoom-controls{
    position:absolute;
    right:16px;
    bottom:16px;
    display:flex;
    gap:4px;
    z-index:10;
  }
  .seat-zoom-controls .btn{
    padding:4px 8px;
    font-size:12px;
  }
  .seat-stage{font-size:12px;text-align:center;letter-spacing:.12em;text-transform:uppercase;color:#e5e7eb}
  .seat-stage-bar{margin-top:4px;height:6px;border-radius:999px;background:rgba(148,163,184,.35)}
  .seat-dot{width:12px;height:12px;border-radius:3px;background:var(--seat-bg);border:1px solid var(--seat-border)}
  .seat-dot.block{background:#0f172a;border-color:#0b1120}
  .seat-dot.held{background:#f59e0b;border-color:#92400e}
  .seat-dot.sold{background:#9ca3af;border-color:#4b5563}
  .seat-legend{font-size:12px;color:#e5e7eb;display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
  .seat-legend span{display:inline-flex;align-items:center;gap:4px}
  .seat-grid{display:inline-grid;gap:4px;margin-top:4px}
  .seat{width:18px;height:18px;border-radius:4px;background:var(--seat-bg);border:1px solid var(--seat-border);display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:transform .05s.ease-out,box-shadow .05s.ease-out}
  .seat:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(0,0,0,.45)}
  .seat-blocked{background:#0f172a;border-color:#0b1120}
  .seat-held{background:#f59e0b;border-color:#92400e}
  .seat-sold{background:#9ca3af;border-color:#4b5563;cursor:not-allowed}
  .seat-selected{outline:2px solid #f97316;outline-offset:1px}

  /* Seat blocks / grids overlay */
  .seat-block-overlay{
    position:absolute;
    border:1px dashed rgba(148,163,184,.9);
    background:rgba(15,23,42,.35);
    border-radius:8px;
    padding:4px 6px;
    box-sizing:border-box;
    cursor:move;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    font-size:11px;
    color:#e5e7eb;
    pointer-events:auto;
  }
  .seat-block-overlay-label{
    font-weight:500;
  }
  .seat-block-overlay-handle{
    font-size:10px;
    opacity:.8;
    margin-left:8px;
  }
  .seat-block-overlay.selected{
    border-style:solid;
    border-color:#f97316;
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
  console.log('[Admin UI] script booting…');
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const main = $('#main');

  // Sidebar nested menu
  const showsToggle = $('#showsToggle');
  const showsSub = $('#showsSub');

  if (showsToggle && showsSub) {
    showsToggle.addEventListener('click', function(e){
      e.preventDefault();
      showsSub.style.display = showsSub.style.display === 'none' ? 'block' : 'none';
    });
  } else {
    console.warn('[Admin UI] showsToggle or showsSub not found', { showsToggle, showsSub });
  }

  function setActive(path){
    $$('.sb-link').forEach(function(a){
      a.classList.toggle('active', a.getAttribute('data-view') === path);
    });
  }

  async function j(url,opts){
    const r = await fetch(url,{credentials:'include',...(opts||{})});
    let bodyText = '';
    try{ bodyText = await r.text(); }catch(e){}
    if(!r.ok){ throw new Error(bodyText || ('HTTP '+r.status)); }
    try{ return bodyText ? JSON.parse(bodyText) : {}; }catch(_){ return {}; }
  }

  function go(path){
    history.pushState(null,'',path);
    route();
  }

  // SPA nav
  document.addEventListener('click',function(e){
    const a = e.target && e.target.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault();
      go(a.getAttribute('data-view'));
    }
  });
  window.addEventListener('popstate', route);

 
    function home(){
    if (!main) {
      console.error('[Admin UI] #main element not found'));
      return;
    }
    main.innerHTML =
      '<div class="card"><div class="title">Welcome</div>' +
      '<div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }


  function route(){
    try {
      // normalise any trailing slash
      const path = location.pathname.replace(/\/$/, '');
      console.log('[Admin UI] route()', path);
      setActive(path);

      if (path === '/admin/ui' || path === '/admin/ui/home' || path === '/admin/ui/index.html') return home();
      if (path === '/admin/ui/shows/create') return createShow();
      if (path === '/admin/ui/shows/current') return listShows();
      if (path === '/admin/ui/orders') return orders();
      if (path === '/admin/ui/venues') return venues();
      if (path === '/admin/ui/analytics') return analytics();
      if (path === '/admin/ui/audiences') return audiences();
      if (path === '/admin/ui/email') return emailPage();
      if (path === '/admin/ui/account') return account();

      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')) return editShow(path.split('/')[4]);
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')) return ticketsPage(path.split('/')[4]);
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')) return seatingPage(path.split('/')[4]);

      return home();
    } catch (err) {
      console.error('[Admin UI] route() error:', err);
    }
  }

  // -------- Venues search + inline create (used in show editor/creator) --------
  async function searchVenues(q){
    if(!q) return [];
    try {
      const out = await j('/admin/venues?q='+encodeURIComponent(q));
      return out.items || [];
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
      pop.innerHTML = '';
      if(list.length){
        list.forEach(function(v){
          const el = document.createElement('div');
          el.className = 'opt';
          el.textContent = v.name + (v.city ? (' — '+v.city) : '');
          el.addEventListener('click', function(){
            input.value = v.name;
            input.dataset.venueId = v.id;
            close();
          });
          pop.appendChild(el);
        });
      }
      if(q && !list.some(function(v){ return (v.name || '').toLowerCase() === q.toLowerCase(); })){
        const add = document.createElement('div');
        add.className = 'opt';
        add.innerHTML = '➕ Create venue “'+q+'”';
        add.addEventListener('click', async function(){
          try{
            const created = await j('/admin/venues',{
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

    input.addEventListener('input', async function(){
      input.dataset.venueId = '';
      const q = input.value.trim();
      if(!q){ close(); return; }
      render(await searchVenues(q), q);
    });
    input.addEventListener('focus', async function(){
      const q = input.value.trim();
      if(!q) return;
      render(await searchVenues(q), q);
    });
    document.addEventListener('click', function(e){
      if(!pop.contains(e.target) && e.target !== input) close();
    });
  }

  // ---------- Upload helper ----------
  async function uploadPoster(file){
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/admin/uploads',{ method:'POST', body: form, credentials:'include' });
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
    container.querySelectorAll('[data-cmd]').forEach(function(b){
      b.addEventListener('click', function(){
        document.execCommand(b.getAttribute('data-cmd'));
      });
    });
  }

  // ---------- Create show ----------
  async function createShow(){
    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Add show</div>'
            +'<div class="muted">Create the show, upload artwork and set up your first ticket type.</div>'
          +'</div>'
        +'</div>'

        +'<div class="grid grid-2" style="margin-bottom:12px">'
          +'<div class="grid">'
            +'<label>Title</label>'
            +'<input id="sh_title" placeholder="e.g. Chuckl. Comedy Club" />'
            +'<label style="margin-top:10px">Venue</label>'
            +'<input id="venue_input" placeholder="Start typing a venue…" />'
            +'<div class="tip">Pick an existing venue or create a new one.</div>'
          +'</div>'

          +'<div class="grid">'
            +'<label>Date & time</label>'
            +'<input id="sh_dt" type="datetime-local" />'
            +'<label style="margin-top:10px">Poster image</label>'
            +'<div id="drop" class="drop">Drop image here or click to choose</div>'
            +'<input id="file" type="file" accept="image/*" style="display:none" />'
            +'<div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>'
            +'<div class="row" style="margin-top:8px;gap:8px;align-items:center">'
              +'<img id="prev" class="imgprev" alt="" />'
            +'</div>'
          +'</div>'
        +'</div>'

        +'<div class="grid" style="margin-top:10px;margin-bottom:16px">'
          +'<label>Description (optional)</label>'
          + editorToolbarHtml()
          +'<div id="desc" data-editor contenteditable="true" '
            +'style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>'
          +'<div class="muted">Use the toolbar to format your event description.</div>'
        +'</div>'

        +'<div class="card" style="margin:0;margin-bottom:16px">'
          +'<div class="title" style="margin-bottom:4px">First ticket type</div>'
          +'<div class="muted" style="margin-bottom:8px;font-size:13px">'
            +'Optional, but recommended. You can add more ticket types on the next screen.'
          +'</div>'
          +'<div class="grid grid-3">'
            +'<div class="grid">'
              +'<label>Name</label>'
              +'<input id="ft_name" placeholder="e.g. General Admission" value="General Admission" />'
            +'</div>'
            +'<div class="grid">'
              +'<label>Price (£)</label>'
              +'<input id="ft_price" type="number" min="0" step="0.01" placeholder="e.g. 25" />'
            +'</div>'
            +'<div class="grid">'
              +'<label>Allocation (optional)</label>'
              +'<input id="ft_allocation" type="number" min="0" step="1" placeholder="e.g. 300" />'
            +'</div>'
          +'</div>'
          +'<div class="tip" style="margin-top:6px;font-size:12px">'
            +'Leave these blank if you prefer to set up all tickets on the next page.'
          +'</div>'
        +'</div>'

        +'<div class="row" style="margin-top:6px">'
          +'<button id="save" class="btn p">Save show and add tickets</button>'
          +'<div id="err" class="error"></div>'
        +'</div>'
      +'</div>';

    bindWysiwyg(main);
    mountVenuePicker($('#venue_input'));

    const drop = $('#drop');
    const file = $('#file');
    const bar  = $('#bar');
    const prev = $('#prev');

    drop.addEventListener('click', function(){ file.click(); });
    drop.addEventListener('dragover', function(e){
      e.preventDefault();
      drop.classList.add('drag');
    });
    drop.addEventListener('dragleave', function(){
      drop.classList.remove('drag');
    });
    drop.addEventListener('drop', async function(e){
      e.preventDefault();
      drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await doUpload(f);
    });
    file.addEventListener('change', async function(){
      const f = file.files && file.files[0];
      if (f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent = '';
      bar.style.width = '15%';
      try{
        const out = await uploadPoster(f);
        prev.src = out.url;
        prev.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width = '0%'; }, 800);
      }catch(e){
        bar.style.width = '0%';
        $('#err').textContent = 'Upload failed: ' + (e.message || e);
      }
    }

    $('#save').addEventListener('click', async function(){
      const errEl = $('#err');
      errEl.textContent = '';

      try{
        const title      = $('#sh_title').value.trim();
        const dtRaw      = $('#sh_dt').value;
        const venueInput = $('#venue_input');
        const venueText  = venueInput.value.trim();
        const venueId    = venueInput.dataset.venueId || null;
        const imageUrl   = $('#prev').src || null;
        const descHtml   = $('#desc').innerHTML.trim();

        if (!title || !dtRaw || !venueText){
          throw new Error('Title, date/time and venue are required');
        }

        const dateIso = new Date(dtRaw).toISOString();

        // First ticket type fields (optional)
        const ftName        = $('#ft_name').value.trim();
        const ftPriceStr    = $('#ft_price').value.trim();
        const ftAllocStr    = $('#ft_allocation').value.trim();

        let firstTicketPayload = null;
        if (ftName || ftPriceStr || ftAllocStr){
          let pricePence = 0;
          if (ftPriceStr){
            const p = Number(ftPriceStr);
            if (!Number.isFinite(p) || p < 0){
              throw new Error('First ticket price must be a non-negative number');
            }
            pricePence = Math.round(p * 100);
          }
          let available = null;
          if (ftAllocStr){
            const a = Number(ftAllocStr);
            if (!Number.isFinite(a) || a < 0){
              throw new Error('First ticket allocation must be a non-negative number');
            }
            available = a;
          }

          firstTicketPayload = {
            name: ftName || 'General Admission',
            pricePence,
            available
          };
        }

        // Create the show (tolerant to different JSON shapes)
        const showRes = await j('/admin/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            date: dateIso,
            venueText,
            venueId,
            imageUrl,
            descriptionHtml: descHtml
          })
        });

        if (showRes && showRes.error) {
          throw new Error(showRes.error);
        }

        const showId =
          (showRes && (
            showRes.id ||
            (showRes.show && showRes.show.id) ||
            (showRes.item && showRes.item.id)
          )) || null;

        if (!showId){
          throw new Error('Failed to create show (no id returned from server)');
        }

        // Optionally create the first ticket type
        if (firstTicketPayload){
          try{
            await j('/admin/shows/' + showId + '/ticket-types', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(firstTicketPayload)
            });
          }catch(ttErr){
            alert(
              'Show created, but the first ticket type could not be saved: '
              + (ttErr.message || ttErr)
              + '. You can add it manually on the Tickets page.'
            );
          }
        }

        // Go straight into the new Tickets page wizard
        go('/admin/ui/shows/' + showId + '/tickets');
      }catch(e){
        errEl.textContent = e.message || String(e);
      }
    });
  }

  // ---------- Shows list ----------
  async function listShows(){
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">All events</div><button id="refresh" class="btn">Refresh</button></div>'
        +'<table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Total allocation</th><th>Gross face</th><th>Status</th><th></th></tr></thead>'
        +'<tbody id="tbody"></tbody></table>'
      +'</div>';

    async function load(){
      $('#tbody').innerHTML = '<tr><td colspan="7" class="muted">Loading…</td></tr>';
      try{
        const jn = await j('/admin/shows');
        const items = jn.items || [];
        const tb = $('#tbody');
        tb.innerHTML = items.map(function(s){
          const when = s.date ? new Date(s.date).toLocaleString('en-GB',{dateStyle:'short', timeStyle:'short'}) : '';
          const total = (s._alloc && s._alloc.total) || 0;
          const sold  = (s._alloc && s._alloc.sold) || 0;
          const hold  = (s._alloc && s._alloc.hold) || 0;
          const avail = Math.max(total-sold-hold,0);
          const pct   = total ? Math.round((sold/total)*100) : 0;
          const bar   = '<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px"><div style="background:#111827;height:6px;width:'+pct+'%"></div></div>';
          return '<tr>'
            +'<td>'+(s.title||'')+'</td>'
            +'<td>'+when+'</td>'
            +'<td>'+(s.venue ? (s.venue.name + (s.venue.city ? ' – '+s.venue.city : '')) : '')+'</td>'
            +'<td><span class="muted">Sold '+sold+' · Hold '+hold+' · Avail '+avail+'</span> '+bar+'</td>'
            +'<td>£'+(((s._revenue && s._revenue.grossFace) || 0).toFixed(2))+'</td>'
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

        $$('[data-kebab]').forEach(function(b){
          b.addEventListener('click', function(e){
            e.preventDefault();
            const id = b.getAttribute('data-kebab');
            const m  = $('#m-'+id);
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
            m.classList.add('open');
          });
        });
        document.addEventListener('click', function(e){
          if(!e.target.closest || !e.target.closest('.kebab')){
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
          }
        });

        $$('[data-edit]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            go('/admin/ui/shows/'+a.getAttribute('data-edit')+'/edit');
          });
        });
        $$('[data-seating]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            go('/admin/ui/shows/'+a.getAttribute('data-seating')+'/seating');
          });
        });
        $$('[data-tickets]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            go('/admin/ui/shows/'+a.getAttribute('data-tickets')+'/tickets');
          });
        });
        $$('[data-dup]').forEach(function(a){
          a.addEventListener('click', async function(e){
            e.preventDefault();
            try{
              const id = a.getAttribute('data-dup');
              const r  = await j('/admin/shows/'+id+'/duplicate',{method:'POST'});
              if(r.ok && r.newId){ go('/admin/ui/shows/'+r.newId+'/edit'); }
            }catch(err){
              alert('Duplicate failed: '+(err.message||err));
            }
          });
        });
      }catch(e){
        $('#tbody').innerHTML = '<tr><td colspan="7" class="error">Failed to load shows: '+(e.message||e)+'</td></tr>';
      }
    }

    $('#refresh').addEventListener('click', load);
    load();
  }

  // ---------- Edit show ----------
  async function editShow(id){
    let s = null;
    try{
      s = await j('/admin/shows/'+id);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Edit show</div></div>'
        +'<div class="grid grid-2">'
          +'<div class="grid"><label>Title</label><input id="sh_title"/></div>'
          +'<div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>'
          +'<div class="grid"><label>Venue</label><input id="venue_input"/></div>'
          +'<div class="grid"><label>Poster image</label>'
            +'<div class="drop" id="drop">Drop image here or click to choose</div>'
            +'<input id="file" type="file" accept="image/*" style="display:none"/>'
            +'<div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>'
            +'<img id="prev" class="imgprev" />'
          +'</div>'
        +'</div>'
        +'<div class="grid" style="margin-top:10px">'
          +'<label>Description</label>'+editorToolbarHtml()
          +'<div id="desc" data-editor contenteditable="true" style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>'
          +'<div class="muted">Event description (required). Use the toolbar to format.</div>'
        +'</div>'
        +'<div class="row" style="margin-top:10px">'
          +'<button id="save" class="btn p">Save changes</button>'
          +'<a class="btn" href="#" id="goSeating">Seating map</a>'
          +'<a class="btn" href="#" id="goTickets">Tickets</a>'
          +'<div id="err" class="error"></div>'
        +'</div>'
      +'</div>';

    bindWysiwyg(main);
    mountVenuePicker($('#venue_input'));

    $('#sh_title').value = (s.item && s.item.title) || '';
    $('#venue_input').value = (s.item && s.item.venue && s.item.venue.name) || (s.item && s.item.venueText) || '';
    if (s.item && s.item.date){
      const dt = new Date(s.item.date);
      $('#sh_dt').value = dt.toISOString().slice(0,16);
    }
    $('#desc').innerHTML = (s.item && s.item.description) || '';
    if (s.item && s.item.imageUrl){
      $('#prev').src = s.item.imageUrl;
      $('#prev').style.display = 'block';
    }

    const drop = $('#drop'), file = $('#file'), bar = $('#bar'), prev = $('#prev');

    drop.addEventListener('click', function(){ file.click(); });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });
    drop.addEventListener('drop', async function(e){
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async function(){
      const f = file.files && file.files[0];
      if(f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent = '';
      bar.style.width = '15%';
      try{
        const out = await uploadPoster(f);
        prev.src = out.url;
        prev.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width='0%'; },800);
      }catch(e){
        bar.style.width = '0%';
        $('#err').textContent = 'Upload failed: '+(e.message||e);
      }
    }

    $('#goSeating').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/'+id+'/seating');
    });
    $('#goTickets').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/'+id+'/tickets');
    });

    $('#save').addEventListener('click', async function(){
      $('#err').textContent = '';
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
        if(r && r.ok){
          alert('Saved');
        }else{
          throw new Error((r && r.error) || 'Failed to save');
        }
      }catch(e){
        $('#err').textContent = e.message || String(e);
      }
    });
  }

  // ---------- Tickets for a show ----------
  async function ticketsPage(id){
    main.innerHTML = '<div class="card"><div class="title">Loading tickets…</div></div>';
    let showResp;
    try{
      showResp = await j('/admin/shows/'+id);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    const show = showResp.item || {};
    const when = show.date ? new Date(show.date).toLocaleString('en-GB',{dateStyle:'full', timeStyle:'short'}) : '';
    const venueName = show.venue ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : '')) : (show.venueText || '');

    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Tickets for '+(show.title || 'Untitled show')+'</div>'
            +'<div class="muted">'+(when ? when+' · ' : '')+venueName+'</div>'
          +'</div>'
          +'<div class="row">'
            +'<button class="btn" id="backToShows">Back to all events</button>'
            +'<button class="btn" id="editShowBtn">Edit show</button>'
          +'</div>'
        +'</div>'

        +'<div class="grid grid-2" style="margin-bottom:16px">'
          +'<div class="card" style="margin:0">'
            +'<div class="title" style="margin-bottom:4px">Ticket structure</div>'
            +'<div class="muted" style="margin-bottom:8px">Tickets can be free (price £0) or paid, and can be sold as general admission or allocated seating.</div>'
            +'<div class="row" style="margin-bottom:8px">'
              +'<span class="pill" id="structureGeneral">General admission</span>'
              +'<span class="pill" id="structureAllocated">Allocated seating</span>'
            +'</div>'
            +'<div class="muted" style="font-size:12px">Allocated seating uses a seating map for this venue. You can reuse an existing map or create a new one just for this show.</div>'
          +'</div>'

          +'<div class="card" style="margin:0">'
            +'<div class="title" style="margin-bottom:4px">Seat maps for this show</div>'
            +'<div class="muted" id="seatMapsSummary">Loading seat maps…</div>'
            +'<div id="seatMapsList" style="margin-top:8px"></div>'
            +'<div class="row" style="margin-top:8px">'
              +'<button class="btn" id="refreshSeatMaps">Refresh seat maps</button>'
              +'<button class="btn" id="editSeatMaps">Create / edit seat map</button>'
            +'</div>'
          +'</div>'
        +'</div>'

        +'<div class="card" style="margin:0">'
          +'<div class="header">'
            +'<div class="title">Ticket types</div>'
            +'<button class="btn" id="addTypeBtn">Add ticket type</button>'
          +'</div>'
          +'<div class="muted" style="margin-bottom:8px">Set up the tickets you want to sell for this show. A £0 price will be treated as a free ticket.</div>'
          +'<div id="ticketTypesEmpty" class="muted" style="display:none">No ticket types yet. Use “Add ticket type” to create one.</div>'
          +'<table>'
            +'<thead><tr><th>Name</th><th>Price</th><th>Available</th><th></th></tr></thead>'
            +'<tbody id="ticketTypesBody"><tr><td colspan="4" class="muted">Loading…</td></tr></tbody>'
          +'</table>'
          +'<div id="addTypeForm" style="margin-top:12px;display:none">'
            +'<div class="grid grid-3">'
              +'<div class="grid"><label>Name</label><input id="tt_name" placeholder="e.g. Standard" /></div>'
              +'<div class="grid"><label>Price (£)</label><input id="tt_price" type="number" min="0" step="0.01" placeholder="e.g. 15" /></div>'
              +'<div class="grid"><label>Available (optional)</label><input id="tt_available" type="number" min="0" step="1" placeholder="Leave blank for unlimited" /></div>'
            +'</div>'
            +'<div class="row" style="margin-top:8px">'
              +'<button class="btn p" id="tt_save">Save ticket type</button>'
              +'<button class="btn" id="tt_cancel">Cancel</button>'
              +'<div id="tt_err" class="error"></div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>';

    $('#backToShows').addEventListener('click', function(){ go('/admin/ui/shows/current'); });
    $('#editShowBtn').addEventListener('click', function(){ go('/admin/ui/shows/'+id+'/edit'); });

    // Ticket types UI
    const addTypeForm = $('#addTypeForm');
    const ticketTypesBody = $('#ticketTypesBody');
    const ticketTypesEmpty = $('#ticketTypesEmpty');

    $('#addTypeBtn').addEventListener('click', function(){
      addTypeForm.style.display = 'block';
      $('#tt_name').focus();
    });
    $('#tt_cancel').addEventListener('click', function(){
      addTypeForm.style.display = 'none';
      $('#tt_err').textContent = '';
    });

    async function loadTicketTypes(){
      try{
        const res = await j('/admin/shows/'+id+'/ticket-types');
        const items = res.ticketTypes || [];
        if(!items.length){
          ticketTypesBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet.</td></tr>';
          ticketTypesEmpty.style.display = 'block';
        }else{
          ticketTypesEmpty.style.display = 'none';
          ticketTypesBody.innerHTML = items.map(function(tt){
            const price = (tt.pricePence || 0) / 100;
            const priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
            const availLabel = tt.available == null ? 'Unlimited' : String(tt.available);
            return '<tr>'
              +'<td>'+(tt.name || '')+'</td>'
              +'<td>'+priceLabel+'</td>'
              +'<td>'+availLabel+'</td>'
              +'<td><button class="btn" data-del="'+tt.id+'">Delete</button></td>'
            +'</tr>';
          }).join('');
          $$('[data-del]', ticketTypesBody).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              const idToDel = btn.getAttribute('data-del');
              if(!idToDel) return;
              if(!confirm('Delete this ticket type?')) return;
              try{
                await j('/admin/ticket-types/'+idToDel,{ method:'DELETE' });
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

    $('#tt_save').addEventListener('click', async function(){
      $('#tt_err').textContent = '';
      const name = $('#tt_name').value.trim();
      const priceStr = $('#tt_price').value.trim();
      const availStr = $('#tt_available').value.trim();

      if(!name){
        $('#tt_err').textContent = 'Name is required';
        return;
      }

      let pricePence = 0;
      if(priceStr){
        const p = Number(priceStr);
        if(!Number.isFinite(p) || p < 0){
          $('#tt_err').textContent = 'Price must be a non-negative number';
          return;
        }
        pricePence = Math.round(p * 100);
      }

      let available = null;
      if(availStr){
        const a = Number(availStr);
        if(!Number.isFinite(a) || a < 0){
          $('#tt_err').textContent = 'Available must be a non-negative number';
          return;
        }
        available = a;
      }

      try{
        await j('/admin/shows/'+id+'/ticket-types',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name, pricePence, available })
        });
        $('#tt_name').value = '';
        $('#tt_price').value = '';
        $('#tt_available').value = '';
        addTypeForm.style.display = 'none';
        loadTicketTypes();
      }catch(err){
        $('#tt_err').textContent = err.message || String(err);
      }
    });

    loadTicketTypes();

    // Seat maps summary
    const seatMapsSummary = $('#seatMapsSummary');
    const seatMapsList = $('#seatMapsList');
    const venueId = show.venue && show.venue.id ? show.venue.id : null;

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
        seatMapsSummary.textContent = maps.length+' seat map'+(maps.length>1?'s':'')+' found.';
        seatMapsList.innerHTML = maps.map(function(m){
          const def = m.isDefault ? ' · <strong>Default</strong>' : '';
          return '<div class="row" style="margin-bottom:4px;justify-content:space-between">'
            +'<div><strong>'+m.name+'</strong> <span class="muted">v'+(m.version || 1)+'</span>'+def+'</div>'
            +'<div class="row" style="gap:4px">'+(!m.isDefault ? '<button class="btn" data-make-default="'+m.id+'">Make default</button>' : '')+'</div>'
          +'</div>';
        }).join('');

        $$('[data-make-default]', seatMapsList).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            const mapId = btn.getAttribute('data-make-default');
            if(!mapId) return;
            try{
              await j('/admin/seatmaps/'+mapId+'/default',{
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ isDefault:true })
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
    $('#editSeatMaps').addEventListener('click', function(){ go('/admin/ui/shows/'+id+'/seating'); });
    loadSeatMaps();
  }

  // ---------- Seating page with blocks, metadata & seat-level pricing ----------
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
    const when = show.date ? new Date(show.date).toLocaleString('en-GB',{dateStyle:'full', timeStyle:'short'}) : '';
    const venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : ''))
      : (show.venueText || '');
    const venueId = show.venue && show.venue.id ? show.venue.id : null;

    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Seating map for '+(show.title || 'Untitled show')+'</div>'
            +'<div class="muted">'+(when ? when+' · ' : '')+venueName+'</div>'
          +'</div>'
          +'<div class="row">'
            +'<button class="btn" id="backToTickets">Back to tickets</button>'
            +'<button class="btn" id="editShowBtn">Edit show</button>'
          +'</div>'
        +'</div>'

        +'<div class="grid" style="gap:16px">'
          +'<div class="grid grid-2" style="align-content:start;gap:12px">'
            +'<div class="card" style="margin:0">'
              +'<div class="title" style="margin-bottom:4px">Seat maps for this show</div>'
              +'<div class="muted" id="sm_status">Loading seat maps…</div>'
              +'<select id="sm_select" style="margin-top:8px;width:100%"></select>'
              +'<div class="tip" id="sm_tip" style="margin-top:8px;font-size:12px">Seat maps are stored per show and can optionally be linked to a venue.</div>'
            +'</div>'

            +'<div class="card" style="margin:0">'
              +'<div class="title" style="margin-bottom:4px">Create new seat map</div>'
              +'<input id="sm_name" placeholder="e.g. Stalls layout" />'
              +'<button class="btn p" id="sm_create" style="margin-top:8px;width:100%">Create seat map</button>'
              +'<div class="error" id="sm_err" style="margin-top:4px"></div>'
            +'</div>'

            +'<div class="card" style="margin:0">'
              +'<div class="title" style="margin-bottom:4px">Quick seat generator</div>'
              +'<div class="muted" style="font-size:12px;margin-bottom:6px">Fast way to create a basic rectangular layout (A, B, C… rows).</div>'
              +'<div class="grid grid-2" style="margin-bottom:6px">'
                +'<div class="grid"><label>Rows</label><input id="q_rows" type="number" min="1" max="50" value="5"/></div>'
                +'<div class="grid"><label>Seats per row</label><input id="q_cols" type="number" min="1" max="80" value="10"/></div>'
              +'</div>'
              +'<button class="btn" id="q_generate" style="width:100%;margin-top:4px">Generate seats</button>'
              +'<div class="tip" style="font-size:12px">Uses /seatmaps/:id/seats/bulk, then reloads seats into the layout.</div>'
            +'</div>'

            +'<div class="card" style="margin:0">'
              +'<div class="title" style="margin-bottom:4px">Seat blocks</div>'
              +'<div class="muted" style="font-size:12px;margin-bottom:6px">Group seats into named blocks (e.g. “Stalls Left”, “Circle”), give them a zone and link to a ticket type.</div>'
              +'<div class="grid" style="grid-template-columns:2fr auto;gap:6px;margin-bottom:6px">'
                +'<input id="block_name" placeholder="e.g. Stalls Left" />'
                +'<button class="btn" id="block_create">Create from selection</button>'
              +'</div>'
              +'<div class="grid grid-3" style="margin-bottom:6px">'
                +'<div class="grid"><label style="font-size:12px">Capacity (optional)</label><input id="block_capacity" type="number" min="0" placeholder="Auto from seats"/></div>'
                +'<div class="grid"><label style="font-size:12px">Pricing zone</label><input id="block_zone" placeholder="e.g. Zone A"/></div>'
                +'<div class="grid"><label style="font-size:12px">Ticket type</label><select id="block_ticketType"><option value="">— None —</option></select></div>'
              +'</div>'
              +'<div class="tip" style="font-size:12px">Select one or more seats first, then create a block. You can drag the block label on the canvas to move all its seats.</div>'
              +'<div id="blocks_list" style="margin-top:8px;font-size:13px"></div>'
            +'</div>'

            +'<div class="card" style="margin:0">'
              +'<div class="title" style="margin-bottom:4px">Seat pricing</div>'
              +'<div class="muted" style="font-size:12px;margin-bottom:6px">Pick a ticket type, then assign it to selected seats. With multiple ticket prices, every seat should be allocated.</div>'
              +'<div class="grid" style="grid-template-columns:1fr;gap:6px;margin-bottom:6px">'
                +'<label style="font-size:12px">Ticket type for selection</label>'
                +'<select id="seat_price_ticketType"><option value="">— Choose ticket type —</option></select>'
              +'</div>'
              +'<div class="row" style="margin-bottom:4px">'
                +'<button class="btn" id="seat_price_assign_selection">Assign to selection</button>'
                +'<button class="btn" id="seat_price_clear">Clear from selection</button>'
              +'</div>'
              +'<div id="seat_price_summary" class="tip" style="font-size:12px;margin-top:4px">No pricing assignments yet.</div>'
            +'</div>'
          +'</div>'

          +'<div class="card" style="margin:0">'
            +'<div class="header">'
              +'<div class="title">Seat layout</div>'
              +'<button class="btn p" id="sm_saveLayout">Save layout</button>'
            +'</div>'
            +'<div class="muted" style="margin-bottom:6px;font-size:12px">'
              +'Drag seats to adjust positions. Seats snap to a subtle grid and alignment guides show when you line up with other rows/columns or the canvas centre.'
              +' Changes are only saved when you click “Save layout”.<br/>'
              +'<strong>Tip:</strong> <strong>Alt+click</strong> a seat to grab the whole row, or <strong>Shift+click</strong> to build a custom selection, then drag to move them together.'
            +'</div>'
            +'<div class="seat-layout-wrap">'
              +'<div class="seat-stage">Stage<div class="seat-stage-bar"></div></div>'
              +'<div id="seatCanvas" style="position:relative;min-height:220px;"></div>'
              +'<div class="seat-legend">'
                +'<span><span class="seat-dot"></span> Available</span>'
                +'<span><span class="seat-dot held"></span> Held</span>'
                +'<span><span class="seat-dot sold"></span> Sold</span>'
                +'<span><span class="seat-dot block"></span> Blocked</span>'
              +'</div>'
              +'<div class="seat-zoom-controls">'
                +'<button type="button" class="btn" id="zoomOutBtn">−</button>'
                +'<button type="button" class="btn" id="zoomResetBtn">100%</button>'
                +'<button type="button" class="btn" id="zoomInBtn">+</button>'
              +'</div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>';


    const backToTicketsBtn = document.getElementById('backToTickets');
    const editShowBtn      = document.getElementById('editShowBtn');
    const smStatus         = document.getElementById('sm_status');
    const smSelect         = document.getElementById('sm_select');
    const smTip            = document.getElementById('sm_tip');
    const smName           = document.getElementById('sm_name');
    const smCreate         = document.getElementById('sm_create');
    const smErr            = document.getElementById('sm_err');
    const qRows            = document.getElementById('q_rows');
    const qCols            = document.getElementById('q_cols');
    const qGenerate        = document.getElementById('q_generate');
    const seatCanvas       = document.getElementById('seatCanvas');
    const saveLayoutBtn    = document.getElementById('sm_saveLayout');

    const zoomInBtn        = document.getElementById('zoomInBtn');
    const zoomOutBtn       = document.getElementById('zoomOutBtn');
    const zoomResetBtn     = document.getElementById('zoomResetBtn');

    const blockNameInput   = document.getElementById('block_name');
    const blockCreateBtn   = document.getElementById('block_create');
    const blocksList       = document.getElementById('blocks_list');
    const blockCapacityInput = document.getElementById('block_capacity');
    const blockZoneInput     = document.getElementById('block_zone');
    const blockTicketTypeSelect = document.getElementById('block_ticketType');

    const seatPriceTicketTypeSelect   = document.getElementById('seat_price_ticketType');
    const seatPriceAssignBtn          = document.getElementById('seat_price_assign_selection');
    const seatPriceClearBtn           = document.getElementById('seat_price_clear');
    const seatPriceSummary            = document.getElementById('seat_price_summary');

    backToTicketsBtn.addEventListener('click', function(){
      go('/admin/ui/shows/'+showId+'/tickets');
    });
    editShowBtn.addEventListener('click', function(){
      go('/admin/ui/shows/'+showId+'/edit');
    });

    // Data state for this page
    let seatMapsData = [];
    let currentSeatMapId = null;
    let layout = { seats: {}, elements: [] };
    let seats = [];
    let ticketTypes = [];

    // selection state
    const selectedSeatIds = new Set();
    let selectedBlockId = null;

    // zoom state
    let zoom = 1;
    function applyZoom(){
      seatCanvas.style.transform = 'scale('+zoom+')';
    }
    applyZoom();

    zoomInBtn.addEventListener('click', function(){
      zoom = Math.min(3, zoom + 0.25);
      applyZoom();
    });
    zoomOutBtn.addEventListener('click', function(){
      zoom = Math.max(0.5, zoom - 0.25);
      applyZoom();
    });
    zoomResetBtn.addEventListener('click', function(){
      zoom = 1;
      applyZoom();
    });

    function ensureLayout(){
      if(!layout || typeof layout !== 'object') layout = { seats:{}, elements:[] };
      if(!layout.seats || typeof layout.seats !== 'object') layout.seats = {};
      if(!Array.isArray(layout.elements)) layout.elements = [];
    }

    function ensureSeatMeta(id){
      ensureLayout();
      let meta = layout.seats[id];
      if(!meta){
        meta = { x:40, y:30, rotation:0, ticketTypeId:null };
        layout.seats[id] = meta;
      }else{
        if(typeof meta.x !== 'number') meta.x = 40;
        if(typeof meta.y !== 'number') meta.y = 30;
        if(typeof meta.rotation !== 'number') meta.rotation = 0;
        if(!('ticketTypeId' in meta)) meta.ticketTypeId = null;
      }
      return meta;
    }

    function clearSelection(){
      selectedSeatIds.forEach(function(id){
        const el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
        if(el) el.classList.remove('seat-selected');
      });
      selectedSeatIds.clear();
      selectedBlockId = null;
    }

    function addSeatToSelection(id){
      if(!selectedSeatIds.has(id)){
        selectedSeatIds.add(id);
        const el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
        if(el) el.classList.add('seat-selected');
      }
    }

    function recomputeSelectedBlockFromSeats(){
      ensureLayout();
      selectedBlockId = null;
      const sel = Array.from(selectedSeatIds);
      if(!sel.length) return;
      const blocks = layout.elements.filter(function(e){ return e && e.type === 'block' && Array.isArray(e.seatIds); });
      blocks.some(function(b){
        if(!b.seatIds || !b.seatIds.length) return false;
        const allIn = b.seatIds.every(function(id){ return selectedSeatIds.has(id); });
        if(allIn){
          selectedBlockId = b.id;
          return true;
        }
        return false;
      });
    }

    function selectSingleSeat(id){
      clearSelection();
      addSeatToSelection(id);
      recomputeSelectedBlockFromSeats();
      renderSeats();
    }

    function selectRowForSeat(id){
      const seat = seats.find(function(s){ return s.id === id; });
      if(!seat) return;
      const rowKey = seat.rowLabel || seat.row || '';
      clearSelection();
      seats.forEach(function(s){
        const key = s.rowLabel || s.row || '';
        if(key === rowKey){
          addSeatToSelection(s.id);
        }
      });
      recomputeSelectedBlockFromSeats();
      renderSeats();
    }

    // --- Alignment guides (safety rails) ---
    const guideH = document.createElement('div');
    guideH.className = 'guide-line h';
    guideH.style.display = 'none';

    const guideV = document.createElement('div');
    guideV.className = 'guide-line v';
    guideV.style.display = 'none';

    function hideGuides(){
      guideH.style.display = 'none';
      guideV.style.display = 'none';
    }
    function showGuideH(y){
      guideH.style.top = (y - 0.5)+'px';
      guideH.style.display = 'block';
    }
    function showGuideV(x){
      guideV.style.left = (x - 0.5)+'px';
      guideV.style.display = 'block';
    }

    function ticketTypeLabelForId(id){
      if(!id || !ticketTypes || !ticketTypes.length) return '';
      const tt = ticketTypes.find(function(t){ return t.id === id; });
      if(!tt) return '';
      const price = (tt.pricePence || 0) / 100;
      const priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
      return tt.name + ' ('+priceLabel+')';
    }

    function updateSeatPricingSummary(){
      if(!seatPriceSummary){
        return;
      }
      if(!Array.isArray(seats) || !seats.length){
        seatPriceSummary.textContent = 'No seats yet.';
        return;
      }
      ensureLayout();
      const countsByTt = {};
      let unassigned = 0;
      seats.forEach(function(s){
        const meta = layout.seats[s.id];
        const ttId = meta && meta.ticketTypeId;
        if(ttId){
          countsByTt[ttId] = (countsByTt[ttId] || 0) + 1;
        }else{
          unassigned++;
        }
      });
      const parts = [];
      Object.keys(countsByTt).forEach(function(ttId){
        const n = countsByTt[ttId];
        parts.push(ticketTypeLabelForId(ttId)+': '+n+' seat'+(n===1?'':'s'));
      });
      if(unassigned > 0){
        parts.push(unassigned+' unassigned seat'+(unassigned===1?'':'s'));
      }
      seatPriceSummary.textContent = parts.length ? parts.join(' · ') : 'No pricing assignments yet.';
    }

    function refreshBlocksList(){
      ensureLayout();
      if(!blocksList) return;
      const blocks = layout.elements.filter(function(e){ return e && e.type === 'block'; });
      if(!blocks.length){
        blocksList.innerHTML = '<div class="muted">No blocks yet.</div>';
        return;
      }
      blocksList.innerHTML = blocks.map(function(b){
        const seatCount = Array.isArray(b.seatIds) ? b.seatIds.length : 0;
        const capacity = (typeof b.capacity === 'number' && b.capacity >= 0) ? b.capacity : seatCount;
        const zone = (b.zone || '').trim();
        const ttLabel = ticketTypeLabelForId(b.ticketTypeId);
        const bits = [];
        bits.push(capacity+' seats');
        if(zone) bits.push('Zone: '+zone);
        if(ttLabel) bits.push('Ticket: '+ttLabel);
        return '<div class="row" data-block-row="'+b.id+'" style="justify-content:space-between;margin-bottom:4px">'
          +'<div><strong>'+ (b.name || 'Untitled block') +'</strong> <span class="muted">· '+bits.join(' · ')+'</span></div>'
          +'<div class="row" style="gap:4px">'
            +'<button class="btn" data-block-select="'+b.id+'">Select</button>'
            +'<button class="btn" data-block-delete="'+b.id+'">Delete</button>'
          +'</div></div>';
      }).join('');

      $$('[data-block-select]', blocksList).forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.preventDefault();
          const id = btn.getAttribute('data-block-select');
          ensureLayout();
          const block = layout.elements.find(function(el){ return el && el.id === id && el.type === 'block'; });
          if(!block || !Array.isArray(block.seatIds) || !block.seatIds.length) return;
          clearSelection();
          block.seatIds.forEach(function(seatId){ addSeatToSelection(seatId); });
          selectedBlockId = id;
          renderSeats();
        });
      });

      $$('[data-block-delete]', blocksList).forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.preventDefault();
          const id = btn.getAttribute('data-block-delete');
          if(!id) return;
          ensureLayout();
          const idx = layout.elements.findIndex(function(el){ return el && el.id === id && el.type === 'block'; });
          if(idx !== -1){
            layout.elements.splice(idx,1);
          }
          if(selectedBlockId === id){
            selectedBlockId = null;
          }
          refreshBlocksList();
          renderSeats();
        });
      });
    }

    async function loadTicketTypesForShow(){
      try{
        const res = await j('/admin/shows/'+showId+'/ticket-types');
        ticketTypes = res.ticketTypes || [];

        // Populate block ticket type select
        if(blockTicketTypeSelect){
          const currentVal = blockTicketTypeSelect.value;
          blockTicketTypeSelect.innerHTML = '<option value="">— None —</option>' +
            ticketTypes.map(function(tt){
              const price = (tt.pricePence || 0) / 100;
              const priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
              return '<option value="'+tt.id+'">'+tt.name+' ('+priceLabel+')</option>';
            }).join('');
          if(currentVal && ticketTypes.some(function(t){ return t.id === currentVal; })){
            blockTicketTypeSelect.value = currentVal;
          }
        }

        // Populate seat pricing ticket type select
        if(seatPriceTicketTypeSelect){
          const currentVal2 = seatPriceTicketTypeSelect.value;
          seatPriceTicketTypeSelect.innerHTML = '<option value="">— Choose ticket type —</option>' +
            ticketTypes.map(function(tt){
              const price = (tt.pricePence || 0) / 100;
              const priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
              return '<option value="'+tt.id+'">'+tt.name+' ('+priceLabel+')</option>';
            }).join('');
          if(currentVal2 && ticketTypes.some(function(t){ return t.id === currentVal2; })){
            seatPriceTicketTypeSelect.value = currentVal2;
          }
        }

        refreshBlocksList();
        updateSeatPricingSummary();
      }catch(e){
        // soft-fail; blocks & pricing still work with no ticket types
      }
    }

    async function reloadSeatMaps(){
      smStatus.textContent = 'Loading seat maps…';
      smSelect.innerHTML = '';
      seatMapsData = [];
      currentSeatMapId = null;

      try{
        let qs = 'showId='+encodeURIComponent(showId);
        if(venueId) qs += '&venueId='+encodeURIComponent(venueId);
        const maps = await j('/admin/seatmaps?'+qs);

        if(!Array.isArray(maps) || !maps.length){
          smStatus.textContent = 'No seat maps yet. Create one below.';
          smTip.textContent = 'Create a map for this show; you can optionally reuse it for future dates at this venue.';
          seatCanvas.innerHTML = '<div class="muted">No seat map selected.</div>';
          hideGuides();
          layout = { seats:{}, elements:[] };
          refreshBlocksList();
          updateSeatPricingSummary();
          return;
        }

        seatMapsData = maps;
        smStatus.textContent = maps.length+' seat map'+(maps.length>1?'s':'')+' found.';
        smSelect.innerHTML = maps.map(function(m){
          let label = m.name || 'Untitled map';
          if(m.isDefault) label += ' (default)';
          return '<option value="'+m.id+'">'+label+'</option>';
        }).join('');

        const def = maps.find(function(m){ return m.isDefault; }) || maps[0];
        currentSeatMapId = def.id;
        smSelect.value = currentSeatMapId;

        layout = (def.layout && typeof def.layout === 'object')
          ? def.layout
          : { seats:{}, elements:[] };

        clearSelection();
        await reloadSeats();
        refreshBlocksList();
        updateSeatPricingSummary();
      }catch(e){
        smStatus.textContent = 'Failed to load seat maps';
        smErr.textContent = e.message || String(e);
      }
    }

    async function reloadSeats(){
      if(!currentSeatMapId){
        seatCanvas.innerHTML = '<div class="muted">No seat map selected.</div>';
        hideGuides();
        return;
      }
      try{
        seats = await j('/seatmaps/'+currentSeatMapId+'/seats');
        renderSeats();
        refreshBlocksList();
        updateSeatPricingSummary();
      }catch(e){
        seatCanvas.innerHTML = '<div class="error">Failed to load seats: '+(e.message||e)+'</div>';
        hideGuides();
      }
    }

    function renderSeats(){
      seatCanvas.innerHTML = '';
      hideGuides();
      ensureLayout();

      if(!Array.isArray(seats) || !seats.length){
        seatCanvas.innerHTML = '<div class="muted">No seats yet. Use the quick generator on the left.</div>';
        seatCanvas.appendChild(guideH);
        seatCanvas.appendChild(guideV);
        hideGuides();
        return;
      }

      const hasPositions = Object.keys(layout.seats).length > 0;
      if(!hasPositions){
        // Default grid positions if no layout yet
        const rowsMap = {};
        seats.forEach(function(s){
          const key = s.rowLabel || s.row || '';
          if(!rowsMap[key]) rowsMap[key] = [];
          rowsMap[key].push(s);
        });

        const rowKeys = Object.keys(rowsMap).sort();
        const offsetX = 40;
        const offsetY = 30;
        const dx = 24;
        const dy = 24;

        rowKeys.forEach(function(rowKey, rowIndex){
          const rowSeats = rowsMap[rowKey].sort(function(a,b){
            const an = a.seatNumber != null ? a.seatNumber : a.number;
            const bn = b.seatNumber != null ? b.seatNumber : b.number;
            return an - bn;
          });
          const y = offsetY + rowIndex * dy;
          rowSeats.forEach(function(s, colIndex){
            const x = offsetX + colIndex * dx;
            const meta = ensureSeatMeta(s.id);
            meta.x = x;
            meta.y = y;
          });
        });
      }

      seats.forEach(function(s){
        const meta = ensureSeatMeta(s.id);
        const pos = { x: meta.x, y: meta.y };

        const seatEl = document.createElement('div');
        seatEl.className = 'seat';
        if(s.status === 'BLOCKED') seatEl.classList.add('seat-blocked');
        if(s.status === 'HELD')    seatEl.classList.add('seat-held');
        if(s.status === 'SOLD')    seatEl.classList.add('seat-sold');

        seatEl.setAttribute('data-seat-id', s.id);
        seatEl.style.position = 'absolute';
        seatEl.style.left = (pos.x - 9)+'px';
        seatEl.style.top  = (pos.y - 9)+'px';

        const labelRow  = s.rowLabel || s.row || '';
        const labelSeat = (s.seatNumber != null ? s.seatNumber : s.number);
        let title = labelRow+' '+labelSeat;
        const ttLabel = meta.ticketTypeId ? ticketTypeLabelForId(meta.ticketTypeId) : '';
        if(ttLabel){
          title += ' · '+ttLabel;
        }
        seatEl.title = title;
        seatEl.textContent = labelSeat;

        if(selectedSeatIds.has(s.id)){
          seatEl.classList.add('seat-selected');
        }

        seatCanvas.appendChild(seatEl);
      });

      // Block overlays
      ensureLayout();
      const blocks = layout.elements.filter(function(e){ return e && e.type === 'block' && Array.isArray(e.seatIds) && e.seatIds.length; });
      blocks.forEach(function(b){
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        b.seatIds.forEach(function(id){
          const meta = layout.seats[id];
          if(!meta) return;
          const pos = meta;
          if(pos.x < minX) minX = pos.x;
          if(pos.x > maxX) maxX = pos.x;
          if(pos.y < minY) minY = pos.y;
          if(pos.y > maxY) maxY = pos.y;
        });
        if(!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;

        const overlay = document.createElement('div');
        overlay.className = 'seat-block-overlay';
        if(selectedBlockId === b.id) overlay.classList.add('selected');
        overlay.setAttribute('data-block-id', b.id);

        const padding = 12;
        const width = (maxX - minX) + padding*2;
        const height = (maxY - minY) + padding*2;

        overlay.style.left = (minX - padding)+'px';
        overlay.style.top  = (minY - padding)+'px';
        overlay.style.width = width+'px';
        overlay.style.height = height+'px';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'seat-block-overlay-label';
        labelSpan.textContent = b.name
          ? (b.zone ? (b.name+' – '+b.zone) : b.name)
          : (b.zone || 'Block');

        const handleSpan = document.createElement('span');
        handleSpan.className = 'seat-block-overlay-handle';
        handleSpan.textContent = '⋮⋮';

        overlay.appendChild(labelSpan);
        overlay.appendChild(handleSpan);

        seatCanvas.appendChild(overlay);
      });

      seatCanvas.appendChild(guideH);
      seatCanvas.appendChild(guideV);
    }

    // Switch between different maps
    smSelect.addEventListener('change', async function(){
      const id = smSelect.value;
      currentSeatMapId = id || null;
      const found = seatMapsData.find(function(m){ return m.id === id; });
      if(found && found.layout && typeof found.layout === 'object'){
        layout = found.layout;
      }else{
        layout = { seats:{}, elements:[] };
      }
      clearSelection();
      await reloadSeats();
      refreshBlocksList();
      updateSeatPricingSummary();
    });

    // Create new seat map
    smCreate.addEventListener('click', async function(){
      smErr.textContent = '';
      const name = smName.value.trim();
      if(!name){
        smErr.textContent = 'Name is required';
        return;
      }
      try{
        const body = { showId: showId, name: name };
        if(venueId) body.venueId = venueId;
        const created = await j('/admin/seatmaps',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        smName.value = '';
        await reloadSeatMaps();
        const newId =
          (created && (
            created.id ||
            (created.map && created.map.id) ||
            (created.item && created.item.id)
          )) || null;
        if(newId){
          currentSeatMapId = newId;
          smSelect.value = currentSeatMapId;
        } else if (seatMapsData[0]) {
          currentSeatMapId = seatMapsData[0].id;
          smSelect.value = currentSeatMapId;
        }
        layout = { seats:{}, elements:[] };
        clearSelection();
        await reloadSeats();
        refreshBlocksList();
        updateSeatPricingSummary();
      }catch(e){
        smErr.textContent = e.message || String(e);
      }
    });

    // Quick generator → /seatmaps/:id/seats/bulk
    qGenerate.addEventListener('click', async function(){
      if(!currentSeatMapId){
        alert('Select or create a seat map first.');
        return;
      }
      const rows = Number(qRows.value) || 0;
      const cols = Number(qCols.value) || 0;
      if(rows <= 0 || cols <= 0){
        alert('Rows and seats per row must be positive numbers.');
        return;
      }
      const seatsPayload = [];
      for(let r=0;r<rows;r++){
        const rowLabel = String.fromCharCode(65 + r);
        for(let c=0;c<cols;c++){
          seatsPayload.push({
            row: rowLabel,
            number: c+1,
            rowLabel: rowLabel,
            seatNumber: c+1
          });
        }
      }
      try{
        await j('/seatmaps/'+currentSeatMapId+'/seats/bulk',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ seats: seatsPayload })
        });
        clearSelection();
        await reloadSeats();
      }catch(e){
        alert('Failed to generate seats: '+(e.message||e));
      }
    });

    // Create block from current selection (with metadata)
    blockCreateBtn.addEventListener('click', function(){
      ensureLayout();
      const seatIds = Array.from(selectedSeatIds);
      if(!seatIds.length){
        alert('Select one or more seats first.');
        return;
      }
      const blocks = layout.elements.filter(function(e){ return e && e.type === 'block'; });
      const name = (blockNameInput.value || '').trim() || ('Block '+(blocks.length+1));

      let capacity = null;
      const capStr = (blockCapacityInput && blockCapacityInput.value || '').trim();
      if(capStr){
        const n = Number(capStr);
        if(Number.isFinite(n) && n >= 0){
          capacity = n;
        }
      }

      const zone = (blockZoneInput && blockZoneInput.value || '').trim() || null;
      const ticketTypeId = (blockTicketTypeSelect && blockTicketTypeSelect.value) || null;

      const id = 'block_'+Date.now()+'_'+Math.floor(Math.random()*1000);
      layout.elements.push({
        id: id,
        type: 'block',
        name: name,
        seatIds: seatIds.slice(),
        capacity: capacity,
        zone: zone,
        ticketTypeId: ticketTypeId
      });

      if(blockNameInput) blockNameInput.value = '';
      if(blockCapacityInput) blockCapacityInput.value = '';
      if(blockZoneInput) blockZoneInput.value = '';
      if(blockTicketTypeSelect) blockTicketTypeSelect.value = '';

      selectedBlockId = id;
      refreshBlocksList();
      renderSeats();
    });

    // Seat pricing: assign / clear ticket type from selected seats
    seatPriceAssignBtn.addEventListener('click', function(){
      const ttId = seatPriceTicketTypeSelect && seatPriceTicketTypeSelect.value;
      if(!ttId){
        alert('Choose a ticket type first.');
        return;
      }
      if(!selectedSeatIds.size){
        alert('Select one or more seats first.');
        return;
      }
      ensureLayout();
      selectedSeatIds.forEach(function(id){
        const meta = ensureSeatMeta(id);
        meta.ticketTypeId = ttId;
      });
      renderSeats();
      updateSeatPricingSummary();
    });

    seatPriceClearBtn.addEventListener('click', function(){
      if(!selectedSeatIds.size){
        alert('Select one or more seats to clear.');
        return;
      }
      ensureLayout();
      selectedSeatIds.forEach(function(id){
        const meta = ensureSeatMeta(id);
        if(meta.ticketTypeId){
          meta.ticketTypeId = null;
        }
      });
      renderSeats();
      updateSeatPricingSummary();
    });

    // Drag behaviour with snap + alignment guides + group move (seats or blocks)
    const GRID_SIZE = 4;
    const SNAP_DIST = 8;
    let dragState = null;

    seatCanvas.addEventListener('mousedown', function(e){
      // First: check if clicking a block overlay
      const blockEl = e.target && e.target.closest ? e.target.closest('.seat-block-overlay') : null;
      if(blockEl){
        const blockId = blockEl.getAttribute('data-block-id');
        if(blockId){
          ensureLayout();
          const block = layout.elements.find(function(el){ return el && el.id === blockId && el.type === 'block'; });
          if(block && Array.isArray(block.seatIds) && block.seatIds.length){
            clearSelection();
            block.seatIds.forEach(function(seatId){ addSeatToSelection(seatId); });
            selectedBlockId = blockId;
            renderSeats();

            if(e.button === 0){
              ensureLayout();
              const seatIds = Array.from(selectedSeatIds);
              const startPositions = {};
              seatIds.forEach(function(id){
                const meta = ensureSeatMeta(id);
                startPositions[id] = {
                  x: meta.x,
                  y: meta.y
                };
              });

              dragState = {
                seatIds: seatIds,
                anchorSeatId: seatIds[0],
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                startPositions: startPositions
              };
            }
          }
        }
        e.preventDefault();
        return;
      }

      const seatEl = e.target && e.target.closest ? e.target.closest('.seat') : null;

      // Clicked on empty canvas: clear selection
      if(!seatEl){
        clearSelection();
        renderSeats();
        return;
      }

      const seatId = seatEl.getAttribute('data-seat-id');
      if(!seatId || seatEl.classList.contains('seat-sold')) return;

      // selection logic
      if(e.altKey){
        selectRowForSeat(seatId);
      }else if(e.shiftKey || e.metaKey || e.ctrlKey){
        if(selectedSeatIds.has(seatId)){
          selectedSeatIds.delete(seatId);
          seatEl.classList.remove('seat-selected');
        }else{
          addSeatToSelection(seatId);
        }
        recomputeSelectedBlockFromSeats();
        renderSeats();
      }else{
        selectSingleSeat(seatId);
      }

      // start drag for left button
      if(e.button === 0 && selectedSeatIds.size){
        ensureLayout();
        const seatIds = Array.from(selectedSeatIds);
        const startPositions = {};
        seatIds.forEach(function(id){
          const meta = ensureSeatMeta(id);
          startPositions[id] = {
            x: meta.x,
            y: meta.y
          };
        });

        dragState = {
          seatIds: seatIds,
          anchorSeatId: seatId,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startPositions: startPositions
        };
      }

      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e){
      if(!dragState) return;

      const rect = seatCanvas.getBoundingClientRect();
      const dxScreen = e.clientX - dragState.startMouseX;
      const dyScreen = e.clientY - dragState.startMouseY;

      const dx = dxScreen / zoom;
      const dy = dyScreen / zoom;

      const widthLogical = rect.width / zoom;
      const heightLogical = rect.height / zoom;

      ensureLayout();

      const anchorId = dragState.anchorSeatId;
      const anchorStart = dragState.startPositions[anchorId];
      if(!anchorStart) return;

      let anchorX = anchorStart.x + dx;
      let anchorY = anchorStart.y + dy;

      // Snap to grid
      anchorX = Math.round(anchorX / GRID_SIZE) * GRID_SIZE;
      anchorY = Math.round(anchorY / GRID_SIZE) * GRID_SIZE;

      const PADDING = 10;
      anchorX = Math.max(PADDING, Math.min(widthLogical  - PADDING, anchorX));
      anchorY = Math.max(PADDING, Math.min(heightLogical - PADDING, anchorY));

      let snapX = null;
      let snapY = null;
      const canvasCenterX = widthLogical / 2;
      const canvasCenterY = heightLogical / 2;

      seats.forEach(function(s){
        const meta = layout.seats[s.id];
        if(!meta) return;
        if(dragState.seatIds.indexOf(s.id) !== -1) return;
        const pos = meta;
        if(Math.abs(anchorX - pos.x) <= SNAP_DIST){
          snapX = pos.x;
        }
        if(Math.abs(anchorY - pos.y) <= SNAP_DIST){
          snapY = pos.y;
        }
      });

      if(Math.abs(anchorX - canvasCenterX) <= SNAP_DIST){
        snapX = canvasCenterX;
      }
      if(Math.abs(anchorY - canvasCenterY) <= SNAP_DIST){
        snapY = canvasCenterY;
      }

      if(snapX != null) anchorX = snapX;
      if(snapY != null) anchorY = snapY;

      if(snapY != null){
        showGuideH(anchorY);
      }else{
        guideH.style.display = 'none';
      }
      if(snapX != null){
        showGuideV(anchorX);
      }else{
        guideV.style.display = 'none';
      }

      const adjustDx = anchorX - (anchorStart.x + dx);
      const adjustDy = anchorY - (anchorStart.y + dy);

      dragState.seatIds.forEach(function(id){
        const base = dragState.startPositions[id];
        let x = base.x + dx + adjustDx;
        let y = base.y + dy + adjustDy;

        const PADDING = 10;
        x = Math.max(PADDING, Math.min(widthLogical  - PADDING, x));
        y = Math.max(PADDING, Math.min(heightLogical - PADDING, y));

        const meta = ensureSeatMeta(id);
        meta.x = x;
        meta.y = y;

        const el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
        if(el){
          el.style.left = (x - 9)+'px';
          el.style.top  = (y - 9)+'px';
        }
      });

      renderSeats();
    });

    document.addEventListener('mouseup', function(){
      dragState = null;
      hideGuides();
    });

    // Save layout → PATCH /admin/seatmaps/:id/layout
    saveLayoutBtn.addEventListener('click', async function(){
      if(!currentSeatMapId){
        alert('No seat map selected.');
        return;
      }
      ensureLayout();

      // Enforce: if multiple ticket types exist, every seat must have a ticketTypeId
      if(ticketTypes && ticketTypes.length > 1){
        let unassigned = 0;
        seats.forEach(function(s){
          const meta = layout.seats[s.id];
          if(!meta || !meta.ticketTypeId){
            unassigned++;
          }
        });
        if(unassigned > 0){
          alert('There are '+unassigned+' seats not assigned to a ticket type. When using multiple prices, every seat must be allocated. Please assign them before saving.');
          return;
        }
      }

      try{
        await j('/admin/seatmaps/'+currentSeatMapId+'/layout',{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ layout: layout })
        });
        alert('Layout saved');
      }catch(e){
        alert('Failed to save layout: '+(e.message||e));
      }
    });

    // Initial load
    await loadTicketTypesForShow();
    reloadSeatMaps();
  }

  // ---------- Simple stubs for other views ----------

  function orders(){
    main.innerHTML = '<div class="card"><div class="title">Orders</div><div class="muted">Orders view coming soon.</div></div>';
  }

  function venues(){
    main.innerHTML = '<div class="card"><div class="title">Venues</div><div class="muted">Venue management UI coming soon (data API already exists).</div></div>';
  }

  function analytics(){
    main.innerHTML = '<div class="card"><div class="title">Analytics</div><div class="muted">Analytics dashboard coming soon.</div></div>';
  }

  function audiences(){
    main.innerHTML = '<div class="card"><div class="title">Audiences</div><div class="muted">Audience tools coming soon.</div></div>';
  }

  function emailPage(){
    main.innerHTML = '<div class="card"><div class="title">Email Campaigns</div><div class="muted">Email campaign tools will plug into your existing Mailchimp/automation stack.</div></div>';
  }

  function account(){
    main.innerHTML = '<div class="card"><div class="title">Account</div><div class="muted">Account settings coming soon.</div></div>';
  }

   // Kick off initial route on page load
  console.log('[Admin UI] initial route()');
  route();
})();

</script>
</body>
</html>`);
  }
);

export default router;
