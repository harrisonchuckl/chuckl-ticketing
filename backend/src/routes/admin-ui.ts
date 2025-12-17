// backend/src/routes/admin-ui.ts
import { Router, json } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

// Public login page (must be defined BEFORE the /ui/* catch-all)
router.get("/ui/login", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Organiser Login</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#f7f8fb;color:#111827}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:420px;max-width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px}
    .title{font-weight:700;font-size:18px;margin-bottom:6px}
    .muted{color:#6b7280;font-size:13px;margin-bottom:12px}
    label{display:block;font-size:12px;font-weight:700;color:#374151;margin:10px 0 6px}
    input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;font-weight:700;cursor:pointer;width:100%;margin-top:12px}
    .err{color:#b91c1c;font-size:13px;margin-top:10px;min-height:18px}
    .link{display:block;text-align:center;margin-top:10px;color:#0284c7;text-decoration:none;font-size:13px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="title">Organiser Console</div>
    <div class="muted">Log in to manage your events.</div>

    <label>Email</label>
    <input id="email" type="email" autocomplete="email" />

    <label>Password</label>
    <input id="pw" type="password" autocomplete="current-password" />

    <button class="btn" id="go">Log in</button>
    <div class="err" id="err"></div>
  </div>
</div>

<script>
(async function(){
  const err = document.getElementById('err');
  const btn = document.getElementById('go');
  function setErr(m){ err.textContent = m || ''; }

  btn.addEventListener('click', async function(){
    setErr('');
    try{
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('pw').value;
      if(!email || !password) return setErr('Please enter email + password.');

      const r = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password })
      });

      const t = await r.text();
      if(!r.ok) throw new Error(t || ('HTTP ' + r.status));

      // Success → go home
      location.href = '/admin/ui/home';
    }catch(e){
      setErr(e.message || String(e));
    }
  });

  // If already logged in, skip login
  try{
    const r = await fetch('/auth/me', { credentials:'include' });
    if(r.ok) location.href = '/admin/ui/home';
  }catch{}
})();
</script>
</body>
</html>`);
});

// UI logout helper
router.get("/ui/logout", (_req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.redirect("/admin/ui/login");
});


/**
 * Admin Single Page App (Organiser Console)
 * Served at /admin/ui/*
 */
router.get(
  ["/ui", "/ui/", "/ui/home", "/ui/*"],
  (req, res, next) => {
    // If not logged in, force login page
    if (!req.user) return res.redirect("/admin/ui/login");
    next();
  },
  requireAdminOrOrganiser,
  (_req, res) => {

    res.set("Cache-Control", "no-store");
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Organiser Console</title>
  <style>
  :root{
  --bg:#f7f8fb;
  --panel:#ffffff;
  --border:#e5e7eb;
  --text:#111827;
  --muted:#6b7280;
  --ink:#111827;

  /* TIXall AI highlight */
  --ai:#009fe3;
}

    *{box-sizing:border-box;}
    html,body{
      margin:0;
      padding:0;
      height:100%;
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      color:var(--text);
      background:var(--bg);
    }
    .wrap{
      display:flex;
      min-height:100vh;
    }
    .sidebar{
      width:220px;
      background:#ffffff;
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
    .sb-link.active,
    .sb-link:hover{
      background:#f1f5f9;
    }
    .sb-sub{margin-left:10px;}
    .ai-badge{
  display:inline-block;
  margin-left:8px;
  font-size:11px;
  font-weight:700;
  padding:2px 7px;
  border-radius:999px;
  border:1px solid var(--border);
  background:#eef2ff;
  color:#3730a3;
  line-height:1.2;
}

    .content{
      flex:1;
      padding:20px;
    }
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
    .title{font-weight:600;}
    .muted{color:var(--muted);}
    .btn{
      appearance:none;
      border:1px solid var(--border);
      background:#ffffff;
      border-radius:8px;
      padding:8px 12px;
      cursor:pointer;
      font:inherit;
    }
    .btn:hover{background:#f9fafb;}
    .btn.p{
      background:#111827;
      color:#ffffff;
      border-color:#111827;
    }
    .grid{display:grid;gap:8px;}
    .grid-2{grid-template-columns:repeat(2,1fr);}
    .grid-3{grid-template-columns:repeat(3,1fr);}
        input,select,textarea{
      border:1px solid var(--border);
      border-radius:8px;
      padding:8px 10px;
      background:#ffffff;
      outline:none;
      font:inherit;
    }
    /* AI-generated field highlight (removed once user edits) */
.ai-gen{
  border:2px solid var(--ai) !important;
  box-shadow:0 0 0 3px rgba(0,159,227,.12);
}

/* AI highlight for contenteditable editor */
.ai-gen-editor{
  border:2px solid var(--ai) !important;
  box-shadow:0 0 0 3px rgba(0,159,227,.12);
}

/* AI highlight for drop areas */
.ai-gen-drop{
  border-color: var(--ai) !important;
}


    /* Fixed-height controls (use on selects that must line up perfectly) */
  .ctl{
  width:100%;
  height:40px;
  min-height:40px;
  padding:8px 10px;
  display:block;              /* KEY: stops baseline weirdness */
}
.field{
  display:flex;
  flex-direction:column;
  gap:4px;                    /* consistent label → control spacing */
}


    table{
      width:100%;
      border-collapse:collapse;
      font-size:14px;
    }
    th,td{
      text-align:left;
      padding:10px;
      border-bottom:1px solid var(--border);
    }
    th{
      font-weight:600;
      color:#334155;
      background:#f8fafc;
    }
    .error{color:#b91c1c;}
    .row{
      display:flex;
      gap:8px;
      align-items:center;
    }
    .drop{
      border:2px dashed #cbd5e1;
      border-radius:12px;
      padding:16px;
      text-align:center;
      color:#64748b;
      cursor:pointer;
    }
    .drop.drag{
      background:#f8fafc;
      border-color:#94a3b8;
    }
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
    .bar{
      height:8px;
      background:#111827;
      width:0%;
      transition:width .2s ease-out;
    }
    .kbd{
      font:12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      background:#f3f4f6;
      border:1px solid #e5e7eb;
      border-radius:6px;
      padding:2px 6px;
    }
    .kebab{position:relative;}
    .menu{
      position:absolute;
      right:0;
      top:28px;
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.08);
      display:none;
      min-width:160px;
      z-index:20;
    }
    .menu.open{display:block;}
    .menu a{
      display:block;
      padding:8px 10px;
      text-decoration:none;
      color:#111827;
    }
    .menu a:hover{background:#f8fafc;}
    .tip{font-size:12px;color:#64748b;margin-top:4px;}
    .pill{
      display:inline-block;
      padding:2px 8px;
      border-radius:999px;
      font-size:12px;
      border:1px solid var(--border);
      background:#f9fafb;
    }
    .pop{
      position:absolute;
      z-index:30;
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.08);
      min-width:260px;
      display:none;
    }
    .pop.open{display:block;}
    .opt{
      padding:8px 10px;
      cursor:pointer;
    }
    .opt:hover{background:#f8fafc;}
  </style>
</head>
<body>
  <div class="wrap">
    <aside class="sidebar">
      <div class="sb-group">Dashboard</div>
      <a class="sb-link" href="/admin/ui/home" data-view="/admin/ui/home">Home</a>

      <div class="sb-group">Manage</div>
      <div>
        <div class="sb-sub" id="showsSub">
        <a class="sb-link sub" href="/admin/ui/shows/create" data-view="/admin/ui/shows/create">Create Show</a>

        <a class="sb-link sub" href="/admin/ui/shows/create-ai" data-view="/admin/ui/shows/create-ai">
          Create Show <span class="ai-badge" title="AI assisted">AI</span>
        </a>

        <a class="sb-link sub" href="/admin/ui/shows/current" data-view="/admin/ui/shows/current">All Events</a>
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
<a class="sb-link" href="/admin/ui/logout">Log out</a>
    </aside>

    <main class="content" id="main">
      <div class="card"><div class="title">Loading…</div></div>
    </main>
  </div>

<script>
(function(){
  console.log('[Admin UI] booting');
    // If the session has expired, force login (1 hour inactivity)
  (async function ensureAuth(){
    try{
      const r = await fetch('/auth/me', { credentials:'include' });
      if(!r.ok) location.href = '/admin/ui/login';
    }catch(e){
      location.href = '/admin/ui/login';
    }
  })();

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
    // --- AI field highlighting ---
  function markAi(el, kind){
    if (!el) return;
    if (kind === 'editor') el.classList.add('ai-gen-editor');
    else if (kind === 'drop') el.classList.add('ai-gen-drop');
    else el.classList.add('ai-gen');
    el.dataset.aiGen = '1';
  }

  function clearAi(el){
    if (!el) return;
    el.classList.remove('ai-gen','ai-gen-editor','ai-gen-drop');
    el.dataset.aiGen = '';
  }

  // Remove blue border as soon as the user changes the field
  function bindAiClearOnUserEdit(el, evts){
    if (!el) return;
    (evts || ['input','change','blur']).forEach(function(evt){
      el.addEventListener(evt, function(){
        if (el.dataset.aiGen === '1') clearAi(el);
      }, { passive:true });
    });
  }


  var main = $('#main');

  var showsToggle = $('#showsToggle');
  var showsSub = $('#showsSub');
  if (showsToggle && showsSub){
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

  async function j(url, opts){
    const res = await fetch(url, { credentials:'include', ...(opts || {}) });
    let text = '';
    try{ text = await res.text(); } catch(e){}
    if (!res.ok){
      throw new Error(text || ('HTTP ' + res.status));
    }
    if (!text) return {};
    try{
      return JSON.parse(text);
    }catch(e){
      return {};
    }
  }

  function go(path){
    history.pushState(null, '', path);
    route();
  }

  // SPA sidebar links
  document.addEventListener('click', function(e){
    var tgt = e.target;
    if (!tgt || !tgt.closest) return;
    var a = tgt.closest('a.sb-link');
    if (a && a.getAttribute('data-view')){
      e.preventDefault();
      go(a.getAttribute('data-view'));
    }
  });

  window.addEventListener('popstate', route);

  function home(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
      +'<div class="title">Welcome</div>'
      +'<div class="muted">Use the menu to manage shows, venues and orders.</div>'
      +'</div>';
  }

  // --- Venue search / inline create ---
  async function searchVenues(q){
    if (!q) return [];
    try{
      const res = await j('/admin/venues?q=' + encodeURIComponent(q));
      return res.items || [];
    }catch(e){
      return [];
    }
  }

  function mountVenuePicker(input, dateInput, opts){
  if (!input) return;
  opts = opts || {};
  var requireApproval = !!opts.requireApproval;

  var wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  var pop = document.createElement('div');
  pop.className = 'pop';
  wrapper.appendChild(pop);

  // expandable details panel (address + approval)
  var details = document.createElement('div');
  details.style.cssText =
    'display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff;';
  wrapper.appendChild(details);

  // expandable create panel (name + address + save)
  var createPanel = document.createElement('div');
  createPanel.style.cssText =
    'display:none;margin-top:8px;padding:10px;border:1px dashed var(--border);border-radius:8px;background:#fff;';
  wrapper.appendChild(createPanel);

  var selectedVenue = null;
    // Allow programmatic AI prefill (select existing venue or open create form with address)
  input._venuePicker = {
    selectExisting: async function(v){
      if (!v) return;
      input.value = v.name || input.value || '';
      input.dataset.venueId = v.id || '';
      createPanel.style.display = 'none';
      close();
      selectedVenue = await tryFetchVenueDetails(v);
      setApproved(false);
      renderDetails();
    },
    openCreate: function(name, address){
      resetSelection();
      openCreateForm(name || '', address || '');
    }
  };


  function close(){ pop.classList.remove('open'); }

  function fmtDate(){
    if (!dateInput || !dateInput.value) return '';
    // datetime-local -> readable
    return dateInput.value.replace('T', ' ');
  }

  function fmtAddress(v){
    if (!v) return '';
    var parts = [];
    // try common keys (safe + non-breaking)
    if (v.address) parts.push(v.address);
    if (v.address1) parts.push(v.address1);
    if (v.address2) parts.push(v.address2);
    if (v.line1) parts.push(v.line1);
    if (v.line2) parts.push(v.line2);
    if (v.city) parts.push(v.city);
    if (v.town) parts.push(v.town);
    if (v.postcode) parts.push(v.postcode);
    if (v.zip) parts.push(v.zip);
    if (v.country) parts.push(v.country);
    return parts.filter(Boolean).join(', ');
  }

  function setApproved(val){
    if (!requireApproval) return;
    input.dataset.venueApproved = val ? '1' : '';
    renderDetails();
  }

  function canApprove(){
    return !!(selectedVenue && (selectedVenue.id || input.dataset.venueId) && dateInput && dateInput.value);
  }

  function renderDetails(){
    if (!selectedVenue){
      details.style.display = 'none';
      return;
    }

    var addr = fmtAddress(selectedVenue);
    var when = fmtDate();

    var approved = (input.dataset.venueApproved === '1');
    var approveDisabled = !canApprove();

    details.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      +   '<div>'
      +     '<div style="font-weight:600;">Venue selected</div>'
      +     '<div class="muted" style="margin-top:2px;">' + (selectedVenue.name || input.value || '') + '</div>'
      +     (addr ? ('<div class="muted" style="margin-top:2px;">' + addr + '</div>') : '')
      +     (when ? ('<div class="muted" style="margin-top:2px;">Date: ' + when + '</div>') : '')
      +   '</div>'
      +   (requireApproval ? (
            '<button type="button" id="venueApproveBtn" class="btn ' + (approved ? 'p' : '') + '" '
          + (approveDisabled ? 'disabled' : '')
          + ' style="white-space:nowrap;">'
          + (approved ? 'Approved ✓' : 'Approve venue & date')
          + '</button>'
        ) : '')
      + '</div>'
      + (requireApproval && !approved ? '<div class="muted" style="margin-top:8px;">Please approve before saving.</div>' : '');

    details.style.display = 'block';

    if (requireApproval){
      var btn = details.querySelector('#venueApproveBtn');
      if (btn){
        btn.addEventListener('click', function(){
          if (!canApprove()) return;
          setApproved(true);
        });
      }
    }
  }

  function resetSelection(){
    selectedVenue = null;
    input.dataset.venueId = '';
    if (requireApproval) input.dataset.venueApproved = '';
    details.style.display = 'none';
  }

  async function tryFetchVenueDetails(v){
    // If your searchVenues already returns full address, this is a no-op.
    // If you have an endpoint like /admin/venues/:id, we’ll attempt it and fall back safely.
    if (!v || !v.id) return v;
    try{
      var full = await j('/admin/venues/' + v.id);
      // support different shapes
      return (full && (full.venue || full.item || full)) || v;
    }catch(e){
      return v;
    }
  }

  async function createVenue(name, address){
    // attempt with address (preferred)
    try{
      var created = await j('/admin/venues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:name, address:address })
      });
      return created;
    }catch(e){
      // fallback: if backend rejects unknown keys, try name-only (won’t break your flow)
      var created2 = await j('/admin/venues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:name })
      });
      // attach address locally so UI can still show it
      if (created2 && (created2.venue || created2.item)){
        var vv = created2.venue || created2.item;
        vv.address = vv.address || address;
      }
      return created2;
    }
  }

  function openCreateForm(prefillName, prefillAddress){
    close();
    createPanel.innerHTML = ''
      + '<div style="font-weight:600;margin-bottom:8px;">Create new venue</div>'
      + '<div class="grid" style="gap:8px;">'
      +   '<div class="grid" style="gap:6px;">'
      +     '<label style="margin:0;">Venue name</label>'
      +     '<input id="newVenueName" value="' + (prefillName || '').replace(/"/g,'&quot;') + '" />'
      +   '</div>'
      +   '<div class="grid" style="gap:6px;">'
      +     '<label style="margin:0;">Address</label>'
      +     '<textarea id="newVenueAddress" rows="2" style="resize:vertical;">'
      +       (prefillAddress || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      +     '</textarea>'
      +   '</div>'
      +   '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:6px;">'
      +     '<button type="button" id="cancelCreateVenue" class="btn">Cancel</button>'
      +     '<button type="button" id="saveCreateVenue" class="btn p">Save venue</button>'
      +   '</div>'
      +   '<div class="error" id="createVenueErr" style="margin-top:6px;"></div>'
      + '</div>';

    createPanel.style.display = 'block';

    var nameEl = createPanel.querySelector('#newVenueName');
    var addrEl = createPanel.querySelector('#newVenueAddress');
    if (addrEl) addrEl.focus();

    createPanel.querySelector('#cancelCreateVenue').addEventListener('click', function(){
      createPanel.style.display = 'none';
    });

    createPanel.querySelector('#saveCreateVenue').addEventListener('click', async function(){
      var errEl = createPanel.querySelector('#createVenueErr');
      if (errEl) errEl.textContent = '';

      var nm = nameEl ? nameEl.value.trim() : '';
      var ad = addrEl ? addrEl.value.trim() : '';

      if (!nm || !ad){
        if (errEl) errEl.textContent = 'Venue name and address are required.';
        return;
      }

      try{
        var created = await createVenue(nm, ad);
        var v = (created && (created.venue || created.item)) ? (created.venue || created.item) : null;
        if (!v || !v.id){
          throw new Error('Failed to create venue (no id returned).');
        }
        v.name = v.name || nm;
        v.address = v.address || ad;

        selectedVenue = v;
        input.value = v.name;
        input.dataset.venueId = v.id;

        createPanel.style.display = 'none';
        setApproved(false);
        renderDetails();
      }catch(e){
        if (errEl) errEl.textContent = 'Create failed: ' + (e.message || e);
      }
    });
  }

  function render(list, q){
    pop.innerHTML = '';

    // Always show only existing venues from search
    if (list && list.length){
      list.forEach(function(v){
        var el = document.createElement('div');
        el.className = 'opt';

        var label = (v.name || '');
        var addr = fmtAddress(v);
        el.textContent = label + (addr ? (' — ' + addr) : (v.city ? (' — ' + v.city) : ''));

        el.addEventListener('click', async function(){
          // select existing
          input.value = v.name || '';
          input.dataset.venueId = v.id;

          createPanel.style.display = 'none';
          close();

          selectedVenue = await tryFetchVenueDetails(v);
          setApproved(false);
          renderDetails();
        });

        pop.appendChild(el);
      });
    }

    // Create option if no exact match
    if (q && (!list || !list.some(function(v){ return (v.name || '').toLowerCase() === q.toLowerCase(); }))){
      var add = document.createElement('div');
      add.className = 'opt';
      add.innerHTML = '➕ Create venue “' + q + '”';
      add.addEventListener('click', function(){
        resetSelection();
        openCreateForm(q);
      });
      pop.appendChild(add);
    }

    if (pop.children.length){ pop.classList.add('open'); } else { close(); }
  }

  // typing clears selection + approval (forces picking from list or creating)
  input.addEventListener('input', async function(){
    resetSelection();
    createPanel.style.display = 'none';

    var q = input.value.trim();
    if (!q){ close(); return; }

    var list = await searchVenues(q);
    render(list, q);
  });

  input.addEventListener('focus', async function(){
    var q = input.value.trim();
    if (!q) return;
    var list = await searchVenues(q);
    render(list, q);
  });

  // changing the date invalidates approval
  if (dateInput){
    dateInput.addEventListener('change', function(){
      if (requireApproval) input.dataset.venueApproved = '';
      if (selectedVenue) renderDetails();
    });
  }

  document.addEventListener('click', function(e){
    if (!pop.contains(e.target) && e.target !== input) close();
  });
}


  // --- Upload helper ---
  async function uploadPoster(file){
    var form = new FormData();
    form.append('file', file);
    const res = await fetch('/admin/uploads', {
      method:'POST',
      body: form,
      credentials:'include'
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(txt || ('HTTP ' + res.status));
    const data = txt ? JSON.parse(txt) : {};
    if (!data.ok || !data.url) throw new Error('Unexpected upload response');
    return data;
  }

  function editorToolbarHtml(){
    return ''
      +'<div class="row" style="gap:6px;margin-bottom:6px">'
      +  '<button type="button" class="btn" data-cmd="bold">B</button>'
      +  '<button type="button" class="btn" data-cmd="italic"><span style="font-style:italic">I</span></button>'
      +  '<button type="button" class="btn" data-cmd="underline"><span style="text-decoration:underline">U</span></button>'
      +  '<button type="button" class="btn" data-cmd="insertUnorderedList">• List</button>'
      +  '<button type="button" class="btn" data-cmd="insertOrderedList">1. List</button>'
      +'</div>';
  }

  function bindWysiwyg(root){
    if (!root) return;
    root.querySelectorAll('[data-cmd]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var cmd = btn.getAttribute('data-cmd') || '';
        if (cmd) document.execCommand(cmd);
      });
    });
  }

 async function createShowAI(){
  if (!main) return;

  main.innerHTML =
    '<div class="card">'
  +   '<div class="title">Create Show (AI)</div>'
  +   '<div class="muted" style="margin-top:6px; line-height:1.4">'
  +     'Drop your show assets here (event copy, briefs, PDFs/DOCX, and artwork). '
  +     'We’ll extract key details and pre-fill the Create Show form for you to review and approve.'
  +   '</div>'

  +   '<div id="ai_drop" class="drop" style="margin-top:14px; padding:18px; min-height:120px;">'
  +     '<div style="font-weight:600">Drop files here or click to upload</div>'
  +     '<div class="muted" style="margin-top:4px">Supports: PDF, DOC/DOCX, TXT/MD, and images (JPG/PNG/WebP)</div>'
  +   '</div>'
  +   '<input id="ai_files" type="file" multiple '
  +     'accept=".pdf,.doc,.docx,.txt,.md,image/*" style="display:none" />'

  +   '<div id="ai_list" style="margin-top:12px;"></div>'

  +   '<div class="row" style="margin-top:12px; gap:10px; align-items:center; justify-content:flex-end;">'
  +     '<div id="ai_status" class="muted" style="flex:1; font-size:13px;"></div>'
  +     '<button id="ai_analyse" class="btn p">Analyse &amp; Pre-fill</button>'
  +   '</div>'

  +   '<div id="ai_err" class="error" style="margin-top:10px;"></div>'
  +   '<div id="ai_result" style="margin-top:14px;"></div>'

  + '</div>';

  const drop = $('#ai_drop');
  const fileInput = $('#ai_files');
  const list = $('#ai_list');
  const btn = $('#ai_analyse');
  const err = $('#ai_err');
  const status = $('#ai_status');
  const result = $('#ai_result');

  if (!drop || !fileInput || !status || !btn || !err || !list || !result) {
    throw new Error(
      'Create Show AI view is missing expected elements. ' +
      'Check main.innerHTML ids: ai_drop, ai_files, ai_status, ai_analyse, ai_err, ai_list, ai_result.'
    );
  }

   const state = {
    images: [], // { file, name, type, size, url, w, h, ratio, score23 }
    docs: [],   // { file, name, type, size, dataUrl }
  };



  function bytes(n){
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/(1024*1024)).toFixed(1) + ' MB';
  }

  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderList(){
  const imgRows = state.images.map((f, idx) => ({
    kind: 'Image',
    kindKey: 'image',
    idx,
    name: f.name,
    size: f.size,
    extra: f.url ? 'Uploaded' : 'Pending upload'
  }));

  const docRows = state.docs.map((f, idx) => ({
    kind: 'Doc',
    kindKey: 'doc',
    idx,
    name: f.name,
    size: f.size,
    extra: f.dataUrl ? 'Ready' : 'Pending read'
  }));

  const rows = imgRows.concat(docRows);

  if (!rows.length){
    list.innerHTML = '<div class="muted">No files added yet.</div>';
    return;
  }

  list.innerHTML =
    '<div style="border:1px solid var(--border); border-radius:10px; overflow:hidden;">'
  +   '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px 52px; gap:10px; padding:10px 12px; background:#f8fafc; font-weight:600; font-size:12px; align-items:center;">'
  +     '<div>Type</div><div>File</div><div>Size</div><div>Status</div><div></div>'
  +   '</div>'
  +   rows.map(r =>
        '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px 52px; gap:10px; padding:10px 12px; border-top:1px solid var(--border); font-size:13px; align-items:center;">'
      +   '<div>'+esc(r.kind)+'</div>'
      +   '<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+esc(r.name)+'</div>'
      +   '<div>'+esc(bytes(r.size))+'</div>'
      +   '<div class="muted">'+esc(r.extra)+'</div>'
      +   '<div style="text-align:right;">'
      +     '<button'
      +       ' type="button"'
      +       ' class="btn"'
      +       ' title="Remove"'
      +       ' aria-label="Remove '+esc(r.name)+'"'
      +       ' data-remove-kind="'+esc(r.kindKey)+'"'
      +       ' data-remove-idx="'+String(r.idx)+'"'
      +       ' style="padding:6px 10px; line-height:1; font-size:14px;">'
      +       '🗑️'
      +     '</button>'
      +   '</div>'
      + '</div>'
      ).join('')
  + '</div>';

  // Wire delete buttons
  list.querySelectorAll('[data-remove-kind][data-remove-idx]').forEach(function(btn){
    btn.addEventListener('click', function(){
      const kind = btn.getAttribute('data-remove-kind');
      const idxStr = btn.getAttribute('data-remove-idx');
      const idx = Number(idxStr);

      if (!Number.isFinite(idx) || idx < 0) return;

      if (kind === 'image'){
        if (idx >= 0 && idx < state.images.length) state.images.splice(idx, 1);
      } else if (kind === 'doc'){
        if (idx >= 0 && idx < state.docs.length) state.docs.splice(idx, 1);
      }

      // Clear any old messages and redraw
      err.textContent = '';
      status.textContent = '';
      renderList();
    });
  });
}
  function readAsDataURL(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('Failed to read file'));
      fr.readAsDataURL(file);
    });
  }

    function isLikelySquareName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('sq') || n.includes('square') || n.includes('insta');
  }

  function isLikelyBannerName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('banner') || n.includes('header') || n.includes('web');
  }

  function isLikelyPosterName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('poster') || n.includes('artwork') || n.includes('a3') || n.includes('print');
  }

  async function getImageMeta(url){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function(){
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        const ratio = h ? (w / h) : 0;
        // 2:3 portrait target ratio = 0.666...
        const target = 3/2;
        const diff = Math.abs(ratio - target);
        resolve({ w, h, ratio, diff });
      };
      img.onerror = () => resolve({ w:0,h:0,ratio:0,diff:999 });
      img.src = url;
    });
  }

  function scoreForMainPoster(item){
    // Lower is better
    const diff = item && typeof item.diff === 'number' ? item.diff : 999;
    let penalty = 0;

    if (isLikelySquareName(item.name)) penalty += 0.75;
    if (isLikelyBannerName(item.name)) penalty += 0.6;
    if (isLikelyPosterName(item.name)) penalty -= 0.25;

    // Prefer higher resolution when diff is similar
    const px = (item.w || 0) * (item.h || 0);
    const resBonus = px > 0 ? (1 / Math.log10(px + 10)) : 1;

    return diff + penalty + resBonus;
  }

  function pickBestMainPoster(images){
    if (!Array.isArray(images) || !images.length) return null;
    const scored = images
      .filter(x => x && x.url)
      .map(x => ({ ...x, _score: scoreForMainPoster(x) }))
      .sort((a,b) => a._score - b._score);
    return scored[0] || null;
  }


  async function addFiles(fileList){
    err.textContent = '';
    status.textContent = '';

    const files = Array.from(fileList || []);
    if (!files.length) return;

    // Split into images vs docs
    const imgs = files.filter(f => (f.type || '').startsWith('image/'));
    const docs = files.filter(f => !(f.type || '').startsWith('image/'));

    // Upload images immediately (re-uses your existing /admin/uploads endpoint)
    for (const f of imgs){
     const item = { file: f, name: f.name, type: f.type, size: f.size, url: '', w:0, h:0, ratio:0, diff:999 };
      state.images.push(item);
      renderList();

      try{
        status.textContent = 'Uploading images…';
        const out = await uploadPoster(f);
        item.url = out.url;
        renderList();
                // capture real image dimensions for poster selection + send to AI
        const meta = await getImageMeta(item.url);
        item.w = meta.w; item.h = meta.h; item.ratio = meta.ratio; item.diff = meta.diff;
        renderList();

      }catch(e){
        err.textContent = 'Image upload failed for "' + f.name + '": ' + (e.message || e);
      }
    }

    // Read docs as data URLs (sent to server for AI extraction)
    for (const f of docs){
      const item = { file: f, name: f.name, type: f.type, size: f.size, dataUrl: '' };
      state.docs.push(item);
      renderList();

      try{
        status.textContent = 'Reading documents…';
        item.dataUrl = await readAsDataURL(f);
        renderList();
      }catch(e){
        err.textContent = 'Document read failed for "' + f.name + '": ' + (e.message || e);
      }
    }

    status.textContent = '';
  }

  // Dropzone bindings
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = '#64748b'; });
  drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.style.borderColor = '';
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  renderList();

  // Analyse button → call backend AI extractor → store draft → send user to Create Show
  btn.addEventListener('click', async () => {
    err.textContent = '';
    result.innerHTML = '';
    status.textContent = '';

    if (!state.images.length && !state.docs.length){
      err.textContent = 'Please add at least one document or image.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Analysing…';
    status.textContent = 'TixAll is doing its magic…';
    try{
           const best = pickBestMainPoster(state.images);

      const payload = {
        images: state.images
          .filter(x => x.url)
          .map(x => ({
            name: x.name,
            url: x.url,
            width: x.w || null,
            height: x.h || null,
            ratio: x.ratio || null,
            // hinting only (AI still decides)
            likelyPoster: isLikelyPosterName(x.name),
            likelySquare: isLikelySquareName(x.name),
            likelyBanner: isLikelyBannerName(x.name),
          })),
        docs: state.docs
          .filter(x => x.dataUrl)
          .map(x => ({ name: x.name, type: x.type, dataUrl: x.dataUrl })),

        // strong hint for main poster choice
        suggestedMainImageUrl: best ? best.url : null
      };

      const res = await fetch('/admin/ai/extract-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || ('HTTP ' + res.status));
      const data = txt ? JSON.parse(txt) : {};
      if (!data.ok || !data.draft) throw new Error('Unexpected AI response');

      const draft = data.draft;

      // Show a quick preview
      result.innerHTML =
        '<div style="border:1px solid var(--border); border-radius:12px; padding:12px;">'
      +   '<div style="font-weight:700; margin-bottom:8px;">AI draft ready</div>'
      +   '<div class="muted" style="margin-bottom:10px;">Review the Create Show form next, edit anything needed, then approve.</div>'
      +   '<div style="font-size:13px; line-height:1.5;">'
      +     '<div><b>Title:</b> ' + esc(draft.title || '') + '</div>'
      +     '<div><b>Start:</b> ' + esc(draft.startDateTime || '') + '</div>'
      +     '<div><b>End:</b> ' + esc(draft.endDateTime || '') + '</div>'
      +     '<div><b>Venue:</b> ' + esc(draft.venueName || '') + '</div>'
      +     '<div><b>Type / Category:</b> ' + esc(draft.eventType || '') + ' / ' + esc(draft.category || '') + '</div>'
      +   '</div>'
      +   '<div class="row" style="margin-top:12px; gap:10px;">'
      +     '<button id="ai_apply" class="btn p">Open Create Show with this draft</button>'
      +   '</div>'
      + '</div>';

      $('#ai_apply').addEventListener('click', () => {
        // Store draft for Create Show to consume
        sessionStorage.setItem('aiShowDraft', JSON.stringify(draft));
        // Navigate to existing Create Show page
        history.pushState({}, '', '/admin/ui/shows/create');
        route();
      });

      status.textContent = '';
    }catch(e){
      err.textContent = 'AI analyse failed: ' + (e.message || e);
      status.textContent = '';
    }finally{
      btn.disabled = false;
      btn.textContent = 'Analyse & Pre-fill';
    }
  });
}

async function createShow(){
    if (!main) return;
    
    // --- New Look: White background for main content area ---
    // Change the root variable in <style> to make the content area white (if not already done globally).
    // The default --bg is #f7f8fb, but we want a cleaner white form area. 
    // We will ensure the main wrapper background is white for a modern look.
    // The .card background is already white (var(--panel):#ffffff), so we mostly update the structure.

    main.innerHTML =
        '<div class="card" style="padding: 24px;">' // Increased padding for more whitespace
        +'<div class="header" style="margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">'
        +'<div>'
        +'<div class="title" style="font-size: 1.5rem; font-weight: 700;">Create New Event</div>'
        +'<div class="muted">Start setting up your event with core details, categories, and artwork.</div>'
        +'</div>'
        +'</div>'
        
        // Use a single, wider grid column structure for better readability
        +'<div class="grid" style="gap: 20px;">' 
        
        // --- COL 1: Core Details, Category, Venue ---
        +'<div style="flex: 1; padding-right: 20px; border-right: 1px solid var(--border);">'

        // Title
        +'<div class="grid" style="margin-bottom: 20px;">'
        +'<label>Event Title</label>'
+'<input id="sh_title" class="ctl" />'
        +'</div>'

        // Date & Time
       +'<div class="grid" style="margin-bottom: 20px;">'
+'<label>Date & Time</label>'
+'<input id="sh_dt" type="datetime-local" class="ctl" />'
+'</div>'

+'<div class="grid" style="margin-bottom: 20px;">'
+'<label>End Date & Time</label>'
+'<input id="sh_dt_end" type="datetime-local" class="ctl" />'
+'<div class="tip">Optional. Add if you know when the event ends.</div>'
+'</div>'

+'<div class="grid" style="margin-bottom: 20px;">'
+'<label>Venue</label>'
+'<input id="venue_input" class="ctl" placeholder="Start typing a venue…" />'
+'<div class="tip">Pick an existing venue or create a new one.</div>'
+'</div>'

        
// --- NEW: Category and Sub-Category Section ---
+'<div class="grid grid-2" style="margin-bottom: 20px; gap: 16px; align-items: start;">'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Event Type</label>'
    +'<select id="event_type_select" class="ctl">'
      +'<option value="">Select Primary Type</option>'
      +'<option value="comedy">Comedy</option>'
      +'<option value="theatre">Theatre</option>'
      +'<option value="music">Music & Concerts</option>'
      +'<option value="festival">Festivals</option>'
      +'<option value="film">Film & Screenings</option>'
      +'<option value="talks">Talks, Panels & Podcasts</option>'
      +'<option value="workshop">Classes & Workshops</option>'
      +'<option value="corporate">Corporate & Private Events</option>'
      +'<option value="nightlife">Nightlife & Social</option>'
      +'<option value="sport">Sports & Fitness</option>'
      +'<option value="food">Food & Drink</option>'
      +'<option value="community">Community & Charity</option>'
      +'<option value="arts">Arts, Exhibitions & Culture</option>'
      +'<option value="other">Other</option>'
    +'</select>'
  +'</div>'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Category</label>'
+'<select id="event_category_select" class="ctl" disabled>'
      +'<option value="">Select Sub-Category</option>'

      // Original set
      +'<option data-parent="music" value="rock">Rock & Pop</option>'
      +'<option data-parent="music" value="classical">Classical</option>'
      +'<option data-parent="music" value="jazz">Jazz / Blues</option>'
      +'<option data-parent="comedy" value="standup">Stand-Up Comedy</option>'
      +'<option data-parent="comedy" value="improv">Improv / Sketch</option>'
      +'<option data-parent="arts" value="theatre">Theatre / Play</option>'
      +'<option data-parent="arts" value="dance">Dance</option>'
      +'<option data-parent="sport" value="football">Football / Soccer</option>'
      +'<option data-parent="sport" value="running">Running / Marathon</option>'
      +'<option data-parent="conference" value="tech">Tech & IT</option>'
      +'<option data-parent="conference" value="business">Business & Finance</option>'
      +'<option data-parent="family" value="show">Kids Show</option>'
      +'<option data-parent="family" value="activity">Family Activity</option>'
      +'<option data-parent="food" value="festival">Food Festival</option>'
      +'<option data-parent="food" value="tasting">Tasting / Tour</option>'

      // Theatre
      +'<option data-parent="theatre" value="play_drama">Play / Drama</option>'
      +'<option data-parent="theatre" value="panto">Panto</option>'
      +'<option data-parent="theatre" value="musical">Musical Theatre</option>'
      +'<option data-parent="theatre" value="dance">Dance</option>'
      +'<option data-parent="theatre" value="opera">Opera</option>'
      +'<option data-parent="theatre" value="cabaret">Cabaret & Variety</option>'

      // Festivals
      +'<option data-parent="festival" value="comedy_festival">Comedy Festival</option>'
      +'<option data-parent="festival" value="music_festival">Music Festival</option>'
      +'<option data-parent="festival" value="arts_festival">Arts Festival</option>'
      +'<option data-parent="festival" value="food_festival">Food Festival</option>'

      // Film
      +'<option data-parent="film" value="cinema_screening">Cinema Screening</option>'
      +'<option data-parent="film" value="premiere">Premiere</option>'
      +'<option data-parent="film" value="q_and_a">Screening + Q&amp;A</option>'

      // Talks / Panels / Podcasts
      +'<option data-parent="talks" value="live_podcast">Live Podcast</option>'
      +'<option data-parent="talks" value="panel">Panel Discussion</option>'
      +'<option data-parent="talks" value="talk">Talk / Lecture</option>'
      +'<option data-parent="talks" value="book_event">Book Talk / Signing</option>'

      // Corporate / Private
      +'<option data-parent="corporate" value="corporate_night">Corporate Night</option>'
      +'<option data-parent="corporate" value="private_party">Private Party</option>'
      +'<option data-parent="corporate" value="awards">Awards Night</option>'
      +'<option data-parent="corporate" value="fundraiser">Fundraiser</option>'

      // Comedy (extra)
      +'<option data-parent="comedy" value="club_night">Comedy Club Night</option>'
      +'<option data-parent="comedy" value="tour_show">Stand-up Tour Show</option>'
      +'<option data-parent="comedy" value="new_material">New Material Night</option>'
      +'<option data-parent="comedy" value="edinburgh_preview">Edinburgh Preview</option>'
      +'<option data-parent="comedy" value="tv_warmup">TV Warm-up</option>'
      +'<option data-parent="comedy" value="roast_battle">Roast / Battle</option>'

      // Other
      +'<option data-parent="other" value="misc">Miscellaneous</option>'

 +'</select>'
    +'<div class="tip">The list will filter based on Event Type.</div>'
  +'</div>'
+'</div>' // End grid-2

// --- NEW: Doors Open + Age Guidance ---
+'<div class="grid grid-2" style="margin-bottom: 20px; gap: 16px;">'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Doors Open Time</label>'
    +'<input id="doors_open_time" class="ctl" type="time" />'
    +'<div class="tip">Separate from show start time.</div>'
  +'</div>'
  +'<div class="grid" style="gap:4px;">'
+'<label>Age Guidance</label>'
+'<input id="age_guidance" class="ctl" placeholder="e.g. 14+ (minimum age)" />'
+'<div class="tip">Helps reduce customer queries/refunds.</div>'
  +'</div>'
+'</div>'

// --- NEW: End Time / Duration ---
+'<div class="grid" style="margin-bottom: 20px;">'
+'</div>'

// --- NEW: Accessibility ---
+'<div class="grid" style="margin-bottom: 20px;">'
  +'<label>Accessibility</label>'
  +'<div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:#fff;">'
    +'<div class="grid grid-2" style="gap:10px; margin-bottom: 10px;">'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_wheelchair" type="checkbox" />Wheelchair spaces'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_stepfree" type="checkbox" />Step-free access'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_hearingloop" type="checkbox" />Hearing loop'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_toilet" type="checkbox" />Accessible toilet'
      +'</label>'
    +'</div>'
    +'<div class="grid" style="gap:4px;">'
      +'<label style="font-size:12px; color:#64748b; font-weight:600;">More info (optional)</label>'
      +'<input id="acc_more" class="ctl" placeholder="e.g. Contact venue for access requirements" />'
    +'</div>'
  +'</div>'
+'</div>'

// --- NEW: Tags / Keywords ---
+'<div class="grid" style="margin-bottom: 20px;">'
  +'<label>Tags / Keywords</label>'
  +'<input id="tags" class="ctl" placeholder="Comma-separated (e.g. stand-up, tour, friday, cheltenham)" />'
  +'<div class="tip">Improves internal search and future recommendations.</div>'
+'</div>'





        // Description
        +'<div class="grid" style="margin-bottom: 20px;">'
        +'<label>Description (mandatory)</label>'
        + editorToolbarHtml()
        +'<div id="desc" data-editor contenteditable="true" '
        +'style="min-height:150px; border:1px solid var(--border); border-radius:8px; padding:12px; background: #fff;"></div>'
        +'<div class="muted">Write a compelling description for your attendees.</div>'
        +'</div>'
        
        +'</div>' // End COL 1

        // --- COL 2: Image Uploads ---
        +'<div style="flex: 1;">'
        
        // Main Poster Image
        +'<div class="grid" style="margin-bottom: 24px; background: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid var(--border);">'
        +'<label style="font-size: 14px; font-weight: 600;">Main Poster Image (Required)</label>'
        +'<div id="drop_main" class="drop" style="min-height: 120px; border-style: solid; border-color: #94a3b8; background: #fff;">'
        +'<p style="margin: 0; font-weight: 500;">Drop image here or click to upload</p>'
        +'<p class="muted" style="margin-top: 4px; font-size: 12px;">Recommended: High-resolution, Aspect Ratio 2:3</p>'
        +'</div>'
        +'<input id="file_main" type="file" accept="image/*" style="display:none" />'
        +'<div class="progress" style="margin-top:8px"><div id="bar_main" class="bar"></div></div>'
        +'<img id="prev_main" class="imgprev" alt="Main Poster Preview" style="max-height: 200px; display: none;" />'
        +'</div>'
        
        // Additional Images (up to 10)
        +'<div class="grid" style="margin-bottom: 24px;">'
        +'<label style="font-size: 14px; font-weight: 600;">Additional Images (Max 10)</label>'
        +'<div id="additional_images_container" style="display: flex; flex-wrap: wrap; gap: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #ffffff;">'
        // Upload button for additional images
        +'<div id="drop_add" class="drop" style="width: 100px; height: 100px; padding: 0; line-height: 100px; margin: 0; font-size: 24px; border: 2px dashed #94a3b8; color: #475569;">+</div>'
        +'<input id="file_add" type="file" accept="image/*" multiple style="display:none" />'
        // Image previews will be appended here
        +'<div id="add_previews" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>'
        +'</div>'
        +'<div class="progress" style="margin-top:8px"><div id="bar_add" class="bar"></div></div>'
        +'<div class="tip">Upload photos of the venue, performers, or past events.</div>'
        +'</div>'

        // Placeholder to display all uploaded image URLs for submission (hidden)
        +'<input type="hidden" id="all_image_urls" value="" />'

        +'</div>' // End COL 2
        
        +'</div>' // End main grid

        // --- Action Button ---
        +'<div class="row" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); justify-content: space-between; align-items:center;">'
+  '<label id="ai_approval_wrap" style="display:none; align-items:center; gap:10px; font-size:13px; color:#334155;">'
+    '<input id="ai_approval" type="checkbox" />'
+    'I’ve checked the AI-filled details (blue borders) and I’m happy to proceed.'
+  '</label>'
+  '<div class="row" style="gap:10px; align-items:center;">'
+    '<button id="save" class="btn p" style="padding: 10px 20px; font-size: 16px;">Save Event Details and Add Tickets</button>'
+    '<div id="err" class="error"></div>'
+  '</div>'
+'</div>'

        +'</div>';
    
    // Bind editor and venue picker
    bindWysiwyg(main);
mountVenuePicker($('#venue_input'), $('#sh_dt'), { requireApproval: true });

    // --- Category Filtering Logic ---
   const eventTypeSelect = $('#event_type_select');
const categorySelect = $('#event_category_select');

// Cache ALL sub-category options once (from the original HTML)
const allCategoryOptions = Array.from(categorySelect.querySelectorAll('option[data-parent]'));

function updateCategoryOptions() {
  const selectedType = (eventTypeSelect && eventTypeSelect.value) ? eventTypeSelect.value : '';

  // Always reset
  categorySelect.innerHTML = '<option value="">Select Sub-Category</option>';

  // Disable until Event Type chosen
  if (!selectedType) {
    categorySelect.disabled = true;
    categorySelect.value = '';
    return;
  }

  // Enable + populate only matching options
  categorySelect.disabled = false;

  allCategoryOptions.forEach(function(opt){
    if (opt.getAttribute('data-parent') === selectedType) {
      categorySelect.appendChild(opt.cloneNode(true));
    }
  });

  categorySelect.value = '';
}

eventTypeSelect.addEventListener('change', updateCategoryOptions);
updateCategoryOptions();


    // --- Image Upload Logic (Updated for Main & Additional Images) ---
    var dropMain = $('#drop_main');
    var fileMain = $('#file_main');
    var barMain = $('#bar_main');
    var prevMain = $('#prev_main');

    var dropAdd = $('#drop_add');
    var fileAdd = $('#file_add');
    var barAdd = $('#bar_add');
    var addPreviews = $('#add_previews');
    var allImageUrls = $('#all_image_urls');
    
    // Upload function for a single file (used for main image and each additional image)
    async function doUpload(file, barEl, previewEl, isAdditional = false) {
        $('#err').textContent = '';
        barEl.style.width = '15%';

        try {
            var out = await uploadPoster(file); // Reusing existing uploadPoster API

            if (isAdditional) {
                // Add new preview element and update hidden field
                var imgContainer = document.createElement('div');
                imgContainer.style.position = 'relative';
                imgContainer.style.width = '100px';
                imgContainer.style.height = '100px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.borderRadius = '6px';
                imgContainer.dataset.url = out.url;

                var img = document.createElement('img');
                img.src = out.url;
                img.alt = 'Additional Image';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';

                var deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'x';
                deleteBtn.className = 'btn';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '24px';
                deleteBtn.style.height = '24px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.lineHeight = '24px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.style.fontWeight = 'bold';
                deleteBtn.style.background = 'rgba(255, 255, 255, 0.8)';
                deleteBtn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                deleteBtn.style.cursor = 'pointer';

                deleteBtn.addEventListener('click', function() {
                    imgContainer.remove();
                    updateAllImageUrls();
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(deleteBtn);
                addPreviews.appendChild(imgContainer);

                updateAllImageUrls();
            } else {
                // Update main image preview
                previewEl.src = out.url;
                previewEl.style.display = 'block';
            }

            barEl.style.width = '100%';
            setTimeout(function() { barEl.style.width = '0%'; }, 800);
            return out.url;
        } catch (e) {
            barEl.style.width = '0%';
            $('#err').textContent = 'Upload failed: ' + (e.message || e);
            throw e; // Re-throw to be caught by the calling function if needed
        }
    }

    // Helper to update the hidden field with all additional image URLs
    function updateAllImageUrls() {
        const urls = $$('#add_previews > div').map(el => el.dataset.url);
        allImageUrls.value = JSON.stringify(urls);
        // Hide/show the drop button if at the 10 image limit
        if (urls.length >= 10) {
            dropAdd.style.display = 'none';
        } else {
            dropAdd.style.display = 'block';
        }
    }

        // --- AI Prefill (one-time) ---
    (function applyAiDraftIfPresent(){
        try{
            var raw = sessionStorage.getItem('aiShowDraft');
            if (!raw) return;

            // One-time consume
            sessionStorage.removeItem('aiShowDraft');

            var draft = JSON.parse(raw || '{}') || {};

            function isoToLocalInput(iso){
                if (!iso) return '';
                var d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                // yyyy-MM-ddTHH:mm
                var pad = (n) => String(n).padStart(2,'0');
                return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
                  + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            }

                        // Flag that this page is AI-filled
            window.__aiPrefill = true;

            // Show approval UI + change button wording
            var aiWrap = $('#ai_approval_wrap');
            if (aiWrap) aiWrap.style.display = 'flex';

            var saveBtn = $('#save');
            if (saveBtn){
              saveBtn.textContent = 'I’ve checked the AI-filled details — Save and add tickets';
            }

            // Bind clear-on-edit for key fields
            bindAiClearOnUserEdit($('#sh_title'));
            bindAiClearOnUserEdit($('#sh_dt'));
            bindAiClearOnUserEdit($('#sh_dt_end'));
            bindAiClearOnUserEdit($('#doors_open_time'));
            bindAiClearOnUserEdit($('#age_guidance'));
            bindAiClearOnUserEdit($('#tags'));
            bindAiClearOnUserEdit(eventTypeSelect);
            bindAiClearOnUserEdit(categorySelect);

            // Contenteditable description
            bindAiClearOnUserEdit($('#desc'), ['input','blur','keyup']);

            // Drops
            bindAiClearOnUserEdit($('#drop_main'), ['click','drop']);
            bindAiClearOnUserEdit($('#drop_add'), ['click']);

            // --- Title (AI) ---
            if (draft.title && $('#sh_title')){
              $('#sh_title').value = draft.title;
              markAi($('#sh_title'));
            }

            // --- Dates ---
            if (draft.startDateTime && $('#sh_dt')){
              $('#sh_dt').value = isoToLocalInput(draft.startDateTime);
              markAi($('#sh_dt'));
            }
            if (draft.endDateTime && $('#sh_dt_end')){
              $('#sh_dt_end').value = isoToLocalInput(draft.endDateTime);
              markAi($('#sh_dt_end'));
            }

            // --- Doors / Age ---
            if (draft.doorsOpenTime && $('#doors_open_time')){
              $('#doors_open_time').value = String(draft.doorsOpenTime).slice(0,5);
              markAi($('#doors_open_time'));
            }
            if (draft.ageGuidance && $('#age_guidance')){
              $('#age_guidance').value = String(draft.ageGuidance);
              markAi($('#age_guidance'));
            }

            // --- Description: use doc text if provided by AI extractor ---
            if (draft.descriptionHtml && $('#desc')){
              $('#desc').innerHTML = draft.descriptionHtml;
              markAi($('#desc'), 'editor');
            }

            // --- Type + Category ---
            if (draft.eventType && eventTypeSelect){
              eventTypeSelect.value = draft.eventType;
              updateCategoryOptions();
              markAi(eventTypeSelect);
            }
            if (draft.category && categorySelect){
              categorySelect.value = draft.category;
              markAi(categorySelect);
            }

            // --- Tags (force showing 10, comma-separated) ---
            if (Array.isArray(draft.tags) && $('#tags')){
              $('#tags').value = draft.tags.filter(Boolean).slice(0,10).join(', ');
              markAi($('#tags'));
            }

            // --- Accessibility ---
            if (draft.accessibility){
              if ($('#acc_wheelchair')) { $('#acc_wheelchair').checked = !!draft.accessibility.wheelchair; markAi($('#acc_wheelchair')); }
              if ($('#acc_stepfree')) { $('#acc_stepfree').checked = !!draft.accessibility.stepFree; markAi($('#acc_stepfree')); }
              if ($('#acc_hearingloop')) { $('#acc_hearingloop').checked = !!draft.accessibility.hearingLoop; markAi($('#acc_hearingloop')); }
              if ($('#acc_toilet')) { $('#acc_toilet').checked = !!draft.accessibility.accessibleToilet; markAi($('#acc_toilet')); }
              if ($('#acc_more')) { $('#acc_more').value = (draft.accessibility.notes || ''); markAi($('#acc_more')); }
            }

            // --- Venue: attempt auto-select existing venue; else open create with address prefilled ---
            if ($('#venue_input')){
              var vin = $('#venue_input');
              bindAiClearOnUserEdit(vin);

              if (draft.venueName){
                vin.value = draft.venueName;
                markAi(vin);

                // If venue picker API is present, try to select best match
                if (vin._venuePicker && typeof searchVenues === 'function'){
                  (async function(){
                    var list = await searchVenues(draft.venueName);
                    if (Array.isArray(list) && list.length){
                      await vin._venuePicker.selectExisting(list[0]);
                      markAi(vin);
                    } else {
                      // No match found: open create venue panel prefilled with address
                      if (draft.venueAddress){
                        vin._venuePicker.openCreate(draft.venueName, draft.venueAddress);
                        markAi(vin);
                      } else {
                        // still force user to confirm manually
                        vin.dispatchEvent(new Event('input', { bubbles:true }));
                      }
                    }
                  })();
                } else {
                  vin.dispatchEvent(new Event('input', { bubbles:true }));
                }
              }
            }

            // --- Images ---
            if (draft.mainImageUrl && prevMain){
              prevMain.src = draft.mainImageUrl;
              prevMain.style.display = 'block';
              markAi($('#drop_main'), 'drop');
            }

            if (Array.isArray(draft.additionalImageUrls) && draft.additionalImageUrls.length && addPreviews){
              addPreviews.innerHTML = '';
              draft.additionalImageUrls.slice(0,10).forEach(function(url){
                var imgContainer = document.createElement('div');
                imgContainer.style.position = 'relative';
                imgContainer.style.width = '100px';
                imgContainer.style.height = '100px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.borderRadius = '6px';
                imgContainer.dataset.url = url;

                var img = document.createElement('img');
                img.src = url;
                img.alt = 'Additional Image';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';

                var deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'x';
                deleteBtn.className = 'btn';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '24px';
                deleteBtn.style.height = '24px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.lineHeight = '24px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.style.fontWeight = 'bold';
                deleteBtn.style.background = 'rgba(255, 255, 255, 0.8)';
                deleteBtn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                deleteBtn.style.cursor = 'pointer';

                deleteBtn.addEventListener('click', function() {
                  imgContainer.remove();
                  updateAllImageUrls();
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(deleteBtn);
                addPreviews.appendChild(imgContainer);
              });

              updateAllImageUrls();
              markAi($('#drop_add'), 'drop');
            }

        }catch(e){
            console.warn('[AI draft] apply failed', e);
        }
    })();



    // --- Main Image Event Listeners ---
    dropMain.addEventListener('click', function() { fileMain.click(); });
    dropMain.addEventListener('dragover', function(e) { e.preventDefault(); dropMain.classList.add('drag'); });
    dropMain.addEventListener('dragleave', function() { dropMain.classList.remove('drag'); });
    dropMain.addEventListener('drop', async function(e) {
        e.preventDefault();
        dropMain.classList.remove('drag');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) await doUpload(f, barMain, prevMain);
    });
    fileMain.addEventListener('change', async function() {
        var f = fileMain.files && fileMain.files[0];
        if (f) await doUpload(f, barMain, prevMain);
    });

    // --- Additional Images Event Listeners ---
    dropAdd.addEventListener('click', function() { 
        // Only open file dialog if we haven't hit the limit
        if ($$('#add_previews > div').length < 10) {
            fileAdd.click(); 
        }
    });
    fileAdd.addEventListener('change', async function() {
        var files = fileAdd.files;
        if (files) {
            let currentCount = $$('#add_previews > div').length;
            let filesToUpload = Array.from(files).slice(0, 10 - currentCount);

            if (filesToUpload.length > 0) {
                // We show one progress bar for simplicity, as multiple simultaneous uploads can be complex
                barAdd.style.width = '15%'; 
                let uploadedCount = 0;
                let total = filesToUpload.length;

                for (const f of filesToUpload) {
                    try {
                        await doUpload(f, barAdd, null, true);
                        uploadedCount++;
                        barAdd.style.width = Math.round((uploadedCount / total) * 100) + '%';
                    } catch (e) {
                        // Error handling is inside doUpload
                    }
                }
                setTimeout(function() { barAdd.style.width = '0%'; }, 800);
            }
        }
        fileAdd.value = ''; // Reset file input so change event fires if the same file is selected again
    });

    // --- Save Logic (Updated to remove ticket-specific fields and include new fields) ---
    $('#save').addEventListener('click', async function(){
        var errEl = $('#err');
        errEl.textContent = '';
        try{
                    // If AI prefilled this page, force an explicit approval tick
            if (window.__aiPrefill){
              var okBox = $('#ai_approval');
              if (!okBox || !okBox.checked){
                throw new Error('Please confirm you’ve checked the AI-filled details before continuing.');
              }
            }

            var title = $('#sh_title').value.trim();
            var dtRaw = $('#sh_dt').value;
            var dtEndRaw = $('#sh_dt_end') ? $('#sh_dt_end').value : '';
var endDateIso = dtEndRaw ? new Date(dtEndRaw).toISOString() : null;
            var venueInput = $('#venue_input');
            var venueText = venueInput.value.trim();
            var venueId = venueInput.dataset.venueId || null;
            if (!venueId){
  throw new Error('Please select an existing venue from the list (or create one).');
}
if (venueInput.dataset.venueApproved !== '1'){
  throw new Error('Please approve the venue and date before saving.');
}

            var imageUrl = prevMain.src || null;
            var descHtml = $('#desc').innerHTML.trim();
            
            // New fields
           var eventType = eventTypeSelect ? eventTypeSelect.value : '';
var eventCategory = categorySelect ? categorySelect.value : '';

// NEW fields (optional)
var doorsOpenTime = $('#doors_open_time') ? $('#doors_open_time').value : '';
var ageGuidance = $('#age_guidance') ? $('#age_guidance').value : '';
var endTimeNote = $('#end_time_note') ? $('#end_time_note').value.trim() : '';

var accessibility = {
  wheelchair: $('#acc_wheelchair') ? !!$('#acc_wheelchair').checked : false,
  stepFree: $('#acc_stepfree') ? !!$('#acc_stepfree').checked : false,
  hearingLoop: $('#acc_hearingloop') ? !!$('#acc_hearingloop').checked : false,
  accessibleToilet: $('#acc_toilet') ? !!$('#acc_toilet').checked : false,
  notes: $('#acc_more') ? $('#acc_more').value.trim() : ''
};

var tags = [];
if ($('#tags') && $('#tags').value) {
  tags = $('#tags').value
    .split(',')
    .map(function(s){ return s.trim(); })
    .filter(Boolean);
}

var additionalImages = [];
if (allImageUrls && allImageUrls.value) {
  try { additionalImages = JSON.parse(allImageUrls.value); } catch(e){}
}


            if (!title || !dtRaw || !venueText || !descHtml || !eventType || !eventCategory || !imageUrl){
                throw new Error('Title, date/time, venue, description, event type, category, and a main image are required.');
            }
            
            var dateIso = new Date(dtRaw).toISOString();
            
            // The logic for first ticket payload is now REMOVED
            // var firstTicketPayload = null; 
            
            var showRes = await j('/admin/shows', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
  title: title,
  date: dateIso,
  endDate: endDateIso,
  venueText: venueText,
  venueId: venueId,
  imageUrl: imageUrl,
  descriptionHtml: descHtml,
  eventType: eventType,
  eventCategory: eventCategory,
  additionalImages: additionalImages,

  // NEW fields
  doorsOpenTime: doorsOpenTime || null,
  ageGuidance: ageGuidance || null,
  endTimeNote: endTimeNote || null,
  accessibility: accessibility,
  tags: tags
})

            });

            if (showRes && showRes.error){
                throw new Error(showRes.error);
            }
            var showId =
                (showRes &&
                ( showRes.id
                || (showRes.show && showRes.show.id)
                || (showRes.item && showRes.item.id)
                )) || null;

            if (!showId){
                throw new Error('Failed to create show (no id returned from server)');
            }
            
            // NEW: Redirect to the tickets page or seating choice, as first ticket creation is removed
            window.location.href = '/admin/seating-choice/' + showId; 

        }catch(e){
            errEl.textContent = e.message || String(e);
        }
    });
}
  // --- LIST SHOWS ---
  async function listShows(){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div class="title">All events</div>'
          +'<button id="refresh" class="btn">Refresh</button>'
        +'</div>'
        +'<table>'
          +'<thead><tr>'
            +'<th>Title</th><th>When</th><th>Venue</th>'
            +'<th>Total allocation</th><th>Gross face</th><th>Status</th><th></th>'
          +'</tr></thead>'
          +'<tbody id="tbody"></tbody>'
        +'</table>'
      +'</div>';

    async function load(){
      var tb = $('#tbody');
      tb.innerHTML = '<tr><td colspan="7" class="muted">Loading…</td></tr>';
      try{
        var data = await j('/admin/shows');
        var items = data.items || [];
        if (!items.length){
          tb.innerHTML = '<tr><td colspan="7" class="muted">No shows yet</td></tr>';
          return;
        }
        tb.innerHTML = items.map(function(s){
          var when = s.date
            ? new Date(s.date).toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short' })
            : '';
          var total = (s._alloc && s._alloc.total) || 0;
          var sold  = (s._alloc && s._alloc.sold) || 0;
          var hold  = (s._alloc && s._alloc.hold) || 0;
          var avail = Math.max(total - sold - hold, 0);
          var pct   = total ? Math.round((sold / total) * 100) : 0;
          var bar   = '<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px">'
                    +'<div style="background:#111827;height:6px;width:'+pct+'%"></div>'
                    +'</div>';
          var statusLabel = (s.status || 'DRAFT');
          var statusBadge = '<span class="pill" style="background:'
            +(statusLabel === 'LIVE' ? '#ecfdf3' : '#f8fafc')
            +';color:'+(statusLabel === 'LIVE' ? '#166534' : '#475569')
            +';border:1px solid '+(statusLabel === 'LIVE' ? '#bbf7d0' : '#e2e8f0')
            +';">'+statusLabel+'</span>';
          return ''
            +'<tr data-row="'+s.id+'" data-status="'+statusLabel+'">'
              +'<td>'+(s.title || '')+'</td>'
              +'<td>'+when+'</td>'
              +'<td>'+(s.venue ? (s.venue.name + (s.venue.city ? ' – '+s.venue.city : '')) : '')+'</td>'
              +'<td><span class="muted">Sold '+sold+' · Hold '+hold+' · Avail '+avail+'</span> '+bar+'</td>'
              +'<td>£'+(((s._revenue && s._revenue.grossFace) || 0).toFixed(2))+'</td>'
              +'<td>'+statusBadge+'</td>'
              +'<td>'
                +'<div class="kebab">'
                  +'<button class="btn" data-kebab="'+s.id+'">⋮</button>'
                  +'<div class="menu" id="m-'+s.id+'">'
                    +'<a href="#" data-edit="'+s.id+'">Edit</a>'
                    +'<a href="#" data-seating="'+s.id+'">Seating map</a>'
                    +'<a href="#" data-tickets="'+s.id+'">Tickets</a>'
                    +'<a href="#" data-dup="'+s.id+'">Duplicate</a>'
                  +'</div>'
                +'</div>'
              +'</td>'
            +'</tr>';
        }).join('');

        // kebab menu
        $$('[data-kebab]').forEach(function(btn){
          btn.addEventListener('click', function(e){
            e.preventDefault();
            var id = btn.getAttribute('data-kebab');
            var m = $('#m-' + id);
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
            if (m) m.classList.add('open');
          });
        });
        document.addEventListener('click', function(e){
          var t = e.target;
          if (!t || !t.closest || !t.closest('.kebab')){
            $$('.menu').forEach(function(x){ x.classList.remove('open'); });
          }
        });

        // actions
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
            if (id) window.location.href = '/admin/seating/builder/preview/' + id;
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
              if (!id) return;
              var r = await j('/admin/shows/'+id+'/duplicate', { method:'POST' });
              if (r && r.ok && r.newId){
                go('/admin/ui/shows/'+r.newId+'/edit');
              }
            }catch(err){
              alert('Duplicate failed: ' + (err.message || err));
            }
          });
        });
        $$('[data-row]').forEach(function(row){
          row.addEventListener('click', function(e){
            if (e.target && (e.target.closest('a') || e.target.closest('button'))) return;
            var id = row.getAttribute('data-row');
            var status = row.getAttribute('data-status');
            if (!id) return;
            if (status === 'DRAFT') {
              window.location.href = '/admin/seating/builder/preview/' + id;
            } else {
              go('/admin/ui/shows/' + id + '/summary');
            }
          });
        });
      }catch(e){
        tb.innerHTML = '<tr><td colspan="7" class="error">Failed to load shows: '+(e.message||e)+'</td></tr>';
      }
    }

    $('#refresh').addEventListener('click', load);
    load();
  }

  // --- EDIT SHOW ---
  async function editShow(id){
    var resp;
    try{
      resp = await j('/admin/shows/' + id);
    }catch(e){
      if (!main) return;
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    var item = resp.item || {};
    if (!main) return;

    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Edit show</div></div>'
        +'<div class="grid grid-2">'
          +'<div class="grid">'
            +'<label>Title</label>'
            +'<input id="sh_title" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Date & time</label>'
            +'<input id="sh_dt" type="datetime-local" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Venue</label>'
            +'<input id="venue_input" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Poster image</label>'
            +'<div class="drop" id="drop">Drop image here or click to choose</div>'
            +'<input id="file" type="file" accept="image/*" style="display:none" />'
            +'<div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>'
            +'<img id="prev" class="imgprev" />'
          +'</div>'
        +'</div>'
        +'<div class="grid" style="margin-top:10px">'
          +'<label>Description</label>'
          + editorToolbarHtml()
          +'<div id="desc" data-editor contenteditable="true" '
            +'style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>'
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

    $('#sh_title').value = item.title || '';
    var vInput = $('#venue_input');
    vInput.value =
      (item.venue && item.venue.name) ||
      item.venueText ||
      '';
    if (item.date){
      var dt = new Date(item.date);
      $('#sh_dt').value = dt.toISOString().slice(0,16);
    }
    $('#desc').innerHTML = item.description || '';

    var drop = $('#drop');
    var file = $('#file');
    var bar  = $('#bar');
    var prev = $('#prev');

    if (item.imageUrl){
      prev.src = item.imageUrl;
      prev.style.display = 'block';
    }

    async function doUpload(f){
      $('#err').textContent = '';
      bar.style.width = '15%';
      try{
        var out = await uploadPoster(f);
        prev.src = out.url;
        prev.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width='0%'; }, 800);
      }catch(e){
        bar.style.width = '0%';
        $('#err').textContent = 'Upload failed: '+(e.message||e);
      }
    }

    drop.addEventListener('click', function(){ file.click(); });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });
    drop.addEventListener('drop', async function(e){
      e.preventDefault(); drop.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await doUpload(f);
    });
    file.addEventListener('change', async function(){
      var f = file.files && file.files[0];
      if (f) await doUpload(f);
    });

    $('#goSeating').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/' + id + '/seating');
    });
    $('#goTickets').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/' + id + '/tickets');
    });

    $('#save').addEventListener('click', async function(){
      var errEl = $('#err');
      errEl.textContent = '';
      try{
        var payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value
            ? new Date($('#sh_dt').value).toISOString()
            : null,
          venueText: vInput.value.trim(),
          venueId: vInput.dataset.venueId || null,
          imageUrl: prev.src || null,
          descriptionHtml: $('#desc').innerHTML.trim(),
          status: item.status
        };
        if (!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
          throw new Error('Title, date/time, venue and description are required');
        }
        var r = await j('/admin/shows/' + id, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if (r && r.ok){
          alert('Saved');
        }else{
          throw new Error((r && r.error) || 'Failed to save');
        }
      }catch(e){
        errEl.textContent = e.message || String(e);
      }
    });
  }

  // --- SUMMARY PAGE ---
// [src/routes/admin-ui.ts - Replace the summaryPage function]

async function summaryPage(id){
  if (!main) return;
  main.innerHTML = '<div class="card"><div class="title">Loading summary…</div></div>';
  let resp;
  try{
    resp = await j('/admin/shows/' + id);
  }catch(e){
    main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
    return;
  }
  const show = resp.item || {};
  const ticketTypes = show.ticketTypes || [];
  const when = show.date
    ? new Date(show.date).toLocaleString('en-GB', { dateStyle:'full', timeStyle:'short' })
    : '';
  const venueName = show.venue
    ? (show.venue.name + (show.venue.city ? ' – ' + show.venue.city : ''))
    : (show.venueText || '');
  
  const statusLabel = show.status || 'DRAFT';
  const isLive = statusLabel === 'LIVE';

  // --- Links Configuration ---
  // 1. SSR Checkout URL (Backend route)
  const publicBookingUrl = window.location.origin + '/public/event/' + id;
  // 2. Frontend Next.js URL (Adjust domain if frontend is hosted separately)
  const publicFrontendUrl = 'https://chuckl-ticketing-production.up.railway.app/events/' + id;

  let linksHtml = '';
  
  if (isLive) {
    linksHtml = ''
    + '<div class="grid">'
    +   '<div style="margin-bottom:8px">'
    +     '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:#64748b">Public booking page</label>'
    +     '<div style="display:flex;gap:8px">'
    +       '<input readonly value="'+publicBookingUrl+'" style="flex:1;background:#f8fafc;color:#334155;border:1px solid #e2e8f0;border-radius:6px;padding:8px" onclick="this.select()">'
    +       '<a href="'+publicBookingUrl+'" target="_blank" class="btn" style="color:#0284c7;border-color:#0284c7;text-decoration:none">Open ↗</a>'
    +     '</div>'
    +   '</div>'
    +   '<div>'
    +     '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:#64748b">Public Next.js page</label>'
    +     '<div style="display:flex;gap:8px">'
    +       '<input readonly value="'+publicFrontendUrl+'" style="flex:1;background:#f8fafc;color:#334155;border:1px solid #e2e8f0;border-radius:6px;padding:8px" onclick="this.select()">'
    +       '<a href="'+publicFrontendUrl+'" target="_blank" class="btn" style="color:#0284c7;border-color:#0284c7;text-decoration:none">Open ↗</a>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="muted" style="margin-top:12px;font-size:13px">Your event is live. Copy these links to share.</div>';
  } else {
    linksHtml = ''
    + '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px;color:#9f1239;font-size:13px;line-height:1.4">'
    +   '<strong>Event is not live.</strong><br/>'
    +   'Please configure tickets and click "Publish Show" in the <a href="#" id="linkToBuilder" style="color:inherit;text-decoration:underline">Seating Builder</a> to generate shareable links.'
    + '</div>';
  }

  main.innerHTML = ''
    +'<div class="card">'
    +'<div class="header">'
    +'<div>'
    +'<div class="title">'+(show.title || 'Untitled show')+'</div>'
    +'<div class="muted">'+(when ? when + ' · ' : '')+venueName+'</div>'
    +'<div style="margin-top:6px">'
    +'<span class="pill" style="background:'+(isLive ? '#ecfdf3' : '#f8fafc')+';color:'+(isLive ? '#166534' : '#475569')+';border:1px solid '+(isLive ? '#bbf7d0' : '#e2e8f0')+'">'+statusLabel+'</span>'
    +(show.publishedAt ? '<span class="muted" style="margin-left:8px">Published '+new Date(show.publishedAt).toLocaleString('en-GB')+'</span>' : '')
    +'</div>'
    +'</div>'
    +'<div class="row">'
    +'<button class="btn" id="summarySeating">Edit seating</button>'
    +'<button class="btn" id="summaryTickets">Manage tickets</button>'
    +'</div>'
    +'</div>'
    +(show.imageUrl ? '<div style="margin-bottom:16px"><img src="'+show.imageUrl+'" alt="Poster" style="max-height:220px;border-radius:12px;border:1px solid var(--border)" /></div>' : '')
    +'<div class="grid grid-2" style="margin-bottom:16px">'
    
    // SHAREABLE LINKS CARD
    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:12px">Shareable links</div>'
    + linksHtml
    +'</div>'

    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:6px">Key details</div>'
    +'<div class="grid">'
    +'<div><div class="muted">Date & time</div><div>'+(when || 'TBC')+'</div></div>'
    +'<div><div class="muted">Venue</div><div>'+(venueName || 'TBC')+'</div></div>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:8px">Ticket types</div>'
    +(ticketTypes.length === 0
      ? '<div class="muted">No ticket types yet. Use "Manage tickets" to add them.</div>'
      : '<table><thead><tr><th>Name</th><th>Price</th><th>Available</th></tr></thead><tbody>'
      + ticketTypes.map(function(t){
          return '<tr><td>'+t.name+'</td><td>£'+((t.pricePence || 0)/100).toFixed(2)+'</td><td>'+(t.available == null ? '—' : t.available)+'</td></tr>';
        }).join('')
      +'</tbody></table>')
    +'</div>'
    +'</div>';

  var summarySeating = $('#summarySeating');
  var summaryTickets = $('#summaryTickets');
  var linkToBuilder = $('#linkToBuilder');

  if (summarySeating){
    summarySeating.addEventListener('click', function(){
      window.location.href = '/admin/seating/builder/preview/' + id;
    });
  }
  if (summaryTickets){
    summaryTickets.addEventListener('click', function(){
      go('/admin/ui/shows/' + id + '/tickets');
    });
  }
  if (linkToBuilder){
    linkToBuilder.addEventListener('click', function(e){
      e.preventDefault();
      window.location.href = '/admin/seating/builder/preview/' + id;
    });
  }
}

  // --- TICKETS PAGE ---
  async function ticketsPage(id){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Loading tickets…</div></div>';

    var showResp;
    try{
      showResp = await j('/admin/shows/' + id);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    var show = showResp.item || {};
    var when = show.date
      ? new Date(show.date).toLocaleString('en-GB', { dateStyle:'full', timeStyle:'short' })
      : '';
    var venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – ' + show.venue.city : ''))
      : (show.venueText || '');

    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Tickets for '+(show.title || 'Untitled show')+'</div>'
            +'<div class="muted">'+(when ? when + ' · ' : '') + venueName +'</div>'
          +'</div>'
          +'<div class="row">'
            +'<button class="btn" id="backToShows">Back to all events</button>'
            +'<button class="btn" id="editShowBtn">Edit show</button>'
          +'</div>'
        +'</div>'

        +'<div class="grid grid-2" style="margin-bottom:16px">'
          +'<div class="card" style="margin:0">'
            +'<div class="title" style="margin-bottom:4px">Ticket structure</div>'
            +'<div class="muted" style="margin-bottom:8px">'
              +'Tickets can be free (price £0) or paid, and can be sold as general admission or allocated seating.'
            +'</div>'
            +'<div class="row" style="margin-bottom:8px">'
              +'<span class="pill" id="structureGeneral">General admission</span>'
              +'<span class="pill" id="structureAllocated">Allocated seating</span>'
            +'</div>'
            +'<div class="muted" style="font-size:12px">'
              +'Allocated seating uses a seating map for this venue. You can reuse an existing map or create a new one just for this show.'
            +'</div>'
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
          +'<div class="muted" style="margin-bottom:8px">'
// [Fixed Code]
+'Set up the tickets you want to sell for this show. A £0 price will be treated as a free ticket.'
+'</div>'
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
    $('#editShowBtn').addEventListener('click', function(){ go('/admin/ui/shows/' + id + '/edit'); });

    var addTypeForm = $('#addTypeForm');
    var ticketTypesBody = $('#ticketTypesBody');
    var ticketTypesEmpty = $('#ticketTypesEmpty');

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
        var res = await j('/admin/shows/' + id + '/ticket-types');
        var items = res.ticketTypes || [];
        if (!items.length){
          ticketTypesBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet.</td></tr>';
          ticketTypesEmpty.style.display = 'block';
        }else{
          ticketTypesEmpty.style.display = 'none';
          ticketTypesBody.innerHTML = items.map(function(tt){
            var price = (tt.pricePence || 0) / 100;
            var priceLabel = price === 0 ? 'Free' : '£' + price.toFixed(2);
            var availLabel = tt.available == null ? 'Unlimited' : String(tt.available);
            return ''
              +'<tr>'
                +'<td>'+(tt.name || '')+'</td>'
                +'<td>'+priceLabel+'</td>'
                +'<td>'+availLabel+'</td>'
                +'<td><button class="btn" data-del="'+tt.id+'">Delete</button></td>'
              +'</tr>';
          }).join('');

          $$('[data-del]', ticketTypesBody).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var toDel = btn.getAttribute('data-del');
              if (!toDel) return;
              if (!confirm('Delete this ticket type?')) return;
              try{
                await j('/admin/ticket-types/' + toDel, { method:'DELETE' });
                loadTicketTypes();
              }catch(err){
                alert('Failed to delete: ' + (err.message || err));
              }
            });
          });
        }
      }catch(e){
        ticketTypesBody.innerHTML = '<tr><td colspan="4" class="error">Failed to load ticket types: '+(e.message||e)+'</td></tr>';
      }
    }

    $('#tt_save').addEventListener('click', async function(){
      var errEl = $('#tt_err');
      errEl.textContent = '';
      var name = $('#tt_name').value.trim();
      var priceStr = $('#tt_price').value.trim();
      var availStr = $('#tt_available').value.trim();

      if (!name){
        errEl.textContent = 'Name is required';
        return;
      }

      var pricePence = 0;
      if (priceStr){
        var p = Number(priceStr);
        if (!Number.isFinite(p) || p < 0){
          errEl.textContent = 'Price must be a non-negative number';
          return;
        }
        pricePence = Math.round(p * 100);
      }

      var available = null;
      if (availStr){
        var a = Number(availStr);
        if (!Number.isFinite(a) || a < 0){
          errEl.textContent = 'Available must be a non-negative number';
          return;
        }
        available = a;
      }

      try{
        await j('/admin/shows/' + id + '/ticket-types', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name:name, pricePence:pricePence, available:available })
        });
        $('#tt_name').value = '';
        $('#tt_price').value = '';
        $('#tt_available').value = '';
        addTypeForm.style.display = 'none';
        loadTicketTypes();
      }catch(err){
        errEl.textContent = err.message || String(err);
      }
    });

    loadTicketTypes();

    // seat map summary
    var seatMapsSummary = $('#seatMapsSummary');
    var seatMapsList = $('#seatMapsList');
    var venueId = show.venue && show.venue.id ? show.venue.id : null;

    async function loadSeatMaps(){
      seatMapsSummary.textContent = 'Loading seat maps…';
      seatMapsList.innerHTML = '';
      try{
        var url = '/admin/seatmaps?showId=' + encodeURIComponent(id);
        if (venueId) url += '&venueId=' + encodeURIComponent(venueId);
        var maps = await j(url);
        if (!Array.isArray(maps) || !maps.length){
          seatMapsSummary.textContent = 'No seat maps yet for this show/venue.';
          seatMapsList.innerHTML = '<div class="muted" style="font-size:13px">You can create a seat map using the “Create / edit seat map” button.</div>';
          return;
        }
        seatMapsSummary.textContent = maps.length + ' seat map' + (maps.length > 1 ? 's' : '') + ' found.';
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
            var mid = btn.getAttribute('data-make-default');
            if (!mid) return;
            try{
              await j('/admin/seatmaps/' + mid + '/default', {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ isDefault:true })
              });
              loadSeatMaps();
            }catch(err){
              alert('Failed to update default: ' + (err.message || err));
            }
          });
        });
      }catch(e){
        seatMapsSummary.textContent = 'Failed to load seat maps.';
        seatMapsList.innerHTML = '<div class="error" style="font-size:13px">'+(e.message||e)+'</div>';
      }
    }

    $('#refreshSeatMaps').addEventListener('click', loadSeatMaps);
    $('#editSeatMaps').addEventListener('click', function(){
      go('/admin/ui/shows/' + id + '/seating');
    });

    loadSeatMaps();

    // ticket structure pill toggle (visual only for now)
    var structureGeneral = $('#structureGeneral');
    var structureAllocated = $('#structureAllocated');
    function setStructure(mode){
      if (mode === 'allocated'){
        structureAllocated.style.background = '#111827';
        structureAllocated.style.color = '#ffffff';
        structureGeneral.style.background = '#f9fafb';
        structureGeneral.style.color = '#111827';
      }else{
        structureGeneral.style.background = '#111827';
        structureGeneral.style.color = '#ffffff';
        structureAllocated.style.background = '#f9fafb';
        structureAllocated.style.color = '#111827';
      }
    }
    structureGeneral.addEventListener('click', function(){ setStructure('general'); });
    structureAllocated.addEventListener('click', function(){ setStructure('allocated'); });
    setStructure(show.usesAllocatedSeating ? 'allocated' : 'general');
  }

  // --- SEATING PAGE (temporary stub UI) ---
  async function seatingPage(showId){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div class="title">Seating for show '+showId+'</div>'
          +'<button class="btn" id="backToTickets">Back to tickets</button>'
        +'</div>'
        +'<div class="muted" style="margin-bottom:8px">'
          +'This is a placeholder for the full Eventbrite-style seating builder. '
          +'Your existing seatmaps API remains intact – we are just not rendering the editor here yet.'
        +'</div>'
        +'<div class="muted" style="font-size:13px">'
          +'Once we finish the seating-choice wizard and builder, this page will let you create and edit detailed seat layouts, '
          +'attach them to shows, and map ticket types to seats.'
        +'</div>'
      +'</div>';
    var btn = $('#backToTickets');
    if (btn){
      btn.addEventListener('click', function(){
        go('/admin/ui/shows/' + showId + '/tickets');
      });
    }
  }

  // --- OTHER SIMPLE PAGES ---
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
    main.innerHTML = '<div class="card"><div class="title">Email Campaigns</div><div class="muted">Email tools will plug into your marketing automation stack.</div></div>';
  }
  async function account(){
  if (!main) return;

  main.innerHTML =
    '<div class="card">'
      +'<div class="header">'
        +'<div>'
          +'<div class="title">Account</div>'
          +'<div class="muted">Manage your profile and security.</div>'
        +'</div>'
        +'<a class="btn" href="/admin/ui/logout" style="text-decoration:none">Log out</a>'
      +'</div>'
      +'<div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="card" style="margin:0">'
          +'<div class="title">Profile</div>'
          +'<div class="muted" style="margin-bottom:10px">Update your name and email.</div>'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Name</label>'
          +'<input id="acc_name" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Email</label>'
          +'<input id="acc_email" type="email" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<div class="row" style="margin-top:10px;gap:8px">'
            +'<button class="btn p" id="acc_save">Save profile</button>'
            +'<div id="acc_err" class="error"></div>'
          +'</div>'
        +'</div>'

        +'<div class="card" style="margin:0">'
          +'<div class="title">Security</div>'
          +'<div class="muted" style="margin-bottom:10px">Change your password.</div>'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Current password</label>'
          +'<input id="pw_current" type="password" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">New password</label>'
          +'<input id="pw_new" type="password" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<div class="row" style="margin-top:10px;gap:8px">'
            +'<button class="btn" id="pw_save">Update password</button>'
            +'<div id="pw_err" class="error"></div>'
          +'</div>'
        +'</div>'
      +'</div>'
      +'<div class="card" style="margin-top:12px">'
        +'<div class="title">Coming next</div>'
        +'<div class="muted">Company details, payout settings, and permissions can live here later (safe behind login).</div>'
      +'</div>'
    +'</div>';

  // Load user
  try{
    const me = await j('/auth/me');
    const u = (me && me.user) || {};
    $('#acc_name').value = u.name || '';
    $('#acc_email').value = u.email || '';
  }catch(e){
    $('#acc_err').textContent = e.message || String(e);
  }

  $('#acc_save').addEventListener('click', async function(){
    $('#acc_err').textContent = '';
    try{
      const name = $('#acc_name').value.trim();
      const email = $('#acc_email').value.trim();
      const r = await j('/auth/me', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, email })
      });
      if (r && r.ok) alert('Profile updated');
      else throw new Error((r && r.error) || 'Failed to update');
    }catch(e){
      $('#acc_err').textContent = e.message || String(e);
    }
  });

  $('#pw_save').addEventListener('click', async function(){
    $('#pw_err').textContent = '';
    try{
      const currentPassword = $('#pw_current').value;
      const newPassword = $('#pw_new').value;
      if(!currentPassword || !newPassword) throw new Error('Enter both current + new password');

      const r = await j('/auth/change-password', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (r && r.ok){
        alert('Password updated');
        $('#pw_current').value = '';
        $('#pw_new').value = '';
      }else{
        throw new Error((r && r.error) || 'Failed to update password');
      }
    }catch(e){
      $('#pw_err').textContent = e.message || String(e);
    }
  });
}

  // --- ROUTER ---
  function route(){
    try{
      var path = location.pathname.replace(/\\/$/, '');
      console.log('[Admin UI] route', path);
      setActive(path);

      if (path === '/admin/ui' || path === '/admin/ui/home' || path === '/admin/ui/index.html') return home();
      if (path === '/admin/ui/shows/create-ai') return createShowAI();
      if (path === '/admin/ui/shows/create') return createShow();
      if (path === '/admin/ui/shows/current')  return listShows();
      if (path === '/admin/ui/orders')         return orders();
      if (path === '/admin/ui/venues')         return venues();
      if (path === '/admin/ui/analytics')      return analytics();
      if (path === '/admin/ui/audiences')      return audiences();
      if (path === '/admin/ui/email')          return emailPage();
      if (path === '/admin/ui/account')        return account();

      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')){
        var id1 = path.split('/')[4];
        return editShow(id1);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')){
        var id2 = path.split('/')[4];
        return ticketsPage(id2);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')){
        var id3 = path.split('/')[4];
        return seatingPage(id3);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/summary')){
        var id4 = path.split('/')[4];
        return summaryPage(id4);
      }

      return home();
    }catch(err){
      console.error('[Admin UI] route error', err);
      if (main){
        main.innerHTML = '<div class="card"><div class="error">Routing error: '+(err.message||err)+'</div></div>';
      }
    }
  }

  console.log('[Admin UI] initial route()');
  route();
})();
</script>
</body>
</html>`);
  }
);
// --- AI: Extract show details from uploaded assets (docs + image URLs) ---
router.post(
  "/ai/extract-show",
  requireAdminOrOrganiser,
  json({ limit: "60mb" }),
  async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY in environment" });
      }

