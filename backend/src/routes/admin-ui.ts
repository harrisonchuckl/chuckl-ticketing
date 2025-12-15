// backend/src/routes/admin-ui.ts
import { Router } from "express";
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
  console.log('[Admin UI] booting');
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

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

  function mountVenuePicker(input){
    if (!input) return;
    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var pop = document.createElement('div');
    pop.className = 'pop';
    wrapper.appendChild(pop);

    function close(){ pop.classList.remove('open'); }

    function render(list, q){
      pop.innerHTML = '';
      if (list && list.length){
        list.forEach(function(v){
          var el = document.createElement('div');
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
      if (q && !list.some(function(v){ return (v.name || '').toLowerCase() === q.toLowerCase(); })){
        var add = document.createElement('div');
        add.className = 'opt';
        add.innerHTML = '➕ Create venue “' + q + '”';
        add.addEventListener('click', async function(){
          try{
            var created = await j('/admin/venues', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ name:q })
            });
            if (created && created.ok && created.venue){
              input.value = created.venue.name;
              input.dataset.venueId = created.venue.id;
            }else{
              alert('Failed to create venue');
            }
          }catch(err){
            alert('Create failed: ' + (err.message || err));
          }
          close();
        });
        pop.appendChild(add);
      }
      if (pop.children.length){ pop.classList.add('open'); } else { close(); }
    }

    input.addEventListener('input', async function(){
      input.dataset.venueId = '';
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

 async function createShow(){
  if (!main) return;
  
  // 1. Render the HTML Form
  main.innerHTML =
    '<div class="card" style="padding: 24px;">'
    +'<div class="header" style="margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">'
    +'<div>'
    +'<div class="title" style="font-size: 1.5rem; font-weight: 700;">Create New Event</div>'
    +'<div class="muted">Start setting up your event with core details, categories, and artwork.</div>'
    +'</div>'
    +'</div>'
    
    // Grid Layout
    +'<div class="grid" style="gap: 20px;">'
    
    // COL 1: Details
    +'<div style="flex: 1; padding-right: 20px; border-right: 1px solid var(--border);">'
    +'<div class="grid" style="margin-bottom: 20px;">'
    +'<label>Event Title</label>'
    +'<input id="sh_title" placeholder="e.g. Chuckl. Comedy Club Live" />'
    +'</div>'
    +'<div class="grid" style="margin-bottom: 20px;">'
    +'<label>Date & Time</label>'
    +'<input id="sh_dt" type="datetime-local" />'
    +'</div>'
    +'<div class="grid" style="margin-bottom: 20px;">'
    +'<label>Venue</label>'
    +'<input id="venue_input" placeholder="Start typing a venue…" />'
    +'<div class="tip">Pick an existing venue or create a new one.</div>'
    +'</div>'
    
    // === UPDATED Category Section (Alignment fixed & expanded options) ===
    +'<div class="grid grid-2" style="margin-bottom: 8px; gap: 16px; align-items: start;">'
    // Left Dropdown
    +'<div class="grid">'
    +'<label>Event Type</label>'
    // Added explicit height style for uniformity
    +'<select id="event_type_select" style="height: 40px;">'
    +'<option value="">Select Primary Type</option>'
    +'<option value="music">Music & Concerts</option>'
    +'<option value="comedy">Comedy</option>'
    +'<option value="arts">Arts, Theatre & Culture</option>'
    +'<option value="nightlife">Nightlife & Social</option>'
    +'<option value="sport">Sports & Fitness</option>'
    +'<option value="food">Food & Drink</option>'
    +'<option value="conference">Conference & Business</option>'
    +'<option value="workshop">Classes & Workshops</option>'
    +'<option value="family">Family & Kids</option>'
    +'<option value="community">Community & Charity</option>'
    +'</select>'
    +'</div>'
    // Right Dropdown
    +'<div class="grid">'
    +'<label>Category</label>'
    // Added explicit height style for uniformity
    +'<select id="event_category_select" style="height: 40px;">'
    +'<option value="">Select Sub-Category</option>'
    
    // Music
    +'<option data-parent="music" value="rock_pop">Rock & Pop</option>'
    +'<option data-parent="music" value="hiphop_rnb">Hip-Hop & RnB</option>'
    +'<option data-parent="music" value="electronic">Electronic & Dance</option>'
    +'<option data-parent="music" value="jazz_blues">Jazz & Blues</option>'
    +'<option data-parent="music" value="classical">Classical & Opera</option>'
    +'<option data-parent="music" value="country_folk">Country & Folk</option>'
    +'<option data-parent="music" value="metal_punk">Metal & Punk</option>'
    +'<option data-parent="music" value="world">World Music</option>'
    +'<option data-parent="music" value="tribute">Tribute Act</option>'
    
    // Comedy
    +'<option data-parent="comedy" value="standup">Stand-Up Comedy</option>'
    +'<option data-parent="comedy" value="improv_sketch">Improv & Sketch</option>'
    +'<option data-parent="comedy" value="open_mic">Open Mic</option>'
    +'<option data-parent="comedy" value="panel_show">Panel Show / Podcast Live</option>'
    
    // Arts & Theatre
    +'<option data-parent="arts" value="musical">Musical Theatre</option>'
    +'<option data-parent="arts" value="play">Play / Drama</option>'
    +'<option data-parent="arts" value="dance_ballet">Dance & Ballet</option>'
    +'<option data-parent="arts" value="opera">Opera</option>'
    +'<option data-parent="arts" value="cabaret_variety">Cabaret & Variety</option>'
    +'<option data-parent="arts" value="spoken_word">Poetry & Spoken Word</option>'
    +'<option data-parent="arts" value="exhibition">Museum & Exhibition</option>'

    // Nightlife
    +'<option data-parent="nightlife" value="club_night">Club Night / DJ Set</option>'
    +'<option data-parent="nightlife" value="party">Theme Party</option>'
    +'<option data-parent="nightlife" value="pub_quiz">Pub Quiz / Trivia</option>'
    +'<option data-parent="nightlife" value="dating">Speed Dating / Singles</option>'
    
    // Sport
    +'<option data-parent="sport" value="football">Football / Soccer</option>'
    +'<option data-parent="sport" value="basketball">Basketball</option>'
    +'<option data-parent="sport" value="rugby">Rugby</option>'
    +'<option data-parent="sport" value="combat">Boxing / MMA / Wrestling</option>'
    +'<option data-parent="sport" value="motorsports">Motorsports</option>'
    +'<option data-parent="sport" value="athletics">Running / Athletics</option>'
    +'<option data-parent="sport" value="yoga_fitness">Yoga & Fitness Class</option>'
    
    // Food & Drink
    +'<option data-parent="food" value="festival">Food Festival</option>'
    +'<option data-parent="food" value="tasting">Tasting Event (Wine/Spirit/Beer)</option>'
    +'<option data-parent="food" value="dining_exp">Dining Experience / Supper Club</option>'
    +'<option data-parent="food" value="market">Food Market</option>'

    // Conference & Business
    +'<option data-parent="conference" value="tech_it">Technology & IT</option>'
    +'<option data-parent="conference" value="business_finance">Business & Finance</option>'
    +'<option data-parent="conference" value="marketing">Marketing & Media</option>'
    +'<option data-parent="conference" value="networking">Networking Event</option>'
    +'<option data-parent="conference" value="talk_lecture">Talk / Lecture / Seminar</option>'

    // Workshops
    +'<option data-parent="workshop" value="arts_crafts">Arts & Crafts</option>'
    +'<option data-parent="workshop" value="tech_coding">Tech & Coding</option>'
    +'<option data-parent="workshop" value="food_drink">Cooking & Mixology</option>'
    +'<option data-parent="workshop" value="health_wellness">Health & Wellness</option>'

    // Family
    +'<option data-parent="family" value="kids_show">Children\'s Show / Theatre</option>'
    +'<option data-parent="family" value="family_activity">Family Activity / Workshop</option>'
    +'<option data-parent="family" value="circus">Circus / Magic</option>'
    +'<option data-parent="family" value="attraction">Attraction Entry</option>'

    // Community
    +'<option data-parent="community" value="fundraiser">Fundraiser / Charity</option>'
    +'<option data-parent="community" value="meetup">Social Meetup</option>'
    +'<option data-parent="community" value="religious">Religious / Spiritual</option>'
    +'<option data-parent="community" value="political">Political / Debate</option>'

    +'</select>'
    +'</div>'
    +'</div>'
    // Moved tip outside the grid-2 block so it doesn't affect alignment
    +'<div class="tip" style="margin-bottom: 20px;">The category list will update based on the Event Type selected above.</div>'

    // Description
    +'<div class="grid" style="margin-bottom: 20px;">'
    +'<label>Description (mandatory)</label>'
    + editorToolbarHtml()
    +'<div id="desc" data-editor contenteditable="true" style="min-height:150px; border:1px solid var(--border); border-radius:8px; padding:12px; background: #fff;"></div>'
    +'<div class="muted">Write a compelling description for your attendees.</div>'
    +'</div>'
    +'</div>' // End COL 1

    // COL 2: Images
    +'<div style="flex: 1;">'
    +'<div class="grid" style="margin-bottom: 24px; background: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid var(--border);">'
    +'<label style="font-size: 14px; font-weight: 600;">Main Poster Image (Required)</label>'
    +'<div id="drop_main" class="drop" style="min-height: 120px; border-style: solid; border-color: #94a3b8; background: #fff;"><p style="margin: 0; font-weight: 500;">Drop image here or click to upload</p><p class="muted" style="margin-top: 4px; font-size: 12px;">Recommended: High-resolution, Aspect Ratio 2:3</p></div>'
    +'<input id="file_main" type="file" accept="image/*" style="display:none" />'
    +'<div class="progress" style="margin-top:8px"><div id="bar_main" class="bar"></div></div>'
    +'<img id="prev_main" class="imgprev" alt="Main Poster Preview" style="max-height: 200px; display: none;" />'
    +'</div>'

    +'<div class="grid" style="margin-bottom: 24px;">'
    +'<label style="font-size: 14px; font-weight: 600;">Additional Images (Max 10)</label>'
    +'<div id="additional_images_container" style="display: flex; flex-wrap: wrap; gap: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #ffffff;">'
    +'<div id="drop_add" class="drop" style="width: 100px; height: 100px; padding: 0; line-height: 100px; margin: 0; font-size: 24px; border: 2px dashed #94a3b8; color: #475569;">+</div>'
    +'<input id="file_add" type="file" accept="image/*" multiple style="display:none" />'
    +'<div id="add_previews" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>'
    +'</div>'
    +'<div class="progress" style="margin-top:8px"><div id="bar_add" class="bar"></div></div>'
    +'<div class="tip">Upload photos of the venue, performers, or past events.</div>'
    +'</div>'
    +'<input type="hidden" id="all_image_urls" value="" />'
    +'</div>' // End COL 2

    +'</div>' // End Grid
    +'<div class="row" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); justify-content: flex-end;">'
    +'<button id="save" class="btn p" style="padding: 10px 20px; font-size: 16px;">Save Event Details</button>'
    +'<div id="err" class="error"></div>'
    +'</div>'
    +'</div>';

  bindWysiwyg(main);
  mountVenuePicker($('#venue_input'));

  // 2. Event Handlers & Logic
  const eventTypeSelect = $('#event_type_select');
  const categorySelect = $('#event_category_select');
  
  // Capture category options immediately
  let categoryOptions = [];
  if (categorySelect) {
     categoryOptions = Array.from(categorySelect.querySelectorAll('option[data-parent]'));
  }

  function updateCategoryOptions() {
    if (!eventTypeSelect || !categorySelect) return;
    const selectedType = eventTypeSelect.value;
    // Keep the placeholder as the first option
    categorySelect.innerHTML = '<option value="">Select Sub-Category</option>';
    categoryOptions.forEach(function(option) {
      // Show option if it matches the parent type OR if no parent type is selected yet
      if (option.getAttribute('data-parent') === selectedType || !selectedType) {
        categorySelect.appendChild(option.cloneNode(true));
      }
    });
    categorySelect.value = ''; // Reset selection on type change
  }

  if (eventTypeSelect) {
    eventTypeSelect.addEventListener('change', updateCategoryOptions);
    // Initial call to set up the list based on the default empty selection
    updateCategoryOptions();
  }

  // Helper variables
  var dropMain = $('#drop_main');
  var fileMain = $('#file_main');
  var barMain = $('#bar_main');
  var prevMain = $('#prev_main');
  var dropAdd = $('#drop_add');
  var fileAdd = $('#file_add');
  var barAdd = $('#bar_add');
  var addPreviews = $('#add_previews');
  var allImageUrls = $('#all_image_urls');

  // Helper: Update hidden input for additional images
  function updateAllImageUrls() {
    if (!addPreviews || !allImageUrls) return;
    var urls = [];
    var divs = addPreviews.querySelectorAll('div');
    divs.forEach(function(d){ if(d.dataset.url) urls.push(d.dataset.url); });
    allImageUrls.value = JSON.stringify(urls);
    if (dropAdd) dropAdd.style.display = urls.length >= 10 ? 'none' : 'block';
  }

  // Helper: Upload logic
  async function doUpload(file, barEl, previewEl, isAdditional) {
    $('#err').textContent = '';
    if (barEl) barEl.style.width = '15%';
    try {
      var out = await uploadPoster(file);
      if (isAdditional && addPreviews) {
        var div = document.createElement('div');
        div.style.cssText = 'position:relative;width:100px;height:100px;overflow:hidden;border-radius:6px;';
        div.dataset.url = out.url;
        
        var img = document.createElement('img');
        img.src = out.url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        
        var btn = document.createElement('button');
        btn.textContent = 'x';
        btn.style.cssText = 'position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);font-weight:bold;cursor:pointer;';
        btn.addEventListener('click', function(){
            div.remove();
            updateAllImageUrls();
        });
        
        div.appendChild(img);
        div.appendChild(btn);
        addPreviews.appendChild(div);
        updateAllImageUrls();
      } else if (previewEl) {
        previewEl.src = out.url;
        previewEl.style.display = 'block';
      }
      if (barEl) {
        barEl.style.width = '100%';
        setTimeout(function(){ barEl.style.width='0%'; }, 800);
      }
    } catch(e) {
      if (barEl) barEl.style.width = '0%';
      $('#err').textContent = 'Upload failed: ' + (e.message || e);
    }
  }

  if (dropMain && fileMain) {
    dropMain.addEventListener('click', function(){ fileMain.click(); });
    dropMain.addEventListener('dragover', function(e){ e.preventDefault(); dropMain.classList.add('drag'); });
    dropMain.addEventListener('dragleave', function(){ dropMain.classList.remove('drag'); });
    dropMain.addEventListener('drop', async function(e){
      e.preventDefault(); dropMain.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await doUpload(f, barMain, prevMain, false);
    });
    fileMain.addEventListener('change', async function(){
      var f = fileMain.files && fileMain.files[0];
      if (f) await doUpload(f, barMain, prevMain, false);
    });
  }

  if (dropAdd && fileAdd) {
    dropAdd.addEventListener('click', function(){
      var current = (addPreviews && addPreviews.children.length) || 0;
      if (current < 10) fileAdd.click();
    });
    fileAdd.addEventListener('change', async function(){
      var files = fileAdd.files;
      if (files && files.length) {
        var current = (addPreviews && addPreviews.children.length) || 0;
        var toAdd = Array.from(files).slice(0, 10 - current);
        for (var i=0; i<toAdd.length; i++) {
           await doUpload(toAdd[i], barAdd, null, true);
        }
      }
      fileAdd.value = '';
    });
  }

  $('#save').addEventListener('click', async function(){
    var errEl = $('#err');
    errEl.textContent = '';
    try {
      var title = $('#sh_title').value.trim();
      var dtRaw = $('#sh_dt').value;
      var venueInput = $('#venue_input');
      var venueText = venueInput.value.trim();
      var venueId = venueInput.dataset.venueId || null;
      var imageUrl = prevMain.src || null;
      var descHtml = $('#desc').innerHTML.trim();
      
      var eventType = eventTypeSelect ? eventTypeSelect.value : '';
      var eventCategory = categorySelect ? categorySelect.value : '';
      var additionalImages = [];
      if (allImageUrls && allImageUrls.value) {
         try { additionalImages = JSON.parse(allImageUrls.value); } catch(e){}
      }

      if (!title || !dtRaw || !venueText || !descHtml || !eventType || !eventCategory || !imageUrl) {
        throw new Error('Title, date/time, venue, description, event type, category, and a main image are required.');
      }
      
      var dateIso = new Date(dtRaw).toISOString();
      
      var showRes = await j('/admin/shows', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: title,
          date: dateIso,
          venueText: venueText,
          venueId: venueId,
          imageUrl: imageUrl,
          descriptionHtml: descHtml,
          eventType: eventType,
          eventCategory: eventCategory,
          additionalImages: additionalImages
        })
      });

      if (showRes && showRes.error) throw new Error(showRes.error);
      
      var showId = (showRes && (showRes.id || (showRes.show && showRes.show.id))) || null;
      if (!showId) throw new Error('Failed to create show');
      
      // Redirect to seating choice
      window.location.href = '/admin/seating-choice/' + showId;
    } catch(e) {
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
  function account(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Account</div><div class="muted">Account settings coming soon.</div></div>';
  }

  // --- ROUTER ---
  function route(){
    try{
      var path = location.pathname.replace(/\/$/, '');
      console.log('[Admin UI] route', path);
      setActive(path);

      if (path === '/admin/ui' || path === '/admin/ui/home' || path === '/admin/ui/index.html') return home();
      if (path === '/admin/ui/shows/create')   return createShow();
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

export default router;
