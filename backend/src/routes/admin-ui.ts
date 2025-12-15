// backend/src/routes/admin-ui.ts
import { Router, json } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/**
 * Admin Single Page App (Organiser Console)
 * Served at /admin/ui/*
 */
router.get(
  ["/ui", "/ui/", "/ui/home", "/ui/*"],
  requireAdminOrOrganiser,
    (_req, res) => {
    res.set("Cache-Control", "no-store");

    // If you use helmet CSP globally, it will block this inline <script> and the SPA will never boot.
    // This route is already protected by requireAdminOrOrganiser, so allow inline JS for this admin shell.
    res.set("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https:"
    ].join("; "));

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

.ai-prefill{
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
/* --- Unsaved changes / dirty exit modal --- */
.exit-guard-backdrop{
  position:fixed; inset:0;
  background: rgba(15, 23, 42, 0.45);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding: 24px 14px;
  z-index: 99999;
}
.exit-guard-modal{
  margin-top: 18px;
  width: min(720px, calc(100vw - 28px));
  background:#fff;
  border:1px solid var(--border);
  border-radius:14px;
  box-shadow: 0 20px 70px rgba(0,0,0,0.25);
  overflow:hidden;
}
.exit-guard-head{
  padding: 14px 16px;
  border-bottom:1px solid var(--border);
  display:flex;
  gap:10px;
  align-items:center;
  justify-content:space-between;
}
.exit-guard-head strong{ font-size: 14px; }
.exit-guard-body{
  padding: 14px 16px;
  color:#334155;
  font-size: 13px;
  line-height: 1.45;
}
.exit-guard-actions{
  padding: 14px 16px;
  border-top:1px solid var(--border);
  display:flex;
  gap:10px;
  justify-content:flex-end;
  flex-wrap:wrap;
}
.btn-danger{
  background:#ef4444 !important;
  border:1px solid #ef4444 !important;
  color:#fff !important;
}
.btn-danger:hover{ filter: brightness(0.95); }
.btn-ghost{
  background:#fff !important;
  border:1px solid var(--border) !important;
  color:#111827 !important;
}
.btn-ghost:hover{ background:#f8fafc !important; }

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
      <a class="sb-link" href="/auth/logout">Log out</a>
    </aside>

    <main class="content" id="main">
      <div class="card"><div class="title">Loading…</div></div>
    </main>
  </div>

<script>
(function(){
  console.log('[Admin UI] booting');
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
    // --- AI field highlighting ---
 // --- AI field highlighting (remove only when value actually changes) ---
function aiGetValue(el){
  if (!el) return '';
  if (el.isContentEditable) return (el.innerHTML || '');
  if (typeof el.value !== 'undefined') return String(el.value || '');
  return '';
}

function markAi(el, kind){
  if (!el) return;
  if (kind === 'editor') el.classList.add('ai-gen-editor');
  else if (kind === 'drop') el.classList.add('ai-gen-drop');
  else el.classList.add('ai-gen'); // or 'ai-prefill' if you prefer
  el.dataset.aiGen = '1';
  el.dataset.aiStartValue = aiGetValue(el);
}

function clearAi(el){
  if (!el) return;
  el.classList.remove('ai-gen','ai-gen-editor','ai-gen-drop','ai-prefill');
  delete el.dataset.aiGen;
  delete el.dataset.aiStartValue;
}

function bindAiClearOnUserEdit(el, evts){
  if (!el) return;
  (evts || ['input','change','keyup']).forEach(function(evt){
    el.addEventListener(evt, function(){
      if (el.dataset.aiGen !== '1') return;
      var start = (el.dataset.aiStartValue || '');
      var cur = aiGetValue(el);
      if (cur !== start) clearAi(el);
    }, { passive:true });
  });
}



  var main = $('#main');

function __fatal(label, err){
  try{
    var m = document.getElementById('main');
    if (!m) return;
    var msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    m.innerHTML =
      '<div class="card">'
    +   '<div class="title">Admin UI crashed</div>'
    +   '<div class="error" style="margin-top:8px;white-space:pre-wrap;">'
    +     label + ':\n' + msg
    +   '</div>'
    + '</div>';
  }catch(e){}
}

window.addEventListener('error', function(e){
  __fatal('window.error', e && e.error ? e.error : (e && e.message ? e.message : e));
});

window.addEventListener('unhandledrejection', function(e){
  __fatal('unhandledrejection', e && e.reason ? e.reason : e);
});

// ------------------------------
// Dirty-exit guard (Create Show)
// ------------------------------
var __dirty = {
  enabled: false,
  isDirty: false,
  lastPath: (location.pathname || '').replace(/\/+$/,'') || '/',
  pendingNav: null,        // { type:'view'|'href'|'popstate', target:string }
  saveDraftFn: null
};

function __setDirtyEnabled(on){
  __dirty.enabled = !!on;
  if (!__dirty.enabled){
    __dirty.isDirty = false;
    __dirty.saveDraftFn = null;
    __dirty.pendingNav = null;
  }
}

function __markDirty(){
  if (__dirty.enabled) __dirty.isDirty = true;
}

function __clearDirty(){
  __dirty.isDirty = false;
}

function __toast(msg){
  // Use your existing toast() if present, else fallback
  if (typeof toast === 'function') return toast(msg);
  try { console.log('[Draft]', msg); } catch(e){}
}

function __saveCreateShowDraft(){
  // Grab the common Create Show fields if they exist
  var draft = {
    savedAt: new Date().toISOString(),
    title: $('#sh_title') ? $('#sh_title').value : '',
    start: $('#sh_dt') ? $('#sh_dt').value : '',
    end: $('#sh_dt_end') ? $('#sh_dt_end').value : '',
    venueText: $('#venue_input') ? $('#venue_input').value : '',
    venueId: ($('#venue_input' ) && $('#venue_input').dataset) ? ($('#venue_input').dataset.venueId || '') : '',
    eventType: $('#eventType') ? $('#eventType').value : ( $('#sh_eventType') ? $('#sh_eventType').value : '' ),
    category: $('#category') ? $('#category').value : ( $('#sh_category') ? $('#sh_category').value : '' ),
doorsOpenTime: $('#doors_open_time') ? $('#doors_open_time').value : ( $('#sh_doorsOpenTime') ? $('#sh_doorsOpenTime').value : '' ),
ageGuidance: $('#age_guidance') ? $('#age_guidance').value : ( $('#sh_ageGuidance') ? $('#sh_ageGuidance').value : '' ),

    tags: $('#sh_tags') ? $('#sh_tags').value : ( $('#tags') ? $('#tags').value : '' ),
    accessibilityNote: $('#sh_accessibilityNote') ? $('#sh_accessibilityNote').value : '',
    accessibility: {
      wheelchair: $('#acc_wheelchair') ? !!$('#acc_wheelchair').checked : false,
      stepfree: $('#acc_stepfree') ? !!$('#acc_stepfree').checked : false,
hearingLoop: $('#acc_hearingloop') ? !!$('#acc_hearingloop').checked : false,
      toilet: $('#acc_toilet') ? !!$('#acc_toilet').checked : false
    },
    descriptionHtml: $('#sh_desc') ? $('#sh_desc').innerHTML : ( $('#desc') ? $('#desc').innerHTML : '' ),
    mainImageUrl: $('#sh_mainImageUrl') ? $('#sh_mainImageUrl').value : '',
    additionalImageUrls: (function(){
      var el = $('#sh_additionalImageUrls');
      if (!el) return [];
      try { return JSON.parse(el.value || '[]'); } catch(e){ return []; }
    })()
  };

  localStorage.setItem('tixall_create_show_draft_v1', JSON.stringify(draft));
  __clearDirty();
  __toast('Draft saved.');
}

function __showExitGuard(){
  // Already open?
  if (document.querySelector('.exit-guard-backdrop')) return;

  var backdrop = document.createElement('div');
  backdrop.className = 'exit-guard-backdrop';

  var modal = document.createElement('div');
  modal.className = 'exit-guard-modal';

modal.innerHTML =
  '<div class="exit-guard-head">'
+ '  <strong>Unsaved changes</strong>'
+ '  <span style="font-size:12px;color:#64748b;">Create Show</span>'
+ '</div>'
+ '<div class="exit-guard-body">'
+ '  If you leave this page, <strong>your changes will be lost</strong>.'
+ '  <br><br>'
+ '  Choose <strong>Save draft</strong> if you want to continue later.'
+ '</div>'
+ '<div class="exit-guard-actions">'
+ '  <button class="btn btn-ghost" id="exitGuardStay">Stay on page</button>'
+ '  <button class="btn" id="exitGuardSave">Save draft</button>'
+ '  <button class="btn btn-danger" id="exitGuardExit">Exit without saving</button>'
+ '</div>';


  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close(){
    try { backdrop.remove(); } catch(e){}
  }

  $('#exitGuardStay').addEventListener('click', function(){
    __dirty.pendingNav = null;
    close();
  });

  $('#exitGuardSave').addEventListener('click', function(){
    try { __saveCreateShowDraft(); } catch(e){}
    // After save, proceed with nav (if any)
    var nav = __dirty.pendingNav;
    __dirty.pendingNav = null;
    close();
    if (nav) __performPendingNav(nav);
  });

  $('#exitGuardExit').addEventListener('click', function(){
    __clearDirty();
    var nav = __dirty.pendingNav;
    __dirty.pendingNav = null;
    close();
    if (nav) __performPendingNav(nav);
  });

  // Click outside modal -> stay
  backdrop.addEventListener('click', function(e){
    if (e.target === backdrop){
      __dirty.pendingNav = null;
      close();
    }
  });
}

function __performPendingNav(nav){
  if (!nav) return;
  if (nav.type === 'view'){
    go(nav.target);
    return;
  }
  if (nav.type === 'href'){
    window.location.href = nav.target;
    return;
  }
  if (nav.type === 'popstate'){
    // We stored a path; force SPA nav
    go(nav.target);
    return;
  }
}

// Warn on refresh/close tab as well
window.addEventListener('beforeunload', function(e){
  if (!__dirty.enabled || !__dirty.isDirty) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

// Utility: attach dirty listeners on Create Show pages
function __wireDirtyInputsForCreateShow(){
  if (!__dirty.enabled) return;

  var scope = document.querySelector('#main');
  if (!scope) return;

  // Mark dirty on any typing/changes in main form
  scope.querySelectorAll('input, textarea, select').forEach(function(el){
    el.addEventListener('input', __markDirty);
    el.addEventListener('change', __markDirty);
  });

  // If your description is contenteditable
  var desc = $('#sh_desc') || $('#desc');
  if (desc){
    desc.addEventListener('input', __markDirty);
    desc.addEventListener('keyup', __markDirty);
    desc.addEventListener('blur', __markDirty);
  }
}

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
  routeSafe();
}

  // SPA sidebar links
document.addEventListener('click', function(e){
  var tgt = e.target;
  var a = tgt && tgt.closest ? tgt.closest('a.sb-link') : null;
  if (!a) return;

  var dataView = a.getAttribute('data-view');
  var href = a.getAttribute('href');

  // Determine where this click wants to go
  var nav = null;
  if (dataView) nav = { type:'view', target: dataView };
  else if (href) nav = { type:'href', target: href };

  if (!nav) return;

  // If dirty, block + prompt
  if (__dirty.enabled && __dirty.isDirty){
    e.preventDefault();
    __dirty.pendingNav = nav;
    __showExitGuard();
    return;
  }

  // Not dirty: proceed normally
  if (nav.type === 'view'){
    e.preventDefault();
    go(nav.target);
    return;
  }

  // nav.type === 'href'
  // Let browser navigate
  // (we don't preventDefault here)
});


window.addEventListener('popstate', function(){
  var nextPath = (location.pathname || '').replace(/\/+$/,'') || '/';

  if (__dirty.enabled && __dirty.isDirty){
    // Prevent leaving immediately
    try { history.pushState(null, '', __dirty.lastPath); } catch(e){}

    // Keep UI stable and show the modal
    __dirty.pendingNav = { type:'popstate', target: nextPath };
    __showExitGuard();

    // Re-render the current page safely (so errors show on-screen)
    routeSafe();
    return;
  }

  // Normal behaviour
  __dirty.lastPath = nextPath;
  routeSafe();
});


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

  __wireDirtyInputsForCreateShow();

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

+   '<div class="row" style="margin-top:12px; gap:10px; align-items:center;">'
+     '<button id="ai_analyse" class="btn p">Analyse & Pre-fill</button>'
+     '<div id="ai_status" class="muted" style="font-size:13px;"></div>'
+   '</div>'

+   '<div id="ai_err" class="error" style="margin-top:10px;"></div>'
+   '<div id="ai_result" style="margin-top:14px;"></div>'

+   '<div class="row" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); justify-content: space-between; align-items:center;">'
+     '<label id="ai_approval_wrap" style="display:none; align-items:center; gap:10px; font-size:13px; color:#334155;">'
+       '<input id="ai_approval" type="checkbox" />'
+       'I’ve checked the AI-filled details above (and edited anything needed).'
+     '</label>'
+     '<div class="row" style="gap:10px; align-items:center;">'
+       '<button id="save" class="btn p" style="padding: 10px 20px; font-size: 16px;">Save Event Details and Add Tickets</button>'
+       '<div id="err" class="error"></div>'
+     '</div>'
+   '</div>'

+ '</div>';


  const drop = $('#ai_drop');
  const fileInput = $('#ai_files');
  const list = $('#ai_list');
  const btn = $('#ai_analyse');
  const err = $('#ai_err');
  const status = $('#ai_status');
  const result = $('#ai_result');

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
    const rows = []
      .concat(state.images.map(f => ({
        kind: 'Image', name: f.name, size: f.size, extra: f.url ? 'Uploaded' : 'Pending upload'
      })))
      .concat(state.docs.map(f => ({
        kind: 'Doc', name: f.name, size: f.size, extra: f.dataUrl ? 'Ready' : 'Pending read'
      })));

    if (!rows.length){
      list.innerHTML = '<div class="muted">No files added yet.</div>';
      return;
    }

    list.innerHTML =
      '<div style="border:1px solid var(--border); border-radius:10px; overflow:hidden;">'
    +   '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px; gap:10px; padding:10px 12px; background:#f8fafc; font-weight:600; font-size:12px;">'
    +     '<div>Type</div><div>File</div><div>Size</div><div>Status</div>'
    +   '</div>'
    +   rows.map(r =>
          '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px; gap:10px; padding:10px 12px; border-top:1px solid var(--border); font-size:13px;">'
        +   '<div>'+esc(r.kind)+'</div>'
        +   '<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+esc(r.name)+'</div>'
        +   '<div>'+esc(bytes(r.size))+'</div>'
        +   '<div class="muted">'+esc(r.extra)+'</div>'
        + '</div>'
        ).join('')
    + '</div>';
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
        const target = 2/3;
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
    status.textContent = 'Sending assets to AI…';

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
        +'<div class="row" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); justify-content: flex-end;">'
        +'<button id="save" class="btn p" style="padding: 10px 20px; font-size: 16px;">Save Event Details and Add Tickets</button>'
        +'<div id="err" class="error"></div>'
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
    __wireDirtyInputsForCreateShow();
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
  function account(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Account</div><div class="muted">Account settings coming soon.</div></div>';
  }

  // --- ROUTER ---
 function routeSafe(){
  // Re-grab main each route in case the DOM rendered after script eval, or main reference went stale
  main = document.getElementById('main');
  if (!main) {
    console.error('[Admin UI] routeSafe: #main not found');
    return Promise.resolve();
  }

  return Promise.resolve()
    .then(route)
    .catch(function(err){
      console.error('[Admin UI] route error', err);
      if (main){
        main.innerHTML = '<div class="card"><div class="error">Routing error: '+((err && err.message) || err)+'</div></div>';
      }
    });
}



async function route(){
  var path = location.pathname.replace(/\/$/, '');

console.log('[Admin UI] route', path);
setActive(path);

// --- Dirty guard enable/disable (Create Show only) ---
var cleanPath = (path || '').replace(/\/+$/,'') || '/';

if (cleanPath === '/admin/ui/shows/create' || cleanPath === '/admin/ui/shows/create-ai'){
  __setDirtyEnabled(true);
} else {
  __setDirtyEnabled(false);
}

// Track the last “safe” path for popstate revert
__dirty.lastPath = cleanPath;

// (optional) if you want all route checks to use the cleaned path:
path = cleanPath;


  
  if (path === '/admin/ui/shows/create-ai') return await createShowAI();
  if (path === '/admin/ui/shows/create') return await createShow();
  if (path === '/admin/ui/shows/current') return await listShows();
  if (path === '/admin/ui/orders') return orders();
  if (path === '/admin/ui/venues') return venues();
  if (path === '/admin/ui/analytics') return analytics();
  if (path === '/admin/ui/audiences') return audiences();
  if (path === '/admin/ui/email') return emailPage();
  if (path === '/admin/ui/account') return account();

  if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')){
    var id1 = path.split('/')[4];
    return await editShow(id1);
  }
  if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')){
    var id2 = path.split('/')[4];
    return await ticketsPage(id2);
  }
  if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')){
    var id3 = path.split('/')[4];
    return await seatingPage(id3);
  }
  if (path.startsWith('/admin/ui/shows/') && path.endsWith('/summary')){
    var id4 = path.split('/')[4];
    return await summaryPage(id4);
  }

  return home();
}

console.log('[Admin UI] initial routeSafe()');

// Run immediately (script is at end of <body>, so #main should exist)
routeSafe();

// Also run on DOMContentLoaded just in case
document.addEventListener('DOMContentLoaded', routeSafe);

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

      // --- Deterministic main poster selection (server-side) ---
async function fetchImageMeta(url: string){
  const sharpMod: any = await import("sharp");
  const sharp = sharpMod?.default || sharpMod;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${url} (${resp.status})`);
  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);

  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const ratio = h ? (w / h) : 0;
// We want LANDSCAPE 3:2 (user refers to “2x3 landscape”)
// ratio is w/h, so landscape 3:2 = 1.5
const target = 3/2;
  const diff = Math.abs(ratio - target);
  return { w, h, ratio, diff };
}

function nameScore(name?: string){
  const n = String(name || "").toLowerCase();
  let s = 0;
  if (n.includes("poster") || n.includes("artwork") || n.includes("a3") || n.includes("print") || n.includes("main")) s -= 0.25;
  // Prefer banner/hero/main artwork for the main poster.
// Penalise “square / insta / story” assets.
if (n.includes("banner") || n.includes("header") || n.includes("hero")) s -= 0.35;
if (n.includes("poster") || n.includes("main") || n.includes("artwork")) s -= 0.25;

if (n.includes("sq") || n.includes("square") || n.includes("insta") || n.includes("ig")) s += 0.75;
if (n.includes("story")) s += 0.95;

  return s;
}

function finalScore(meta: {diff:number, w:number, h:number}, name?: string){
  // lower is better
  const px = (meta.w || 0) * (meta.h || 0);
  const resBonus = px > 0 ? (1 / Math.log10(px + 10)) : 1;
  return meta.diff + nameScore(name) + resBonus;
}

async function pickBestMainPosterServer(imgs: Array<{name?: string; url: string}>){
  const candidates = imgs.filter(x => x && x.url);
  if (!candidates.length) return null;

  const scored: Array<{url:string; name?:string; score:number}> = [];
  for (const img of candidates){
    try{
      const meta = await fetchImageMeta(img.url);
      scored.push({ url: img.url, name: img.name, score: finalScore(meta, img.name) });
    }catch{
      // ignore fetch/meta failures
    }
  }
  scored.sort((a,b) => a.score - b.score);
  return scored[0]?.url || null;
}

const forcedMainImageUrl = await pickBestMainPosterServer(images);

      
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
          "Return a single JSON object that matches the schema exactly.\n\n" +
          "CRITICAL RULES:\n" +
          "1) TITLE: Prefer the title found in the document(s) exactly as written (punctuation included). Do NOT add hyphens or extra separators unless the source includes them.\n" +
          "   If no clear title is in docs, read the title from the poster image text. If still unknown, propose a sensible title using the available info.\n" +
          "2) DESCRIPTION: If a full event description exists in the documents, copy it (do not rewrite). Only generate a new description if no usable description exists.\n" +
          "3) TYPE + CATEGORY: eventType must be one of: " + eventTypes.join(", ") + ".\n" +
          "   category MUST be one of these exact values (or null): " + categories.join(", ") + ".\n" +
          "   Example: stand-up comedy => eventType='comedy' and category='standup'.\n" +
"4) IMAGES: The main poster image is PRE-SELECTED by the server and you MUST use it as mainImageUrl. Do not choose a different one.\n" +
(forcedMainImageUrl ? ("   mainImageUrl MUST equal: " + forcedMainImageUrl + "\n") : "") +
"   Put the rest in additionalImageUrls.\n" +
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

  // Lazy requires to avoid TS import/esModuleInterop issues
  const mammoth = require("mammoth");
  const pdfParse = require("pdf-parse");

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
    docTexts.push({ name: d.name || "document", text: cleaned });


    // Keep it bounded so a huge PDF can’t explode tokens
    const clipped = cleaned.slice(0, 20000);

    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n${clipped}`
    });
  }catch(e){
    // Don’t fail the whole request if one doc can’t be parsed
    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n[Could not parse this file on server]`
    });
  }
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

      function stripTitleFromText(full: string, title: string){
  if (!full || !title) return full;
  const lines = full.split(/\r?\n/);
  if (lines.length && lines[0].trim() === title.trim()){
    // remove title line + any immediate blank lines
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
    return lines.join("\n").trim();
  }
  return full.trim();
}

function plainTextToHtml(t: string){
  const esc = (s: string) => s
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
  const safe = esc(t);
  // paragraph split on double newlines, preserve single newlines
  return safe
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g,"<br/>")}</p>`)
    .join("");
}