// Use a model that reliably supports structured outputs + vision
const model = process.env.OPENAI_MODEL_SHOW_EXTRACT || "gpt-4o-mini";

      const body = req.body || {};
            const suggestedMainImageUrl: string | null =
        typeof (body as any).suggestedMainImageUrl === "string" ? (body as any).suggestedMainImageUrl : null;

      const images: Array<{ name?: string; url: string }> = Array.isArray(body.images) ? body.images : [];
      const docs: Array<{ name?: string; type?: string; dataUrl: string }> = Array.isArray(body.docs) ? body.docs : [];

            const eventTypes = [
        "comedy","theatre","music","festival","film","talks","workshop",
        "corporate","nightlife","sport","food","community","arts","other"
      ];

      // Must match the <option value="..."> values in your admin UI select
      const categories = [
        "rock","classical","jazz",
        "standup","improv",
        "theatre","dance",
        "football","running",
        "tech","business",
        "show","activity",
        "festival","tasting",
        "play_drama","panto","musical","opera","cabaret",
        "comedy_festival","music_festival","arts_festival","food_festival",
        "cinema_screening","premiere","q_and_a",
        "live_podcast","panel","talk","book_event",
        "corporate_night","private_party","awards","fundraiser",
        "club_night","tour_show","new_material","edinburgh_preview","tv_warmup","roast_battle",
        "misc"
      ];

      const content: any[] = [];

      content.push({
        type: "input_text",
               text:
          "You are extracting event/show details for a UK ticketing admin UI.\n" +
          "Use ONLY the provided documents + images. If unknown, set null/empty values and list what is missing.\n" +
          "If a document contains a full event description, copy it EXACTLY (word-for-word) into descriptionHtml as multi-paragraph <p>...</p> HTML.\n" +
"Only generate a new event description if no suitable description exists in the docs.\n" +
"If generating, write at least 3 paragraphs (not a single line).\n" +

                 
                 "Return a single JSON object that matches the schema exactly.\n\n" +
          "CRITICAL RULES:\n" +
          "1) TITLE: Prefer the title found in the document(s) exactly as written (punctuation included). Do NOT add hyphens or extra separators unless the source includes them.\n" +
          "   If no clear title is in docs, read the title from the poster image text. If still unknown, propose a sensible title using the available info.\n" +
"2) DESCRIPTION: If a full event description exists in the documents, copy it exactly (do not rewrite).\n" +
"   Only generate a new description if no usable description exists in ANY document.\n" +
"   If you generate it, it MUST be a proper event description in HTML with multiple paragraphs:\n" +
"   - Use 3–6 <p> paragraphs\n" +
"   - Each paragraph should be 1–3 sentences\n" +
"   - No single-line description\n" +
          "3) TYPE + CATEGORY: eventType must be one of: " + eventTypes.join(", ") + ".\n" +
          "   category MUST be one of these exact values (or null): " + categories.join(", ") + ".\n" +
          "   Example: stand-up comedy => eventType='comedy' and category='standup'.\n" +
"4) IMAGES: Choose the main poster image from the provided images (prefer closest to 3:2 landscape and likely main artwork). Put the rest in additionalImageUrls.\n" +
          "5) TAGS: Return exactly 10 tags. If fewer are explicitly present, infer the remaining tags from the event and venue context.\n" +
          "6) Dates/times: output ISO 8601 for startDateTime/endDateTime. If local UK time and no timezone stated, assume Europe/London.\n" +
          "   doorsOpenTime: HH:MM 24h.\n"

      });

            if (images.length) {
        content.push({
          type: "input_text",
          text:
            "Image candidates (name → url):\n" +
            images.map((x: any) => {
              const bits = [
                `- ${x.name || "image"} → ${x.url}`,
                x.width && x.height ? `(${x.width}x${x.height})` : "",
                typeof x.ratio === "number" ? `ratio=${x.ratio.toFixed(3)}` : "",
                x.likelyPoster ? "[likely poster]" : "",
                x.likelySquare ? "[likely square]" : "",
                x.likelyBanner ? "[likely banner]" : ""
              ].filter(Boolean);
              return bits.join(" ");
            }).join("\n") +
            (suggestedMainImageUrl ? ("\n\nSuggested main poster (closest 2:3): " + suggestedMainImageUrl) : "")
        });
      }


      function parseDataUrl(dataUrl: string){
  const m = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1] || "", b64: m[2] || "" };
}

