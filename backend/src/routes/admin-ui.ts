// backend/src/routes/admin-ui.ts
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/** Single-page admin console at /admin/ui */
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
  <main class="content" id="main">
    <div class="card"><div class="title">Loading…</div></div>
  </main>
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

  // --- Simple home view ---
  function home(){
    if (!main) {
      console.error('[Admin UI] #main element not found');
      return;
    }
    main.innerHTML =
      '<div class="card"><div class="title">Welcome</div>' +
      '<div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }

  // ========= ROUTER =========
  function route(){
    try {
      const path = location.pathname.replace(/\\/$/, '');
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

  // -------- Venues search + inline create --------
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
    if (!main) return;
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

        go('/admin/ui/shows/' + showId + '/tickets');
      }catch(e){
        errEl.textContent = e.message || String(e);
      }
    });
  }

  // ---------- Shows list ----------
  async function listShows(){
    if (!main) return;
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
      if (!main) return;
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    if (!main) return;
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

  // ---------- Tickets page ----------
  async function ticketsPage(id){
    if (!main) return;
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
      +'</div>`;

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
        seatMapsSummary.textContent = 'Failed to load seat maps: '+(e.message||e);
        seatMapsList.innerHTML = '';
      }
    }

    $('#refreshSeatMaps').addEventListener('click', function(){
      loadSeatMaps();
    });
    $('#editSeatMaps').addEventListener('click', function(){
      go('/admin/ui/shows/'+id+'/seating');
    });

    loadSeatMaps();

    // Ticket structure selection (purely visual for now)
    const structureGeneral = $('#structureGeneral');
    const structureAllocated = $('#structureAllocated');
    function setStructure(mode){
      if(mode === 'allocated'){
        structureAllocated.style.background = '#111827';
        structureAllocated.style.color = '#fff';
        structureGeneral.style.background = '#f9fafb';
        structureGeneral.style.color = '#111827';
      }else{
        structureGeneral.style.background = '#111827';
        structureGeneral.style.color = '#fff';
        structureAllocated.style.background = '#f9fafb';
        structureAllocated.style.color = '#111827';
      }
    }
    structureGeneral.addEventListener('click', function(){ setStructure('general'); });
    structureAllocated.addEventListener('click', function(){ setStructure('allocated'); });
    setStructure(show.usesAllocatedSeating ? 'allocated' : 'general');
  }

  // ---------- Seating map builder (placeholder for now) ----------
  async function seatingPage(id){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Seating map</div>'
            +'<div class="muted">Visual seat map editor coming soon. For now this is a placeholder view.</div>'
          +'</div>'
          +'<div class="row">'
            +'<button class="btn" id="backTickets">Back to tickets</button>'
            +'<button class="btn" id="backShows">Back to all events</button>'
          +'</div>'
        +'</div>'
        +'<div class="seat-layout-wrap">'
          +'<div class="seat-stage">Stage</div>'
          +'<div class="seat-stage-bar"></div>'
          +'<div class="muted" style="margin-top:12px;font-size:13px">'
            +'In a future version you’ll be able to draw rows and sections here, then link them to ticket types.'
          +'</div>'
        +'</div>'
      +'</div>';

    $('#backTickets').addEventListener('click', function(){
      go('/admin/ui/shows/'+id+'/tickets');
    });
    $('#backShows').addEventListener('click', function(){
      go('/admin/ui/shows/current');
    });
  }

  // ---------- Orders ----------
  async function orders(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Orders</div></div>'
        +'<div class="muted">Order management UI will appear here. For now this is a simple placeholder.</div>'
      +'</div>';
  }

  // ---------- Venues ----------
  async function venues(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Venues</div></div>'
        +'<div class="muted">Venue management UI will be built here shortly.</div>'
      +'</div>';
  }

  // ---------- Analytics ----------
  async function analytics(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Analytics</div></div>'
        +'<div class="muted">Sales and traffic analytics will be visualised here.</div>'
      +'</div>';
  }

  // ---------- Audiences ----------
  async function audiences(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Audiences</div></div>'
        +'<div class="muted">Audience segments and saved lists will live here.</div>'
      +'</div>';
  }

  // ---------- Email Campaigns ----------
  async function emailPage(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Email Campaigns</div></div>'
        +'<div class="muted">Email scheduling and templates will be managed here.</div>'
      +'</div>';
  }

  // ---------- Account ----------
  async function account(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="title">Account</div>'
        +'<div class="muted">Update your profile and login details here (coming soon).</div>'
      +'</div>';
  }

  // Kick things off
  route();
})();
</script>
</body>
</html>`);
  }
);

export default router;

