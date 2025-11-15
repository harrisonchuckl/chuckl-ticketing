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
  .seat{width:18px;height:18px;border-radius:4px;background:var(--seat-bg);border:1px solid var(--seat-border);display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:transform .05s ease-out,box-shadow .05s ease-out}
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
  .seat-block-overlay-label{font-weight:500;}
  .seat-block-overlay-handle{font-size:10px;opacity:.8;margin-left:8px;}
  .seat-block-overlay.selected{border-style:solid;border-color:#f97316;}
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
  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.from((r||document).querySelectorAll(s)); };
  var main = $('#main');

  // Sidebar nested menu
  var showsToggle = $('#showsToggle');
  var showsSub = $('#showsSub');

  if (showsToggle && showsSub) {
    showsToggle.addEventListener('click', function(e){
      e.preventDefault();
      showsSub.style.display = showsSub.style.display === 'none' ? 'block' : 'none';
    });
  } else {
    console.warn('[Admin UI] showsToggle or showsSub not found', { showsToggle: showsToggle, showsSub: showsSub });
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
    var t = e.target;
    var a = t && t.closest && t.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault();
      go(a.getAttribute('data-view'));
    }
  });

  window.addEventListener('popstate', route);

  function home(){
    if (!main) {
      console.error('[Admin UI] #main element not found');
      return;
    }
    main.innerHTML =
      '<div class="card"><div class="title">Welcome</div>' +
      '<div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
  }

  function route(){
    try {
      var path = location.pathname.replace(/\\/$/, '');
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
    var container = document.createElement('div');
    container.style.position = 'relative';
    if (input.parentNode) {
      input.parentNode.insertBefore(container, input);
    }
    container.appendChild(input);

    var pop = document.createElement('div');
    pop.className = 'pop';
    container.appendChild(pop);

    function close(){ pop.classList.remove('open'); }

    function render(list,q){
      pop.innerHTML = '';
      if(list.length){
        list.forEach(function(v){
          var el = document.createElement('div');
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
        var add = document.createElement('div');
        add.className = 'opt';
        add.innerHTML = '➕ Create venue “'+q+'”';
        add.addEventListener('click', async function(){
          try{
            var created = await j('/admin/venues',{
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
      var q = input.value.trim();
      if(!q){ close(); return; }
      var list = await searchVenues(q);
      render(list, q);
    });

    input.addEventListener('focus', async function(){
      var q = input.value.trim();
      if(!q) return;
      var list = await searchVenues(q);
      render(list, q);
    });

    document.addEventListener('click', function(e){
      if(!pop.contains(e.target) && e.target !== input) close();
    });
  }

  // ---------- Upload helper ----------
  async function uploadPoster(file){
    var form = new FormData();
    form.append('file', file);
    var res = await fetch('/admin/uploads',{ method:'POST', body: form, credentials:'include' });
    var txt = await res.text();
    if(!res.ok) throw new Error(txt || ('HTTP '+res.status));
    var data = txt ? JSON.parse(txt) : {};
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
        var cmd = b.getAttribute('data-cmd') || '';
        if (cmd) document.execCommand(cmd);
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

    var drop = $('#drop');
    var file = $('#file');
    var bar  = $('#bar');
    var prev = $('#prev');

    async function doUpload(f){
      $('#err').textContent = '';
      bar.style.width = '15%';
      try{
        var out = await uploadPoster(f);
        prev.src = out.url;
        prev.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width = '0%'; }, 800);
      }catch(e){
        bar.style.width = '0%';
        $('#err').textContent = 'Upload failed: ' + (e.message || e);
      }
    }

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
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await doUpload(f);
    });

    file.addEventListener('change', async function(){
      var f = file.files && file.files[0];
      if (f) await doUpload(f);
    });

    var saveBtn = document.getElementById('save');

    saveBtn.addEventListener('click', async function(){
      var errEl = document.getElementById('err');
      errEl.textContent = '';

      try{
        var title      = (document.getElementById('sh_title') ).value.trim();
        var dtRaw      = (document.getElementById('sh_dt') ).value;
        var venueInput = document.getElementById('venue_input');
        var venueText  = venueInput.value.trim();
        var venueId    = (venueInput.dataset || {}).venueId || null;
        var imageUrl   = prev.src || null;
        var descHtml   = (document.getElementById('desc')).innerHTML.trim();

        if (!title || !dtRaw || !venueText){
          throw new Error('Title, date/time and venue are required');
        }

        var dateIso = new Date(dtRaw).toISOString();

        var ftName        = (document.getElementById('ft_name')).value.trim();
        var ftPriceStr    = (document.getElementById('ft_price')).value.trim();
        var ftAllocStr    = (document.getElementById('ft_allocation')).value.trim();

        var firstTicketPayload = null;
        if (ftName || ftPriceStr || ftAllocStr){
          var pricePence = 0;
          if (ftPriceStr){
            var p = Number(ftPriceStr);
            if (!Number.isFinite(p) || p < 0){
              throw new Error('First ticket price must be a non-negative number');
            }
            pricePence = Math.round(p * 100);
          }
          var available = null;
          if (ftAllocStr){
            var a = Number(ftAllocStr);
            if (!Number.isFinite(a) || a < 0){
              throw new Error('First ticket allocation must be a non-negative number');
            }
            available = a;
          }

          firstTicketPayload = {
            name: ftName || 'General Admission',
            pricePence: pricePence,
            available: available
          };
        }

        var showRes = await j('/admin/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            date: dateIso,
            venueText: venueText,
            venueId: venueId,
            imageUrl: imageUrl,
            descriptionHtml: descHtml
          })
        });

        if (showRes && showRes.error) {
          throw new Error(showRes.error);
        }

        var showId =
          (showRes &&
            (
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
      var tb = document.getElementById('tbody');
      tb.innerHTML = '<tr><td colspan="7" class="muted">Loading…</td></tr>';
      try{
        var jn = await j('/admin/shows');
        var items = jn.items || [];
        tb.innerHTML = items.map(function(s){
          var when = s.date ? new Date(s.date).toLocaleString('en-GB',{dateStyle:'short', timeStyle:'short'}) : '';
          var total = (s._alloc && s._alloc.total) || 0;
          var sold  = (s._alloc && s._alloc.sold) || 0;
          var hold  = (s._alloc && s._alloc.hold) || 0;
          var avail = Math.max(total-sold-hold,0);
          var pct   = total ? Math.round((sold/total)*100) : 0;
          var bar   = '<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px"><div style="background:#111827;height:6px;width:'+pct+'%"></div></div>';
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
            var id = b.getAttribute('data-kebab');
            var m  = document.getElementById('m-'+id);
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
            if (m) m.classList.add('open');
          });
        });

        document.addEventListener('click', function(e){
          var target = e.target;
          if(!target || !target.closest || !target.closest('.kebab')){
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
          }
        });

        $$('[data-edit]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            var id = a.getAttribute('data-edit');
            if (id) go('/admin/ui/shows/'+id+'/edit');
          });
        });

        $$('[data-seating]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            var id = a.getAttribute('data-seating');
            if (id) go('/admin/ui/shows/'+id+'/seating');
          });
        });

        $$('[data-tickets]').forEach(function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            var id = a.getAttribute('data-tickets');
            if (id) go('/admin/ui/shows/'+id+'/tickets');
          });
        });

        $$('[data-dup]').forEach(function(a){
          a.addEventListener('click', async function(e){
            e.preventDefault();
            try{
              var id = a.getAttribute('data-dup');
              if(!id) return;
              var r  = await j('/admin/shows/'+id+'/duplicate',{method:'POST'});
              if(r.ok && r.newId){ go('/admin/ui/shows/'+r.newId+'/edit'); }
            }catch(err){
              alert('Duplicate failed: '+(err.message||err));
            }
          });
        });
      }catch(e){
        tb.innerHTML = '<tr><td colspan="7" class="error">Failed to load shows: '+(e.message||e)+'</td></tr>';
      }
    }

    var refreshBtn = document.getElementById('refresh');
    refreshBtn.addEventListener('click', load);
    load();
  }

  // ---------- Edit show ----------
  async function editShow(id){
    var s = null;
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
    mountVenuePicker(document.getElementById('venue_input'));

    (document.getElementById('sh_title')).value = (s.item && s.item.title) || '';
    var venueInput = document.getElementById('venue_input');
    venueInput.value =
      (s.item && s.item.venue && s.item.venue.name) ||
      (s.item && s.item.venueText) || '';

    if (s.item && s.item.date){
      var dt = new Date(s.item.date);
      (document.getElementById('sh_dt')).value = dt.toISOString().slice(0,16);
    }

    (document.getElementById('desc')).innerHTML = (s.item && s.item.description) || '';

    if (s.item && s.item.imageUrl){
      var prev = document.getElementById('prev');
      prev.src = s.item.imageUrl;
      prev.style.display = 'block';
    }

    var drop = document.getElementById('drop');
    var file = document.getElementById('file');
    var bar  = document.getElementById('bar');
    var prevImg = document.getElementById('prev');

    async function doUpload(f){
      (document.getElementById('err')).textContent = '';
      bar.style.width = '15%';
      try{
        var out = await uploadPoster(f);
        prevImg.src = out.url;
        prevImg.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width='0%'; },800);
      }catch(e){
        bar.style.width = '0%';
        (document.getElementById('err')).textContent = 'Upload failed: '+(e.message||e);
      }
    }

    drop.addEventListener('click', function(){ file.click(); });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });

    drop.addEventListener('drop', async function(e){
      e.preventDefault(); drop.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });

    file.addEventListener('change', async function(){
      var f = file.files && file.files[0];
      if(f) await doUpload(f);
    });

    (document.getElementById('goSeating')).addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/'+id+'/seating');
    });

    (document.getElementById('goTickets')).addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/'+id+'/tickets');
    });

    (document.getElementById('save')).addEventListener('click', async function(){
      var errEl = document.getElementById('err');
      errEl.textContent = '';
      try{
        var payload = {
          title: (document.getElementById('sh_title')).value.trim(),
          date: (document.getElementById('sh_dt')).value
            ? new Date((document.getElementById('sh_dt')).value).toISOString()
            : null,
          venueText: venueInput.value.trim(),
          venueId: (venueInput.dataset || {}).venueId || null,
          imageUrl: prevImg.src || null,
          descriptionHtml: (document.getElementById('desc')).innerHTML.trim()
        };
        if(!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
          throw new Error('Title, date/time, venue and description are required');
        }
        var r = await j('/admin/shows/'+id,{
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
        errEl.textContent = e.message || String(e);
      }
    });
  }

  // ---------- Tickets page ----------
  async function ticketsPage(id){
    if (!main) return;

    main.innerHTML = '<div class="card"><div class="title">Loading tickets…</div></div>';
    var showResp;
    try{
      showResp = await j('/admin/shows/'+id);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    var show = showResp.item || {};
    var when = show.date ? new Date(show.date).toLocaleString('en-GB',{dateStyle:'full', timeStyle:'short'}) : '';
    var venueName = show.venue ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : '')) : (show.venueText || '');

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

    document.getElementById('backToShows').addEventListener('click', function(){ go('/admin/ui/shows/current'); });
    document.getElementById('editShowBtn').addEventListener('click', function(){ go('/admin/ui/shows/'+id+'/edit'); });

    var addTypeForm = document.getElementById('addTypeForm');
    var ticketTypesBody = document.getElementById('ticketTypesBody');
    var ticketTypesEmpty = document.getElementById('ticketTypesEmpty');

    document.getElementById('addTypeBtn').addEventListener('click', function(){
      addTypeForm.style.display = 'block';
      document.getElementById('tt_name').focus();
    });

    document.getElementById('tt_cancel').addEventListener('click', function(){
      addTypeForm.style.display = 'none';
      document.getElementById('tt_err').textContent = '';
    });

    async function loadTicketTypes(){
      try{
        var res = await j('/admin/shows/'+id+'/ticket-types');
        var items = res.ticketTypes || [];
        if(!items.length){
          ticketTypesBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet.</td></tr>';
          ticketTypesEmpty.style.display = 'block';
        }else{
          ticketTypesEmpty.style.display = 'none';
          ticketTypesBody.innerHTML = items.map(function(tt){
            var price = (tt.pricePence || 0) / 100;
            var priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
            var availLabel = tt.available == null ? 'Unlimited' : String(tt.available);
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
              var idToDel = btn.getAttribute('data-del');
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

    document.getElementById('tt_save').addEventListener('click', async function(){
      var errEl = document.getElementById('tt_err');
      errEl.textContent = '';
      var name = document.getElementById('tt_name').value.trim();
      var priceStr = document.getElementById('tt_price').value.trim();
      var availStr = document.getElementById('tt_available').value.trim();

      if(!name){
        errEl.textContent = 'Name is required';
        return;
      }

      var pricePence = 0;
      if(priceStr){
        var p = Number(priceStr);
        if(!Number.isFinite(p) || p < 0){
          errEl.textContent = 'Price must be a non-negative number';
          return;
        }
        pricePence = Math.round(p * 100);
      }

      var available = null;
      if(availStr){
        var a = Number(availStr);
        if(!Number.isFinite(a) || a < 0){
          errEl.textContent = 'Available must be a non-negative number';
          return;
        }
        available = a;
      }

      try{
        await j('/admin/shows/'+id+'/ticket-types',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: name, pricePence: pricePence, available: available })
        });
        document.getElementById('tt_name').value = '';
        document.getElementById('tt_price').value = '';
        document.getElementById('tt_available').value = '';
        addTypeForm.style.display = 'none';
        loadTicketTypes();
      }catch(err){
        errEl.textContent = err.message || String(err);
      }
    });

    loadTicketTypes();

    var seatMapsSummary = document.getElementById('seatMapsSummary');
    var seatMapsList = document.getElementById('seatMapsList');
    var venueId = show.venue && show.venue.id ? show.venue.id : null;

    async function loadSeatMaps(){
      seatMapsSummary.textContent = 'Loading seat maps…';
      seatMapsList.innerHTML = '';
      try{
        var url = '/admin/seatmaps?showId='+encodeURIComponent(id);
        if(venueId) url += '&venueId='+encodeURIComponent(venueId);
        var maps = await j(url);
        if(!Array.isArray(maps) || !maps.length){
          seatMapsSummary.textContent = 'No seat maps yet for this show/venue.';
          seatMapsList.innerHTML = '<div class="muted" style="font-size:13px">You can create a seat map using the “Create / edit seat map” button.</div>';
          return;
        }
        seatMapsSummary.textContent = maps.length+' seat map'+(maps.length>1?'s':'')+' found.';
        seatMapsList.innerHTML = maps.map(function(m){
          var def = m.isDefault ? ' · <strong>Default</strong>' : '';
          return '<div class="row" style="margin-bottom:4px;justify-content:space-between">'
            +'<div><strong>'+m.name+'</strong> <span class="muted">v'+(m.version || 1)+'</span>'+def+'</div>'
            +'<div class="row" style="gap:4px">'+(!m.isDefault ? '<button class="btn" data-make-default="'+m.id+'">Make default</button>' : '')+'</div>'
          +'</div>';
        }).join('');

        $$('[data-make-default]', seatMapsList).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            var mapId = btn.getAttribute('data-make-default');
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

    document.getElementById('refreshSeatMaps').addEventListener('click', loadSeatMaps);
    document.getElementById('editSeatMaps').addEventListener('click', function(){ go('/admin/ui/shows/'+id+'/seating'); });

    loadSeatMaps();

    // Ticket structure selection (purely visual for now)
    var structureGeneral = $('#structureGeneral');
    var structureAllocated = $('#structureAllocated');
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

  // ---------- Seating page ----------
  async function seatingPage(showId){
    if (!main) return;

    main.innerHTML = '<div class="card"><div class="title">Loading seating…</div></div>';

    var showResp;
    try{
      showResp = await j('/admin/shows/'+showId);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }

    var show = showResp.item || {};
    var when = show.date ? new Date(show.date).toLocaleString('en-GB',{dateStyle:'full', timeStyle:'short'}) : '';
    var venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – '+show.venue.city : ''))
      : (show.venueText || '');
    var venueId = show.venue && show.venue.id ? show.venue.id : null;

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

    var backToTicketsBtn = document.getElementById('backToTickets');
    var editShowBtn      = document.getElementById('editShowBtn');
    var smStatus         = document.getElementById('sm_status');
    var smSelect         = document.getElementById('sm_select');
    var smTip            = document.getElementById('sm_tip');
    var smName           = document.getElementById('sm_name');
    var smCreate         = document.getElementById('sm_create');
    var smErr            = document.getElementById('sm_err');
    var qRows            = document.getElementById('q_rows');
    var qCols            = document.getElementById('q_cols');
    var qGenerate        = document.getElementById('q_generate');
    var seatCanvas       = document.getElementById('seatCanvas');
    var saveLayoutBtn    = document.getElementById('sm_saveLayout');

    var zoomInBtn        = document.getElementById('zoomInBtn');
    var zoomOutBtn       = document.getElementById('zoomOutBtn');
    var zoomResetBtn     = document.getElementById('zoomResetBtn');

    var blockNameInput   = document.getElementById('block_name');
    var blockCreateBtn   = document.getElementById('block_create');
    var blocksList       = document.getElementById('blocks_list');
    var blockCapacityInput = document.getElementById('block_capacity');
    var blockZoneInput     = document.getElementById('block_zone');
    var blockTicketTypeSelect = document.getElementById('block_ticketType');

    var seatPriceTicketTypeSelect   = document.getElementById('seat_price_ticketType');
    var seatPriceAssignBtn          = document.getElementById('seat_price_assign_selection');
    var seatPriceClearBtn           = document.getElementById('seat_price_clear');
    var seatPriceSummary            = document.getElementById('seat_price_summary');

    backToTicketsBtn.addEventListener('click', function(){
      go('/admin/ui/shows/'+showId+'/tickets');
    });
    editShowBtn.addEventListener('click', function(){
      go('/admin/ui/shows/'+showId+'/edit');
    });

    var seatMapsData = [];
    var currentSeatMapId = null;
    var layout = { seats: {}, elements: [] };
    var seats = [];
    var ticketTypes = [];

    var selectedSeatIds = new Set();
    var selectedBlockId = null;

    var zoom = 1;
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
      var meta = layout.seats[id];
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
        var el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
        if(el) el.classList.remove('seat-selected');
      });
      selectedSeatIds.clear();
      selectedBlockId = null;
    }

    function addSeatToSelection(id){
      if(!selectedSeatIds.has(id)){
        selectedSeatIds.add(id);
        var el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
        if(el) el.classList.add('seat-selected');
      }
    }

    function recomputeSelectedBlockFromSeats(){
      ensureLayout();
      selectedBlockId = null;
      var sel = Array.from(selectedSeatIds);
      if(!sel.length) return;
      var blocks = layout.elements.filter(function(e){ return e && e.type === 'block' && Array.isArray(e.seatIds); });
      blocks.some(function(b){
        if(!b.seatIds || !b.seatIds.length) return false;
        var allIn = b.seatIds.every(function(id){ return selectedSeatIds.has(id); });
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
      var seat = seats.find(function(s){ return s.id === id; });
      if(!seat) return;
      var rowKey = seat.rowLabel || seat.row || '';
      clearSelection();
      seats.forEach(function(s){
        var key = s.rowLabel || s.row || '';
        if(key === rowKey){
          addSeatToSelection(s.id);
        }
      });
      recomputeSelectedBlockFromSeats();
      renderSeats();
    }

    var guideH = document.createElement('div');
    guideH.className = 'guide-line h';
    guideH.style.display = 'none';

    var guideV = document.createElement('div');
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
      var tt = ticketTypes.find(function(t){ return t.id === id; });
      if(!tt) return '';
      var price = (tt.pricePence || 0) / 100;
      var priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
      return tt.name + ' ('+priceLabel+')';
    }

    function updateSeatPricingSummary(){
      if(!seatPriceSummary) return;
      if(!Array.isArray(seats) || !seats.length){
        seatPriceSummary.textContent = 'No seats yet.';
        return;
      }
      ensureLayout();
      var countsByTt = {};
      var unassigned = 0;
      seats.forEach(function(s){
        var meta = layout.seats[s.id];
        var ttId = meta && meta.ticketTypeId;
        if(ttId){
          countsByTt[ttId] = (countsByTt[ttId] || 0) + 1;
        }else{
          unassigned++;
        }
      });
      var parts = [];
      Object.keys(countsByTt).forEach(function(ttId){
        var n = countsByTt[ttId];
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
      var blocks = layout.elements.filter(function(e){ return e && e.type === 'block'; });
      if(!blocks.length){
        blocksList.innerHTML = '<div class="muted">No blocks yet.</div>';
        return;
      }
      blocksList.innerHTML = blocks.map(function(b){
        var seatCount = Array.isArray(b.seatIds) ? b.seatIds.length : 0;
        var capacity = (typeof b.capacity === 'number' && b.capacity >= 0) ? b.capacity : seatCount;
        var zone = (b.zone || '').trim();
        var ttLabel = ticketTypeLabelForId(b.ticketTypeId);
        var bits = [];
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
          var id = btn.getAttribute('data-block-select');
          ensureLayout();
          var block = layout.elements.find(function(el){ return el && el.id === id && el.type === 'block'; });
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
          var id = btn.getAttribute('data-block-delete');
          if(!id) return;
          ensureLayout();
          var idx = layout.elements.findIndex(function(el){ return el && el.id === id && el.type === 'block'; });
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
        var res = await j('/admin/shows/'+showId+'/ticket-types');
        ticketTypes = res.ticketTypes || [];

        if(blockTicketTypeSelect){
          var currentVal = blockTicketTypeSelect.value;
          blockTicketTypeSelect.innerHTML = '<option value="">— None —</option>' +
            ticketTypes.map(function(tt){
              var price = (tt.pricePence || 0) / 100;
              var priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
              return '<option value="'+tt.id+'">'+tt.name+' ('+priceLabel+')</option>';
            }).join('');
          if(currentVal && ticketTypes.some(function(t){ return t.id === currentVal; })){
            blockTicketTypeSelect.value = currentVal;
          }
        }

        if(seatPriceTicketTypeSelect){
          var currentVal2 = seatPriceTicketTypeSelect.value;
          seatPriceTicketTypeSelect.innerHTML = '<option value="">— Choose ticket type —</option>' +
            ticketTypes.map(function(tt){
              var price = (tt.pricePence || 0) / 100;
              var priceLabel = price === 0 ? 'Free' : '£'+price.toFixed(2);
              return '<option value="'+tt.id+'">'+tt.name+' ('+priceLabel+')</option>';
            }).join('');
          if(currentVal2 && ticketTypes.some(function(t){ return t.id === currentVal2; })){
            seatPriceTicketTypeSelect.value = currentVal2;
          }
        }

        refreshBlocksList();
        updateSeatPricingSummary();
      }catch{
        // Ignore – still usable without ticket types
      }
    }

    async function reloadSeatMaps(){
      smStatus.textContent = 'Loading seat maps…';
      smSelect.innerHTML = '';
      seatMapsData = [];
      currentSeatMapId = null;

      try{
        var qs = 'showId='+encodeURIComponent(showId);
        if(venueId) qs += '&venueId='+encodeURIComponent(venueId);
        var maps = await j('/admin/seatmaps?'+qs);

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
          var label = m.name || 'Untitled map';
          if(m.isDefault) label += ' (default)';
          return '<option value="'+m.id+'">'+label+'</option>';
        }).join('');

        var def = maps.find(function(m){ return m.isDefault; }) || maps[0];
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

      var hasPositions = Object.keys(layout.seats).length > 0;
      if(!hasPositions){
        var rowsMap = {};
        seats.forEach(function(s){
          var key = s.rowLabel || s.row || '';
          if(!rowsMap[key]) rowsMap[key] = [];
          rowsMap[key].push(s);
        });

        var rowKeys = Object.keys(rowsMap).sort();
        var offsetX = 40;
        var offsetY = 30;
        var dx = 24;
        var dy = 24;

        rowKeys.forEach(function(rowKey, rowIndex){
          var rowSeats = rowsMap[rowKey].sort(function(a,b){
            var an = a.seatNumber != null ? a.seatNumber : a.number;
            var bn = b.seatNumber != null ? b.seatNumber : b.number;
            return an - bn;
          });
          var y = offsetY + rowIndex * dy;
          rowSeats.forEach(function(s, colIndex){
            var x = offsetX + colIndex * dx;
            var meta = ensureSeatMeta(s.id);
            meta.x = x;
            meta.y = y;
          });
        });
      }

      seats.forEach(function(s){
        var meta = ensureSeatMeta(s.id);
        var pos = { x: meta.x, y: meta.y };

        var seatEl = document.createElement('div');
        seatEl.className = 'seat';
        if(s.status === 'BLOCKED') seatEl.classList.add('seat-blocked');
        if(s.status === 'HELD')    seatEl.classList.add('seat-held');
        if(s.status === 'SOLD')    seatEl.classList.add('seat-sold');

        seatEl.setAttribute('data-seat-id', s.id);
        seatEl.style.position = 'absolute';
        seatEl.style.left = (pos.x - 9)+'px';
        seatEl.style.top  = (pos.y - 9)+'px';

        var labelRow  = s.rowLabel || s.row || '';
        var labelSeat = (s.seatNumber != null ? s.seatNumber : s.number);
        var title = labelRow+' '+labelSeat;
        var ttLabel = meta.ticketTypeId ? ticketTypeLabelForId(meta.ticketTypeId) : '';
        if(ttLabel){
          title += ' · '+ttLabel;
        }
        seatEl.title = title;
        seatEl.textContent = String(labelSeat);

        if(selectedSeatIds.has(s.id)){
          seatEl.classList.add('seat-selected');
        }

        seatCanvas.appendChild(seatEl);
      });

      ensureLayout();
      var blocks = layout.elements.filter(function(e){ return e && e.type === 'block' && Array.isArray(e.seatIds) && e.seatIds.length; });
      blocks.forEach(function(b){
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        b.seatIds.forEach(function(id){
          var meta = layout.seats[id];
          if(!meta) return;
          var pos = meta;
          if(pos.x < minX) minX = pos.x;
          if(pos.x > maxX) maxX = pos.x;
          if(pos.y < minY) minY = pos.y;
          if(pos.y > maxY) maxY = pos.y;
        });
        if(!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;

        var overlay = document.createElement('div');
        overlay.className = 'seat-block-overlay';
        if(selectedBlockId === b.id) overlay.classList.add('selected');
        overlay.setAttribute('data-block-id', b.id);

        var padding = 12;
        var width = (maxX - minX) + padding*2;
        var height = (maxY - minY) + padding*2;

        overlay.style.left = (minX - padding)+'px';
        overlay.style.top  = (minY - padding)+'px';
        overlay.style.width = width+'px';
        overlay.style.height = height+'px';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'seat-block-overlay-label';
        labelSpan.textContent = b.name
          ? (b.zone ? (b.name+' – '+b.zone) : b.name)
          : (b.zone || 'Block');

        var handleSpan = document.createElement('span');
        handleSpan.className = 'seat-block-overlay-handle';
        handleSpan.textContent = '⋮⋮';

        overlay.appendChild(labelSpan);
        overlay.appendChild(handleSpan);

        seatCanvas.appendChild(overlay);
      });

      seatCanvas.appendChild(guideH);
      seatCanvas.appendChild(guideV);
    }

    smSelect.addEventListener('change', async function(){
      var id = smSelect.value;
      currentSeatMapId = id || null;
      var found = seatMapsData.find(function(m){ return m.id === id; });
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

    smCreate.addEventListener('click', async function(){
      smErr.textContent = '';
      var name = smName.value.trim();
      if(!name){
        smErr.textContent = 'Name is required';
        return;
      }
      try{
        var body = { showId: showId, name: name };
        if(venueId) body.venueId = venueId;
        var created = await j('/admin/seatmaps',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        smName.value = '';
        await reloadSeatMaps();
        var newId =
          (created &&
            (
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

    qGenerate.addEventListener('click', async function(){
      if(!currentSeatMapId){
        alert('Select or create a seat map first.');
        return;
      }
      var rows = Number(qRows.value) || 0;
      var cols = Number(qCols.value) || 0;
      if(rows <= 0 || cols <= 0){
        alert('Rows and seats per row must be positive numbers.');
        return;
      }
      var seatsPayload = [];
      for(var r=0;r<rows;r++){
        var rowLabel = String.fromCharCode(65 + r);
        for(var c=0;c<cols;c++){
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

    blockCreateBtn.addEventListener('click', function(){
      ensureLayout();
      var seatIds = Array.from(selectedSeatIds);
      if(!seatIds.length){
        alert('Select one or more seats first.');
        return;
      }
      var blocks = layout.elements.filter(function(e){ return e && e.type === 'block'; });
      var name = (blockNameInput.value || '').trim() || ('Block '+(blocks.length+1));

      var capacity = null;
      var capStr = (blockCapacityInput && blockCapacityInput.value || '').trim();
      if(capStr){
        var n = Number(capStr);
        if(Number.isFinite(n) && n >= 0){
          capacity = n;
        }
      }

      var zone = (blockZoneInput && blockZoneInput.value || '').trim() || null;
      var ticketTypeId = (blockTicketTypeSelect && blockTicketTypeSelect.value) || null;

      var id = 'block_'+Date.now()+'_'+Math.floor(Math.random()*1000);
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

    seatPriceAssignBtn.addEventListener('click', function(){
      var ttId = seatPriceTicketTypeSelect && seatPriceTicketTypeSelect.value;
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
        var meta = ensureSeatMeta(id);
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
        var meta = ensureSeatMeta(id);
        if(meta.ticketTypeId){
          meta.ticketTypeId = null;
        }
      });
      renderSeats();
      updateSeatPricingSummary();
    });

    var GRID_SIZE = 4;
    var SNAP_DIST = 8;
    var dragState = null;

    seatCanvas.addEventListener('mousedown', function(e){
      var target = e.target;
      var blockEl = target && target.closest ? target.closest('.seat-block-overlay') : null;
      if(blockEl){
        var blockId = blockEl.getAttribute('data-block-id');
        if(blockId){
          ensureLayout();
          var block = layout.elements.find(function(el){ return el && el.id === blockId && el.type === 'block'; });
          if(block && Array.isArray(block.seatIds) && block.seatIds.length){
            clearSelection();
            block.seatIds.forEach(function(seatId){ addSeatToSelection(seatId); });
            selectedBlockId = blockId;
            renderSeats();

            if(e.button === 0){
              ensureLayout();
              var seatIds = Array.from(selectedSeatIds);
              var startPositions = {};
              seatIds.forEach(function(id){
                var meta = ensureSeatMeta(id);
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

      var seatEl = target && target.closest ? target.closest('.seat') : null;

      if(!seatEl){
        clearSelection();
        renderSeats();
        return;
      }

      var seatId = seatEl.getAttribute('data-seat-id');
      if(!seatId || seatEl.classList.contains('seat-sold')) return;

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

      if(e.button === 0 && selectedSeatIds.size){
        ensureLayout();
        var seatIds2 = Array.from(selectedSeatIds);
        var startPositions2 = {};
        seatIds2.forEach(function(id){
          var meta = ensureSeatMeta(id);
          startPositions2[id] = {
            x: meta.x,
            y: meta.y
          };
        });

        dragState = {
          seatIds: seatIds2,
          anchorSeatId: seatId,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startPositions: startPositions2
        };
      }

      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e){
      if(!dragState) return;

      var rect = seatCanvas.getBoundingClientRect();
      var dxScreen = e.clientX - dragState.startMouseX;
      var dyScreen = e.clientY - dragState.startMouseY;

      var dx = dxScreen / zoom;
      var dy = dyScreen / zoom;

      var widthLogical = rect.width / zoom;
      var heightLogical = rect.height / zoom;

      ensureLayout();

      var anchorId = dragState.anchorSeatId;
      var anchorStart = dragState.startPositions[anchorId];
      if(!anchorStart) return;

      var anchorX = anchorStart.x + dx;
      var anchorY = anchorStart.y + dy;

      anchorX = Math.round(anchorX / GRID_SIZE) * GRID_SIZE;
      anchorY = Math.round(anchorY / GRID_SIZE) * GRID_SIZE;

      var PADDING = 10;
      anchorX = Math.max(PADDING, Math.min(widthLogical  - PADDING, anchorX));
      anchorY = Math.max(PADDING, Math.min(heightLogical - PADDING, anchorY));

      var snapX = null;
      var snapY = null;
      var canvasCenterX = widthLogical / 2;
      var canvasCenterY = heightLogical / 2;

      seats.forEach(function(s){
        var meta = layout.seats[s.id];
        if(!meta) return;
        if(dragState.seatIds.indexOf(s.id) !== -1) return;
        var pos = meta;
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

      var adjustDx = anchorX - (anchorStart.x + dx);
      var adjustDy = anchorY - (anchorStart.y + dy);

      dragState.seatIds.forEach(function(id){
        var base = dragState.startPositions[id];
        var x = base.x + dx + adjustDx;
        var y = base.y + dy + adjustDy;

        var PADDING = 10;
        x = Math.max(PADDING, Math.min(widthLogical  - PADDING, x));
        y = Math.max(PADDING, Math.min(heightLogical - PADDING, y));

        var meta = ensureSeatMeta(id);
        meta.x = x;
        meta.y = y;

        var el = seatCanvas.querySelector('[data-seat-id="'+id+'"]');
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

    saveLayoutBtn.addEventListener('click', async function(){
      if(!currentSeatMapId){
        alert('No seat map selected.');
        return;
      }
      ensureLayout();

      if(ticketTypes && ticketTypes.length > 1){
        var unassigned = 0;
        seats.forEach(function(s){
          var meta = layout.seats[s.id];
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

    await loadTicketTypesForShow();
    reloadSeatMaps();
  }

  // ---------- Simple stubs for other views ----------
  function orders(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Orders</div><div class="muted">Orders view coming soon.</div></div>';
  }

  function venues(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Venues</div><div class="muted">Venue management UI coming soon (data API already exists).</div></div>';
  }

  function analytics(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Analytics</div><div class="muted">Analytics dashboard coming soon.</div></div>';
  }

  function audiences(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Audiences</div><div class="muted">Audience tools coming soon.</div></div>';
  }

  function emailPage(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Email Campaigns</div><div class="muted">Email campaign tools will plug into your existing Mailchimp/automation stack.</div></div>';
  }

  function account(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Account</div><div class="muted">Account settings coming soon.</div></div>';
  }

  console.log('[Admin UI] initial route()');
  route();
})();
</script>
</body>
</html>`);
  }
);

export default router;