async function docToText(name: string, type: string, dataUrl: string){
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return "";

  const buf = Buffer.from(parsed.b64, "base64");
  const mime = (parsed.mime || type || "").toLowerCase();
  const lowerName = String(name || "").toLowerCase();

   // NOTE: backend runs as ESM ("type":"module") on Railway, so `require` is not available.
  // Use dynamic import for these CommonJS deps.
  const mammothMod: any = await import("mammoth");
  const mammoth: any = (mammothMod?.default || mammothMod);

  const pdfParseMod: any = await import("pdf-parse");
  const pdfParse: any = (pdfParseMod?.default || pdfParseMod);


  // DOCX
  if (mime.includes("wordprocessingml.document") || lowerName.endsWith(".docx")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out && out.value) ? String(out.value) : "";
  }

  // PDF
  if (mime.includes("pdf") || lowerName.endsWith(".pdf")) {
    const out = await pdfParse(buf);
    return (out && out.text) ? String(out.text) : "";
  }

  // TXT/MD/other – treat as utf8 text
  return buf.toString("utf8");
}

const docTexts: Array<{ name: string; text: string }> = [];

// Turn all docs into plain text and feed as input_text

for (const d of docs) {
  if (!d || !d.dataUrl) continue;
  try{
    const text = await docToText(d.name || "document", d.type || "", d.dataUrl);
    const cleaned = String(text || "").trim();
    if (!cleaned) continue;

    // Keep it bounded so a huge PDF can’t explode tokens
    const clipped = cleaned.slice(0, 20000);

    // ✅ store for deterministic overrides later
    docTexts.push({ name: d.name || "document", text: clipped });

    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n${clipped}`
    });
   }catch(e:any){
    console.error(
      "[AI Extract] doc parse failed",
      {
        name: d?.name,
        type: d?.type,
        err: e?.message || String(e),
        stack: e?.stack
      }
    );

    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n[Could not parse this file on server]`
    });
  }

}


      function pickBestDocText(docTexts: Array<{name:string; text:string}>){
  if (!docTexts.length) return null;
  // deterministic: pick the longest non-empty text
  const sorted = [...docTexts].sort((a,b) => (b.text.length || 0) - (a.text.length || 0));
  return sorted[0] || null;
}