// Pick the “best doc” (longest text tends to be event copy)
const bestDoc = docTexts.sort((a,b)=>b.text.length-a.text.length)[0] || null;
let docTitle: string | null = null;
let docDescText: string | null = null;

if (bestDoc && bestDoc.text){
  const lines = bestDoc.text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length){
    docTitle = lines[0]; // first heading line
    const remaining = stripTitleFromText(bestDoc.text, docTitle);
    if (remaining && remaining.length > 20) docDescText = remaining;
  }
}

// HARD OVERRIDES:
// If doc title exists → always use it (exact punctuation, no AI rewrite)
if (docTitle){
  draft.title = docTitle;
}

// If doc description exists → always use it verbatim (no AI rewrite)
if (docDescText){
  draft.descriptionHtml = plainTextToHtml(docDescText);
}

    
// Hard override: deterministic main poster always wins
if (forcedMainImageUrl){
  draft.mainImageUrl = forcedMainImageUrl;

  const extra = Array.isArray(draft.additionalImageUrls) ? draft.additionalImageUrls : [];
  const all = [ ...extra, ...(images.map(i => i.url).filter(Boolean)) ];

  // remove main + dedupe + cap 10
  const dedup = Array.from(new Set(all.filter(u => u && u !== forcedMainImageUrl)));
  draft.additionalImageUrls = dedup.slice(0, 10);
}

      draft.aiGenerated = {
  title: !!draft.title,
  startDateTime: !!draft.startDateTime,
  endDateTime: !!draft.endDateTime,
  venueName: !!draft.venueName,
  venueAddress: !!draft.venueAddress,
  eventType: !!draft.eventType,
  category: !!draft.category,
  doorsOpenTime: !!draft.doorsOpenTime,
  ageGuidance: !!draft.ageGuidance,
  descriptionHtml: !!draft.descriptionHtml,
  mainImageUrl: !!draft.mainImageUrl,
  additionalImageUrls: Array.isArray(draft.additionalImageUrls) && draft.additionalImageUrls.length > 0,
  tags: Array.isArray(draft.tags) && draft.tags.length > 0,
  accessibility: !!draft.accessibility
};


return res.json({ ok: true, draft });


    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

export default router;
