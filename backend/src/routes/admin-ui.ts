// backend/src/routes/admin-ui.ts – CHUNK 1/3
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/** Single-page admin console at /admin/ui* */
router.get(
  [
    "/ui",
    "/ui/",
    "/ui/home",
    "/ui/*",
    "/ui/events/:eventId",
    "/ui/events/:eventId/*",
  ],
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

  .tab-strip{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:4px}
  .tab-btn{flex:1;appearance:none;border:none;background:transparent;padding:6px 8px;font-size:13px;border-radius:8px 8px 0 0;cursor:pointer;color:var(--muted)}
  .tab-btn.active{background:#e5e7eb;color:var(--ink);font-weight:500}
  .tab-pane{display:none;margin-top:4px}
  .tab-pane.active{display:block}

  /* Seat layout canvas + tools */
  .seat-layout-wrap{
    background:#f9fafb;
    background-image:
      linear-gradient(#e5e7eb 1px, transparent 1px),
      linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
    background-size:24px 24px;
    border-radius:12px;
    padding:16px;
    color:#0f172a;
    min-height:360px;
    display:flex;
    flex-direction:column;
    gap:12px;
    position:relative;
    overflow:auto;
  }
  #seatCanvas{
    position:relative;
    min-width:900px;
    min-height:220px;
    transform-origin:0 0;
  }
  .guide-line{position:absolute;background:rgba(148,163,184,.7);pointer-events:none;z-index:5}
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
  .seat-stage{
    font-size:12px;
    text-align:center;
    letter-spacing:.12em;
    text-transform:uppercase;
    color:#0f172a;
  }
  .seat-stage-bar{margin-top:4px;height:6px;border-radius:999px;background:rgba(148,163,184,.35)}
  .seat-dot{width:12px;height:12px;border-radius:3px;background:var(--seat-bg);border:1px solid var(--seat-border)}
  .seat-dot.block{background:#0f172a;border-color:#0b1120}
  .seat-dot.held{background:#f59e0b;border-color:#92400e}
  .seat-dot.sold{background:#9ca3af;border-color:#4b5563}
  .seat-legend{
    font-size:12px;
    color:#0f172a;
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    margin-top:4px;
  }
  .seat-legend span{display:inline-flex;align-items:center;gap:4px}
  .seat-grid{display:inline-grid;gap:4px;margin-top:4px}
  .seat{width:18px;height:18px;border-radius:4px;background:var(--seat-bg);border:1px solid var(--seat-border);display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:transform .05s ease-out,box-shadow .05s ease-out}
  .seat:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(0,0,0,.45)}
  .seat-blocked{background:#0f172a;border-color:#0b1120}
  .seat-held{background:#f59e0b;border-color:#92400e}
  .seat-sold{background:#9ca3af;border-color:#4b5563;cursor:not-allowed}
  .seat-selected{outline:2px solid #f97316;outline-offset:1px}

  /* Seat blocks / grids overlay */
  .seat-block-overlay{
    position:absolute;
    border:1px dashed rgba(148,163,184,.9);
    background:rgba(148,163,184,.12);
    border-radius:8px;
    padding:4px 6px;
    box-sizing:border-box;
    cursor:move;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    font-size:11px;
    color:#0f172a;
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

  /* Generic layout elements (stage blocks, zones, tables, icons, labels) */
  .seat-el{
    position:absolute;
    cursor:move;
    font-size:11px;
    display:flex;
    align-items:center;
    justify-content:center;
    border-radius:6px;
    border:1px solid rgba(148,163,184,.85);
    background:rgba(255,255,255,.9);
    color:#0f172a;
    padding:2px 4px;
    box-sizing:border-box;
    user-select:none;
  }
  .seat-el.stage{
    background:#e5f3ff;
    color:#0f172a;
    border-color:#60a5fa;
    font-weight:600;
    letter-spacing:.08em;
    text-transform:uppercase;
  }
  .seat-el.zone-rect{
    background:rgba(56,189,248,.08);
    border-style:dashed;
  }
  .seat-el.zone-circle{
    background:rgba(74,222,128,.08);
    border-radius:999px;
    border-style:dashed;
  }
  .seat-el.aisle{
    height:2px;
    padding:0;
    border-radius:999px;
    background:#e5e7eb;
    border:none;
  }
  .seat-el.label{
    background:transparent;
    border:none;
    color:#0f172a;
    font-weight:500;
  }
  .seat-el.small-icon{
    width:18px;
    height:18px;
    border-radius:999px;
    font-size:10px;
  }
  .seat-el.table{
    background:rgba(148,163,184,.25);
  }
  .seat-el.sofa{
    background:#e5e7eb;
    border-radius:999px;
  }
  .seat-el.selected{
    outline:2px solid #f97316;
    outline-offset:2px;
  }

  /* NEW: ticket mode choice (two big squares) */
  .mode-choice-wrap{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:16px;
    margin-top:16px;
  }
  .mode-card{
    border-radius:12px;
    border:1px solid var(--border);
    padding:18px 16px;
    text-align:left;
    cursor:pointer;
    background:#f9fafb;
    transition:background .12s ease,box-shadow .12s ease,transform .12s ease;
  }
  .mode-card:hover{
    background:#eef2ff;
    box-shadow:0 10px 25px rgba(15,23,42,.08);
    transform:translateY(-1px);
  }
  .mode-card-title{font-weight:600;margin-bottom:4px;}
  .mode-card-body{font-size:13px;color:var(--muted);margin-bottom:8px;}
  .mode-card-tag{
    display:inline-block;
    margin-top:4px;
    padding:2px 8px;
    border-radius:999px;
    font-size:11px;
    background:#e5e7eb;
    color:#111827;
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
  const $ = function(sel,root){ return (root||document).querySelector(sel); };
  const $$ = function(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
  const main = $('#main');

  // Sidebar nested menu
  const showsToggle = $('#showsToggle');
  const showsSub = $('#showsSub');
  if (showsToggle && showsSub) {
    showsToggle.addEventListener('click', function(e){
      e.preventDefault();
      showsSub.style.display = showsSub.style.display === 'none' ? 'block' : 'none';
    });
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

  function route(){
    const path = location.pathname.replace(/\\/$/, '');
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

    // NEW: ticket mode + unallocated / allocated
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets/unallocated')) {
      return ticketsPage(path.split('/')[4]);
    }
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')) {
      return ticketModePage(path.split('/')[4]);
    }

    // seat-map designer (allocated seating path)
    if (path.startsWith('/admin/ui/events/') && path.endsWith('/seat-map')) {
      const parts = path.split('/');
      const eventId = parts[4]; // ['', 'admin', 'ui', 'events', ':eventId', 'seat-map']
      return seatingPage(eventId);
    }

    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')) return editShow(path.split('/')[4]);
    if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')) return seatingPage(path.split('/')[4]); // legacy alias

    return home();
  }

  function home(){
    main.innerHTML = '<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>';
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

    function close(){
      pop.classList.remove('open');
    }

    function render(list, q){
      pop.innerHTML = '';

      if (list && list.length){
        list.forEach(function(v){
          const el = document.createElement('div');
          el.className = 'opt';
          el.textContent = (v.name || '') + (v.city ? (' — ' + v.city) : '');
          el.addEventListener('click', function(){
            input.value = v.name || '';
            input.dataset.venueId = v.id;
            close();
          });
          pop.appendChild(el);
        });
      }

      // "Create venue" option if there’s no exact name match
      if (q && !(list || []).some(function(v){
        return (v.name || '').toLowerCase() === q.toLowerCase();
      })){
        const add = document.createElement('div');
        add.className = 'opt';
        // fixed string quoting here:
        add.innerHTML = '➕ Create venue “' + q + '”';
        add.addEventListener('click', async function(){
          try{
            const created = await j('/admin/venues', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ name: q })
            });
            if (created && created.ok && created.venue){
              input.value = created.venue.name || '';
              input.dataset.venueId = created.venue.id;
            } else {
              alert('Failed to create venue');
            }
          } catch(err){
            alert('Create failed: ' + (err && err.message ? err.message : String(err)));
          }
          close();
        });
        pop.appendChild(add);
      }

      if (pop.children.length){
        pop.classList.add('open');
      } else {
        pop.classList.remove('open');
      }
    }

    let debounceTimer = null;

    input.addEventListener('input', function(){
      const q = input.value.trim();

      if (!q){
        pop.innerHTML = '';
        pop.classList.remove('open');
        delete input.dataset.venueId;
        return;
      }

      if (debounceTimer){ clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(async function(){
        const list = await searchVenues(q);
        render(list, q);
      }, 200);
    });

    // On focus, show current suggestions if any text already typed
    input.addEventListener('focus', async function(){
      const q = input.value.trim();
      if (!q) return;
      const list = await searchVenues(q);
      render(list, q);
    });

    // Click outside to close
    document.addEventListener('click', function(e){
      if (!container.contains(e.target)){
        close();
      }
    });
  }

  // -------- Helpers --------
  function escapeHtml(str){
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }


  function showMessage(title, body){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">'+escapeHtml(title)+'</div>' +
        '<div class="muted">'+escapeHtml(body)+'</div>' +
      '</div>';
  }

  function showError(msg){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Something went wrong</div>' +
        '<div class="error">'+escapeHtml(msg)+'</div>' +
      '</div>';
  }

  // -------- Shows: list + create + edit --------

  async function listShows(){
    main.innerHTML = '<div class="card"><div class="title">All events</div><div class="muted">Loading…</div></div>';
    try{
      const data = await j('/admin/shows');
      const items = data.items || [];
      if(!items.length){
        main.innerHTML =
          '<div class="card">' +
            '<div class="header">' +
              '<div class="title">All events</div>' +
              '<button class="btn p" data-view="/admin/ui/shows/create">Create show</button>' +
            '</div>' +
            '<div class="muted">No shows yet. Click “Create show” to add your first one.</div>' +
          '</div>';
        return;
      }

      let rows = items.map(function(s){
        const id = s.id;
        const date = s.startUtc || s.date || '';
        const venueName = (s.venue && s.venue.name) || s.venueName || '';
        const city = (s.venue && s.venue.city) || s.city || '';
        const labelVenue = venueName + (city ? ' — '+city : '');
        return (
          '<tr>' +
            '<td>'+escapeHtml(s.name || s.title || '')+'</td>' +
            '<td>'+escapeHtml(date || '')+'</td>' +
            '<td>'+escapeHtml(labelVenue)+'</td>' +
            '<td style="white-space:nowrap;display:flex;gap:6px;align-items:center;">' +
              '<a class="btn" data-view="/admin/ui/shows/'+encodeURIComponent(id)+'/edit" href="/admin/ui/shows/'+encodeURIComponent(id)+'/edit">Edit</a>' +
              '<a class="btn p" data-view="/admin/ui/shows/'+encodeURIComponent(id)+'/tickets" href="/admin/ui/shows/'+encodeURIComponent(id)+'/tickets">Tickets</a>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      main.innerHTML =
        '<div class="card">' +
          '<div class="header">' +
            '<div class="title">All events</div>' +
            '<button class="btn p" data-view="/admin/ui/shows/create">Create show</button>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<table>' +
              '<thead>' +
                '<tr>' +
                  '<th>Show</th>' +
                  '<th>Date & time</th>' +
                  '<th>Venue</th>' +
                  '<th>Actions</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>'+rows+'</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }catch(err){
      showError(err && err.message ? err.message : String(err));
    }
  }

  function buildShowForm(show){
    const name = show && (show.name || show.title) || '';
    const startUtc = show && (show.startUtc || show.date || '') || '';
    const venueName = show && show.venue && show.venue.name || show && show.venueName || '';
    const venueId = show && (show.venueId || (show.venue && show.venue.id));
    const desc = show && (show.description || '') || '';

    return (
      '<div class="grid grid-2">' +
        '<div>' +
          '<label>Show title</label><br />' +
          '<input type="text" id="showName" value="'+escapeHtml(name)+'" placeholder="e.g. Chuckl. Comedy Club" />' +
        '</div>' +
        '<div>' +
          '<label>Date & time (local)</label><br />' +
          '<input type="datetime-local" id="showStart" value="'+escapeHtml(startUtc)+'" />' +
        '</div>' +
        '<div>' +
          '<label>Venue</label><br />' +
          '<input type="text" id="showVenue" placeholder="Start typing venue name…" value="'+escapeHtml(venueName)+'" '+(venueId ? ('data-venue-id="'+escapeHtml(venueId)+'"') : '')+' />' +
          '<div class="tip">This links the show to a venue. You can create a new one inline.</div>' +
        '</div>' +
        '<div>' +
          '<label>Internal notes / description</label><br />' +
          '<textarea id="showDesc" rows="3" placeholder="Optional notes for your team">'+escapeHtml(desc)+'</textarea>' +
        '</div>' +
      '</div>'
    );
  }

  function wireShowForm(onSubmit){
    const venueInput = document.getElementById('showVenue');
    if(venueInput){ mountVenuePicker(venueInput); }

    const btn = document.getElementById('showSaveBtn');
    if(btn){
      btn.addEventListener('click', async function(){
        const nameEl = document.getElementById('showName');
        const startEl = document.getElementById('showStart');
        const descEl = document.getElementById('showDesc');

        const payload = {
          name: nameEl ? nameEl.value.trim() : '',
          startUtc: startEl ? startEl.value : '',
          description: descEl ? descEl.value : '',
          venueId: venueInput && venueInput.dataset.venueId ? venueInput.dataset.venueId : null,
          venueName: venueInput ? venueInput.value.trim() : '',
        };

        if(!payload.name){
          alert('Please enter a show title.');
          return;
        }
        if(!payload.startUtc){
          if(!confirm('No date/time set. Continue anyway?')) return;
        }
        try{
          await onSubmit(payload);
        }catch(err){
          alert('Save failed: '+(err && err.message ? err.message : String(err)));
        }
      });
    }
  }

  function createShow(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="header">' +
          '<div class="title">Create show</div>' +
        '</div>' +
        buildShowForm(null) +
        '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">' +
          '<button class="btn" data-view="/admin/ui/shows/current">Cancel</button>' +
          '<button class="btn p" id="showSaveBtn">Save show</button>' +
        '</div>' +
      '</div>';

    wireShowForm(async function(payload){
      const res = await j('/admin/shows',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const id = res && (res.id || (res.show && res.show.id));
      if(id){
        go('/admin/ui/shows/'+encodeURIComponent(id)+'/tickets');
      }else{
        showMessage('Show created','Show saved, but we could not determine its id. Returning to All events.');
        go('/admin/ui/shows/current');
      }
    });
  }

  async function editShow(showId){
    main.innerHTML =
      '<div class="card"><div class="title">Edit show</div><div class="muted">Loading…</div></div>';
    try{
      const res = await j('/admin/shows/'+encodeURIComponent(showId));
      const show = res.show || res;

      main.innerHTML =
        '<div class="card">' +
          '<div class="header">' +
            '<div class="title">Edit show</div>' +
            '<button class="btn" data-view="/admin/ui/shows/current">Back to all events</button>' +
          '</div>' +
          buildShowForm(show) +
          '<div style="margin-top:16px;display:flex;gap:8px;justify-content:space-between;align-items:center;">' +
            '<button class="btn" id="showTicketsBtn">Tickets</button>' +
            '<div style="display:flex;gap:8px;">' +
              '<button class="btn" data-view="/admin/ui/shows/current">Cancel</button>' +
              '<button class="btn p" id="showSaveBtn">Save changes</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      wireShowForm(async function(payload){
        await j('/admin/shows/'+encodeURIComponent(showId),{
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload),
        });
        showMessage('Saved','Show updated successfully.');
        go('/admin/ui/shows/current');
      });

      const tBtn = document.getElementById('showTicketsBtn');
      if(tBtn){
        tBtn.addEventListener('click', function(){
          go('/admin/ui/shows/'+encodeURIComponent(showId)+'/tickets');
        });
      }
    }catch(err){
      showError(err && err.message ? err.message : String(err));
    }
  }

  // -------- Ticket mode choice (Allocated vs Unallocated) --------

  function ticketModePage(showId){
    main.innerHTML =
      '<div class="card">' +
        '<div class="header">' +
          '<div>' +
            '<div class="title">How do you want to sell tickets?</div>' +
            '<div class="muted">Choose between simple unallocated seating or a full seat map.</div>' +
          '</div>' +
          '<button class="btn" data-view="/admin/ui/shows/current">Back to all events</button>' +
        '</div>' +
        '<div class="mode-choice-wrap">' +
          '<div class="mode-card" id="modeUnallocated">' +
            '<div class="mode-card-title">Unallocated seating</div>' +
            '<div class="mode-card-body">Quick to set up. Customers pick a ticket type, then sit anywhere in the venue (first come, first served).</div>' +
            '<div class="mode-card-tag">Best for comedy clubs, standing gigs, GA events</div>' +
          '</div>' +
          '<div class="mode-card" id="modeAllocated">' +
            '<div class="mode-card-title">Allocated seating</div>' +
            '<div class="mode-card-body">Build a seat map and let customers choose specific seats when they book.</div>' +
            '<div class="mode-card-tag">Best for theatres, cabaret layouts, premium seats</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const unalloc = document.getElementById('modeUnallocated');
    const alloc = document.getElementById('modeAllocated');

    if(unalloc){
      unalloc.addEventListener('click', function(){
        go('/admin/ui/shows/'+encodeURIComponent(showId)+'/tickets/unallocated');
      });
    }
    if(alloc){
      alloc.addEventListener('click', function(){
        // For allocated seating we go straight to the seat-map designer
        go('/admin/ui/events/'+encodeURIComponent(showId)+'/seat-map');
      });
    }
  }

  // -------- Unallocated ticket setup page --------

  async function ticketsPage(showId){
    main.innerHTML =
      '<div class="card"><div class="title">Unallocated tickets</div><div class="muted">Loading…</div></div>';

    let existing = null;
    try {
      const res = await j('/admin/shows/'+encodeURIComponent(showId)+'/tickets/unallocated');
      existing = res && (res.ticketConfig || res);
    } catch(_ignored){
      // If endpoint does not exist yet, we’ll just show the empty form.
    }

    const price = existing && existing.price != null ? String(existing.price) : '';
    const capacity = existing && existing.capacity != null ? String(existing.capacity) : '';
    const label = existing && existing.label || 'General Admission';

    main.innerHTML =
      '<div class="card">' +
        '<div class="header">' +
          '<div>' +
            '<div class="title">Unallocated tickets</div>' +
            '<div class="muted">Set your price and capacity. Everyone holds the same type of ticket and can sit anywhere that’s available.</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="btn" data-view="/admin/ui/shows/'+encodeURIComponent(showId)+'/tickets">Back</button>' +
            '<button class="btn" data-view="/admin/ui/shows/current">All events</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-3">' +
          '<div>' +
            '<label>Ticket label</label><br />' +
            '<input type="text" id="gaLabel" value="'+escapeHtml(label)+'" placeholder="e.g. General Admission" />' +
            '<div class="tip">Shown to customers on the booking page and e-tickets.</div>' +
          '</div>' +
          '<div>' +
            '<label>Price (GBP)</label><br />' +
            '<input type="number" step="0.01" min="0" id="gaPrice" value="'+escapeHtml(price)+'" />' +
            '<div class="tip">Base ticket price, excluding any booking fees.</div>' +
          '</div>' +
          '<div>' +
            '<label>Capacity</label><br />' +
            '<input type="number" min="1" id="gaCapacity" value="'+escapeHtml(capacity)+'" />' +
            '<div class="tip">Total number of tickets you want to sell for this event.</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">' +
          '<button class="btn" data-view="/admin/ui/shows/'+encodeURIComponent(showId)+'/edit">Edit show details</button>' +
          '<button class="btn p" id="gaSaveBtn">Save ticket setup</button>' +
        '</div>' +
      '</div>';

    const saveBtn = document.getElementById('gaSaveBtn');
    if(saveBtn){
      saveBtn.addEventListener('click', async function(){
        const labelEl = document.getElementById('gaLabel');
        const priceEl = document.getElementById('gaPrice');
        const capEl = document.getElementById('gaCapacity');

const payload = {          label: labelEl ? labelEl.value.trim() : '',
          price: priceEl && priceEl.value ? parseFloat(priceEl.value) : null,
          capacity: capEl && capEl.value ? parseInt(capEl.value,10) : null,
        };

        if(!payload.label){
          alert('Please enter a ticket label.');
          return;
        }
        if(payload.price == null || isNaN(payload.price)){
          alert('Please enter a valid ticket price.');
          return;
        }
        if(payload.capacity == null || isNaN(payload.capacity) || payload.capacity <= 0){
          alert('Please enter a valid capacity.');
          return;
        }

        try{
          await j('/admin/shows/'+encodeURIComponent(showId)+'/tickets/unallocated',{
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload),
          });
          showMessage('Saved','Unallocated ticket setup saved successfully.');
          go('/admin/ui/shows/current');
        }catch(err){
          alert('Save failed: '+(err && err.message ? err.message : String(err)));
        }
      });
    }
  }

  // -------- Seat-map designer (allocated seating wizard) --------

  async function seatingPage(eventId){
    // Local wizard state – in future this can be loaded from /admin/events/:id/seat-map
    const state = {
      layout: 'theatre',
      rows: 10,
      seatsPerRow: 20,
      tables: 20,
      seatsPerTable: 6,
      gaCapacity: 400,
    };

    main.innerHTML =
      '<div class="card">' +
        '<div class="header">' +
          '<div>' +
            '<div class="title">Seat map layout</div>' +
            '<div class="muted" id="seatStepLabel">Step 1 of 2 · Choose your layout</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="btn" data-view="/admin/ui/shows/current">All events</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-2" style="align-items:flex-start;">' +
          '<div>' +
            '<div class="muted" style="font-size:13px;margin-bottom:6px;">Quick start layouts</div>' +
            '<div class="mode-choice-wrap" style="margin-top:8px;">' +
              '<div class="mode-card" data-layout-choice="theatre">' +
                '<div class="mode-card-title">Theatre rows</div>' +
                '<div class="mode-card-body">Straight rows facing the stage. Perfect for classic theatre style.</div>' +
                '<div class="mode-card-tag">Most common</div>' +
              '</div>' +
              '<div class="mode-card" data-layout-choice="cabaret">' +
                '<div class="mode-card-title">Cabaret tables</div>' +
                '<div class="mode-card-body">Round tables with seats around them. Good for clubs and cabaret rooms.</div>' +
                '<div class="mode-card-tag">Tables and chairs</div>' +
              '</div>' +
              '<div class="mode-card" data-layout-choice="standing">' +
                '<div class="mode-card-title">Standing / GA zone</div>' +
                '<div class="mode-card-body">No fixed seats. Set a capacity and let people stand or pick any spot.</div>' +
                '<div class="mode-card-tag">Standing room</div>' +
              '</div>' +
              '<div class="mode-card" data-layout-choice="custom">' +
                '<div class="mode-card-title">Custom mix</div>' +
                '<div class="mode-card-body">Rows and tables together. Use this when your venue has a more complex layout.</div>' +
                '<div class="mode-card-tag">Advanced</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="muted" style="font-size:13px;margin-bottom:6px;">Layout details</div>' +
            '<div class="grid grid-2" style="margin-bottom:12px;">' +
              '<div data-layout-section="theatre cabaret custom">' +
                '<label>Number of rows</label><br />' +
                '<input type="number" min="1" id="seatRows" value="10" />' +
                '<div class="tip">Applies to theatre rows. For cabaret, this is the number of rows of tables.</div>' +
              '</div>' +
              '<div data-layout-section="theatre custom">' +
                '<label>Seats per row</label><br />' +
                '<input type="number" min="1" id="seatPerRow" value="20" />' +
                '<div class="tip">Total seats in each row.</div>' +
              '</div>' +
              '<div data-layout-section="cabaret custom">' +
                '<label>Number of tables</label><br />' +
                '<input type="number" min="1" id="seatTables" value="20" />' +
                '<div class="tip">Total tables in the room.</div>' +
              '</div>' +
              '<div data-layout-section="cabaret custom">' +
                '<label>Seats per table</label><br />' +
                '<input type="number" min="1" id="seatPerTable" value="6" />' +
                '<div class="tip">Useful for round tables and booths.</div>' +
              '</div>' +
              '<div data-layout-section="standing">' +
                '<label>Standing capacity</label><br />' +
                '<input type="number" min="1" id="seatGaCapacity" value="400" />' +
                '<div class="tip">Maximum number of people in the space.</div>' +
              '</div>' +
            '</div>' +
            '<div class="seat-layout-wrap">' +
              '<div class="seat-stage">' +
                '<div>STAGE</div>' +
                '<div class="seat-stage-bar"></div>' +
              '</div>' +
              '<div id="seatLayoutSummary" style="margin-top:10px;font-size:13px;color:#0f172a;">' +
                'Layout summary will appear here.' +
              '</div>' +
              '<div id="seatLayoutPreview" style="margin-top:10px;"></div>' +
            '</div>' +
            '<div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">' +
              '<button class="btn" id="seatWizardBackBtn">Back</button>' +
              '<button class="btn p" id="seatWizardSaveBtn">Save layout</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const layoutCards = $$('.mode-card', main);
    const rowsInput = $('#seatRows', main);
    const perRowInput = $('#seatPerRow', main);
    const tablesInput = $('#seatTables', main);
    const perTableInput = $('#seatPerTable', main);
    const gaCapInput = $('#seatGaCapacity', main);
    const sections = $$('[data-layout-section]', main);
    const summaryEl = $('#seatLayoutSummary', main);
    const previewEl = $('#seatLayoutPreview', main);
    const stepLabel = $('#seatStepLabel', main);
    const backBtn = $('#seatWizardBackBtn', main);
    const saveBtn = $('#seatWizardSaveBtn', main);

    function applySectionVisibility(){
      sections.forEach(function(sec){
        const modes = (sec.getAttribute('data-layout-section') || '').split(/\s+/);
        if (modes.indexOf(state.layout) !== -1){
          sec.style.display = '';
        } else {
          sec.style.display = 'none';
        }
      });
    }

    function renderPreview(){
      let total = 0;
      let desc = '';

      if (state.layout === 'theatre'){
        total = (state.rows || 0) * (state.seatsPerRow || 0);
        desc = 'Theatre rows · ' + state.rows + ' rows × ' + state.seatsPerRow + ' seats per row.';
      } else if (state.layout === 'cabaret'){
        total = (state.tables || 0) * (state.seatsPerTable || 0);
        desc = 'Cabaret tables · ' + state.tables + ' tables × ' + state.seatsPerTable + ' seats per table.';
      } else if (state.layout === 'standing'){
        total = state.gaCapacity || 0;
        desc = 'Standing / GA zone · capacity ' + total + '.';
      } else {
        const theatrePart = (state.rows || 0) * (state.seatsPerRow || 0);
        const tablePart = (state.tables || 0) * (state.seatsPerTable || 0);
        total = theatrePart + tablePart;
        desc = 'Custom mix · ' + theatrePart + ' row seats plus ' + tablePart + ' table seats.';
      }

      summaryEl.textContent = 'Total seats: ' + total + '. ' + desc;

      // Simple visual preview using the existing seat styles
      previewEl.innerHTML = '';
      if (state.layout === 'standing'){
        previewEl.innerHTML =
          '<div class="muted" style="font-size:13px;">Standing zone preview. People are free to move within the area.</div>';
        return;
      }

      const maxSeatsToDraw = 220;
      let seatsToDraw = total;
      let trimmed = false;
      if (seatsToDraw > maxSeatsToDraw){
        seatsToDraw = maxSeatsToDraw;
        trimmed = true;
      }

      const grid = document.createElement('div');
      grid.className = 'seat-grid';

      // Pick a rough column count so the grid looks reasonable
      let cols = 10;
      if (state.layout === 'cabaret'){ cols = 8; }
      if (state.layout === 'custom'){ cols = 12; }

      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

      for (let i = 0; i < seatsToDraw; i++){
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.innerHTML = '&nbsp;';
        grid.appendChild(seat);
      }

      previewEl.appendChild(grid);

      if (trimmed){
        const note = document.createElement('div');
        note.className = 'tip';
        note.textContent = 'Preview trimmed to ' + maxSeatsToDraw + ' seats for performance. Full capacity is ' + total + ' seats.';
        previewEl.appendChild(note);
      }
    }

    function setLayout(layout){
      state.layout = layout;

      layoutCards.forEach(function(card){
        const isActive = card.getAttribute('data-layout-choice') === layout;
        card.style.outline = isActive ? '2px solid #111827' : '';
        card.style.backgroundColor = isActive ? '#e5e7eb' : '';
      });

      stepLabel.textContent = 'Step 2 of 2 · Configure your ' + layout + ' layout';
      applySectionVisibility();
      renderPreview();
    }

    layoutCards.forEach(function(card){
      card.addEventListener('click', function(){
        const layout = card.getAttribute('data-layout-choice');
        if (layout){
          setLayout(layout);
        }
      });
    });

    function wireNumberInput(el, key){
      if (!el) return;
      el.addEventListener('input', function(){
        const v = parseInt(el.value, 10);
        state[key] = isNaN(v) || v < 0 ? 0 : v;
        renderPreview();
      });
    }

    wireNumberInput(rowsInput, 'rows');
    wireNumberInput(perRowInput, 'seatsPerRow');
    wireNumberInput(tablesInput, 'tables');
    wireNumberInput(perTableInput, 'seatsPerTable');

    if (gaCapInput){
      gaCapInput.addEventListener('input', function(){
        const v = parseInt(gaCapInput.value, 10);
        state.gaCapacity = isNaN(v) || v < 0 ? 0 : v;
        renderPreview();
      });
    }

    if (backBtn){
      backBtn.addEventListener('click', function(){
        // Go back to the ticket mode choice screen for this show
        go('/admin/ui/shows/' + encodeURIComponent(eventId) + '/tickets');
      });
    }

    if (saveBtn){
      saveBtn.addEventListener('click', async function(){
        // For now we just log the config and show a message.
        // Later this will POST to something like /admin/events/:id/seat-map.
        console.log('Seat layout config for event', eventId, state);
        alert('Layout saved locally. We will wire this to a real seat-map endpoint so it can drive allocated seating at checkout.');
      });
    }

    // Initial state
    setLayout('theatre');
  }


  // -------- Other simple pages (placeholders) --------

  function orders(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Orders</div>' +
        '<div class="muted">Order management UI coming soon.</div>' +
      '</div>';
  }

  function venues(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Venues</div>' +
        '<div class="muted">Venue management UI coming soon. For now, you can create venues inline when creating shows.</div>' +
      '</div>';
  }

  function analytics(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Analytics</div>' +
        '<div class="muted">Sales and performance analytics will appear here.</div>' +
      '</div>';
  }

  function audiences(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Audiences</div>' +
        '<div class="muted">Audience & mailing-list tools will live here.</div>' +
      '</div>';
  }

  function emailPage(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Email campaigns</div>' +
        '<div class="muted">Set up automated campaigns once this module is wired in.</div>' +
      '</div>';
  }

  function account(){
    main.innerHTML =
      '<div class="card">' +
        '<div class="title">Account</div>' +
        '<div class="muted">Account settings for organisers will appear here.</div>' +
      '</div>';
  }

  // Kick things off on initial load
  route();
 // end IIFE
})();
</script>
</body>
</html>
`);
  }
);

export default router;