function extractTitleFromText(text: string){
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // Prefer “Title:” style
  for (const l of lines.slice(0, 30)){
    const m = l.match(/^(title|event)\s*:\s*(.+)$/i);
    if (m && m[2] && m[2].trim().length <= 120) return m[2].trim();
  }

  // Otherwise first meaningful line that looks title-ish
  for (const l of lines.slice(0, 30)){
    if (l.length < 4) continue;
    if (l.length > 120) continue;
        if (/^as seen on/i.test(l)) continue;
    if (/^get ready/i.test(l)) continue;
    if (/^join us/i.test(l)) continue;
    if (/^featuring/i.test(l)) continue;
    if (/^this is /i.test(l)) continue;
    if (/^expect /i.test(l)) continue;
    return l;

  }
  return null;
}

    

function escapeHtml(s: string){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function textToExactHtml(text: string){
  // preserve words exactly; keep line breaks
  const safe = escapeHtml(text);
  const parts = safe.split(/\n{2,}/).map(p => p.replace(/\n/g, "<br>"));
  return parts.map(p => `<p>${p}</p>`).join("");
}

function extractEventDescriptionFromText(raw: string): string | null {
  const text = String(raw || "").replace(/\r/g, "");
  if (!text.trim()) return null;

  const lines = text.split("\n");

  // 1) Try heading-based extraction: "Description", "Event Description", etc.
  const headingRe = /^\s*(event\s*)?description\s*:?\s*$/i;
  const inlineRe = /^\s*(event\s*)?description\s*:\s*(.+)\s*$/i;

  const stopHeadingRe = /^\s*(date|time|doors|venue|location|address|tickets?|price|prices|running\s*time|duration|age|accessibility|tags|keywords|contact|terms)\b/i;

  const candidates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || "").trim();
    if (!line) continue;

    const inline = line.match(inlineRe);
    if (inline && inline[2] && inline[2].trim().length > 40) {
      // start with inline text, then keep collecting until a stop heading
      const out: string[] = [inline[2].trim()];
      for (let j = i + 1; j < lines.length; j++) {
        const l = (lines[j] || "").trim();
        if (!l) { out.push(""); continue; }
        if (stopHeadingRe.test(l)) break;
        out.push(l);
      }
      const joined = out.join("\n").trim();
      if (joined.length >= 60) candidates.push(joined);
      continue;
    }

    if (headingRe.test(line)) {
      const out: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = (lines[j] || "").trim();

        // allow blank lines (paragraph breaks)
        if (!l) { out.push(""); continue; }

        // stop if we hit another obvious section
        if (stopHeadingRe.test(l)) break;

        // also stop if we hit a very "heading-ish" short line after we’ve started
        if (out.length > 0 && l.length < 35 && /^[A-Z0-9 .,'"&()\-\/]+$/.test(l)) break;

        out.push(l);
      }

      const joined = out.join("\n").trim();
      if (joined.length >= 120) candidates.push(joined);
    }
  }

  // 2) If no heading found, try paragraph heuristic: pick the longest paragraph with multiple sentences
  if (!candidates.length) {
    const paras = text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    const scored = paras
      .map(p => {
        const sentenceCount = (p.match(/[.!?](\s|$)/g) || []).length;
        const looksLikeTable = /\t|\s{3,}\S+\s{3,}/.test(p);
        const score =
          (p.length || 0) +
          (sentenceCount >= 2 ? 250 : 0) -
          (looksLikeTable ? 300 : 0);
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.p;
    if (best && best.length >= 80) candidates.push(best);
  }

  if (!candidates.length) return null;

  // Return the longest candidate (most likely the full description)
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function pickBestEventDescriptionFromDocs(docTexts: Array<{ name: string; text: string }>) {
  const found: Array<{ name: string; text: string }> = [];

  for (const d of docTexts || []) {
    const desc = extractEventDescriptionFromText(d.text);
    if (desc) found.push({ name: d.name, text: desc });
  }

  if (!found.length) return null;
  found.sort((a, b) => (b.text.length || 0) - (a.text.length || 0));
  return found[0];
}

function stripHtml(html: string) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function needsLongerDescription(html: string) {
  const t = stripHtml(html);
  const pCount = (String(html || "").match(/<p\b/gi) || []).length;
  return (t.length < 220) || (pCount < 2);
}

async function generateMultiParagraphDescriptionHtml(
  info: {
    title?: string;
    venueName?: string;
    venueAddress?: string;
    startDateTime?: string | null;
    endDateTime?: string | null;
    doorsOpenTime?: string | null;
    ageGuidance?: string | null;
    eventType?: string | null;
    category?: string | null;
    tags?: string[];
  },
  cfg: { apiKey: string; model: string }
): Promise<string> {
  const prompt =
    "Write a proper UK event description in HTML.\n" +
    "Rules:\n" +
    "- Use 3–6 <p> paragraphs\n" +
    "- 1–3 sentences per paragraph\n" +
    "- Do NOT invent facts (only use the provided details)\n" +
    "- Keep it engaging and clear\n\n" +
    "Event details:\n" +
    `Title: ${info.title || ""}\n` +
    `Venue: ${info.venueName || ""}\n` +
    `Address: ${info.venueAddress || ""}\n` +
    `Start: ${info.startDateTime || ""}\n` +
    `End: ${info.endDateTime || ""}\n` +
    `Doors: ${info.doorsOpenTime || ""}\n` +
    `Age: ${info.ageGuidance || ""}\n` +
    `Type: ${info.eventType || ""}\n` +
    `Category: ${info.category || ""}\n` +
    `Tags: ${(info.tags || []).join(", ")}\n`;

  const openaiReq2: any = {
    model: cfg.model,
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    max_output_tokens: 900
  };

  const r2 = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(openaiReq2)
  });

  const raw2 = await r2.text();
  if (!r2.ok) throw new Error("OpenAI description repair failed: " + raw2);

  const data2 = raw2 ? JSON.parse(raw2) : {};
  const html = (typeof data2.output_text === "string" ? data2.output_text : "").trim();

  // Last safety: if model ignored HTML, wrap as paragraphs
  if (!html.includes("<p")) {
    const safe = escapeHtml(html);
    return safe
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p}</p>`)
      .join("");
  }

  return html;
}



      // Attach images as vision inputs (URLs)
      for (const img of images) {
        if (!img || !img.url) continue;
        content.push({
          type: "input_image",
          image_url: img.url
        });
      }

      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          startDateTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          endDateTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          doorsOpenTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          venueName: { type: "string" },
          venueAddress: { type: "string" },

          eventType: {
            anyOf: [
              { type: "string", enum: eventTypes },
              { type: "null" }
            ]
          },
          category: {
            anyOf: [
              { type: "string", enum: categories },
              { type: "null" }
            ]
          },

          ageGuidance: { anyOf: [{ type: "string" }, { type: "null" }] },

          accessibility: {
            type: "object",
            additionalProperties: false,
            properties: {
              wheelchair: { type: "boolean" },
              stepFree: { type: "boolean" },
              hearingLoop: { type: "boolean" },
              accessibleToilet: { type: "boolean" },
              notes: { type: "string" }
            },
            required: ["wheelchair", "stepFree", "hearingLoop", "accessibleToilet", "notes"]
          },

                   tags: {
  type: "array",
  items: { type: "string" },
  minItems: 10,
  maxItems: 10
},



          descriptionHtml: { type: "string" },

          mainImageUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
          additionalImageUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 10
          },

          confidence: { type: "number", minimum: 0, maximum: 1 },
          missing: { type: "array", items: { type: "string" } }
        },
        required: [
          "title",
          "startDateTime",
          "endDateTime",
          "doorsOpenTime",
          "venueName",
          "venueAddress",
          "eventType",
          "category",
          "ageGuidance",
          "accessibility",
          "tags",
          "descriptionHtml",
          "mainImageUrl",
          "additionalImageUrls",
          "confidence",
          "missing"
        ]
      };

      const openaiReq = {
        model,
        input: [{ role: "user", content }],

        text: {
          format: {
            type: "json_schema",
            name: "show_draft",
            strict: true,
            schema
          }
        },
max_output_tokens: 2000
      };

      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(openaiReq)
      });

      const raw = await r.text();
      if (!r.ok) {
        return res.status(500).json({ ok: false, error: "OpenAI request failed", detail: raw });
      }

      const data = raw ? JSON.parse(raw) : {};

// Helpers because Responses content blocks aren’t always plain strings
function readText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val?.value === "string") return val.value; // common shape
  if (typeof val?.text === "string") return val.text;
  return "";
}

const outText = (() => {
  // SDK convenience field sometimes exists, sometimes not
  if (typeof (data as any).output_text === "string") {
    const s = (data as any).output_text.trim();
    if (s) return s;
  }

  // Raw Responses format: output[] can include multiple items (reasoning, message, etc.)
  if (Array.isArray((data as any).output)) {
    const parts: string[] = [];

    for (const item of (data as any).output) {
      if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;

      for (const c of item.content) {
        if (!c) continue;

        // Normal text blocks
        if (c.type === "output_text" || c.type === "text") {
          const s = readText(c.text);
          if (s) parts.push(s);
          continue;
        }

        // Some variants can return JSON directly
        if ((c.type === "output_json" || c.type === "json") && c.json) {
          parts.push(JSON.stringify(c.json));
          continue;
        }

        // Last-ditch: if a text-ish field exists
        const fallback = readText(c.text);
        if (fallback) parts.push(fallback);
      }
    }

    return parts.join("\n").trim();
  }

  return "";
})();

// If still empty, return useful diagnostics (so you can see what came back)
if (!outText) {
  const outputTypes = Array.isArray((data as any).output)
    ? (data as any).output.map((o: any) => o?.type).filter(Boolean)
    : [];

  return res.status(500).json({
    ok: false,
    error: "Model returned empty output_text",
    hint: "The response contained no message text blocks we could parse. Inspect status/incomplete_details/outputTypes.",
    status: (data as any).status,
    incomplete_details: (data as any).incomplete_details,
    error_obj: (data as any).error,
    outputTypes,
    rawKeys: Object.keys(data || {})
  });
}


      let draft: any = null;
      try {
        draft = JSON.parse(outText);
      } catch {
        return res.status(500).json({ ok: false, error: "Failed to parse model JSON", outText });
      }

    // --- Prefer title from docs (deterministic) ---
const bestForTitle = pickBestDocText(docTexts);
if (bestForTitle && bestForTitle.text) {
  const exactTitle = extractTitleFromText(bestForTitle.text);
  if (exactTitle) draft.title = exactTitle;
}

// --- Prefer EVENT DESCRIPTION from docs if it exists (not the whole doc) ---
const bestDesc = pickBestEventDescriptionFromDocs(docTexts);
if (bestDesc && bestDesc.text) {
  draft.descriptionHtml = textToExactHtml(bestDesc.text);
} else {
  // If the model generated something too short / one-liner, force a proper multi-paragraph description.
  if (needsLongerDescription(draft.descriptionHtml)) {
    draft.descriptionHtml = await generateMultiParagraphDescriptionHtml({
      title: draft.title,
      venueName: draft.venueName,
      venueAddress: draft.venueAddress,
      startDateTime: draft.startDateTime,
      endDateTime: draft.endDateTime,
      doorsOpenTime: draft.doorsOpenTime,
      ageGuidance: draft.ageGuidance,
      eventType: draft.eventType,
      category: draft.category,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
    }, { apiKey, model });
  }
}

      // --- Prefer doc-provided event description (verbatim) over AI-generated copy ---
const _escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const _bestDocText = (() => {
   const cleaned = (docTexts || [])
    .map((t) => (t?.text ?? "").trim())
    .filter(Boolean);
  cleaned.sort((a, b) => b.length - a.length);
  return cleaned[0] || "";
})();

const _docParas = _bestDocText
  .replace(/\r/g, "")
  .split(/\n{2,}|\n/)
  .map((s: string) => s.trim())
  .filter(Boolean);

let _usedDocDescription = false;

if (_docParas.length >= 2) {
  const maybeTitle = _docParas[0];
  const rest = _docParas.slice(1);

  // Heuristic: first line is a title if it's reasonably short and not obviously a sentence.
  const titleLooksLikeTitle = maybeTitle.length <= 140 && !/[.!?]$/.test(maybeTitle);

  const descParas = titleLooksLikeTitle ? rest : _docParas;
  const descCharCount = descParas.join(" ").replace(/\s+/g, " ").trim().length;

  // Only treat as a real “event description” if it’s got enough substance
  if (descParas.length >= 2 && descCharCount >= 80) {
    // Use DOCX/PDF text exactly, only wrapping in <p> blocks.
    draft.descriptionHtml = descParas.map((p: string) => `<p>${_escapeHtml(p)}</p>`).join("");
    
    // Only set title from doc if title is currently missing/empty
    if (titleLooksLikeTitle && (!draft.title || String(draft.title).trim().length < 3)) {
      draft.title = maybeTitle;
    }

    _usedDocDescription = true;
  }
}

// If we DIDN'T use the doc description, ensure AI output isn't a single-line blob.
// (No rewriting, just paragraph breaks.)
if (!_usedDocDescription && typeof draft.descriptionHtml === "string") {
  const plain = draft.descriptionHtml
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .trim();

  const blocks = plain.split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean);
  
  if (blocks.length < 2 && plain.length > 0) {
    const sentences = plain.split(/([.!?])\s+/).filter(Boolean);
    // Rebuild sentences without changing words (just grouping)
    const rebuilt: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      const next = sentences[i + 1];
      if (next && (next === "." || next === "!" || next === "?")) {
        rebuilt.push((part + next).trim());
        i++;
      } else {
        rebuilt.push(part.trim());
      }
    }

    if (rebuilt.length >= 3) {
      const third = Math.ceil(rebuilt.length / 3);
      const a = rebuilt.slice(0, third).join(" ");
      const b = rebuilt.slice(third, third * 2).join(" ");
      const c = rebuilt.slice(third * 2).join(" ");
      draft.descriptionHtml = [a, b, c].filter(Boolean).map(p => `<p>${_escapeHtml(p)}</p>`).join("");
    }
  }
}

(draft as any)._debug = (draft as any)._debug || {};
(draft as any)._debug.docDescriptionUsed = _usedDocDescription;
(draft as any)._debug.bestDocChars = _bestDocText.length;
(draft as any)._debug.docCount = Array.isArray(docTexts) ? docTexts.length : 0;


      return res.json({ ok: true, draft });

    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

export default router;
