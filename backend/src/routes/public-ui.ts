// backend/src/routes/public-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * PUBLIC LISTING: /public/events
 * - Client-side fetches /events (your existing JSON)
 * - Filters: q, from, to, venue
 * - Mobile-friendly cards
 */
router.get('/events', async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Comedy Shows — Chuckl</title>
  <meta name="description" content="Find and book tickets to stand-up comedy shows powered by our platform."/>
  <style>
    :root{
      --bg:#0b0c10; --panel:#111317; --muted:#98a2b3; --ink:#f8fafc; --accent:#38bdf8; --card:#141821; --bd:#1f2530;
    }
    *{box-sizing:border-box} html,body{margin:0;padding:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:var(--bg);color:var(--ink)}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:1100px;margin:0 auto;padding:20px}
    header{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:16px}
    .brand{font-weight:800;letter-spacing:.2px}
    .grid{display:grid;gap:14px;grid-template-columns:repeat(12,1fr)}
    .card{grid-column:span 12;background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px}
    @media(min-width:720px){ .card{grid-column:span 6} }
    @media(min-width:1000px){ .card{grid-column:span 4} }
    .title{font-weight:700}
    .muted{color:var(--muted)}
    .row{display:flex;gap:10px;flex-wrap:wrap}
    input,select,button{background:#0e1116;color:var(--ink);border:1px solid var(--bd);border-radius:10px;padding:10px 12px}
    button{cursor:pointer}
    button:hover{border-color:#2a3342}
    .pill{display:inline-block;padding:6px 10px;border:1px solid var(--bd);border-radius:999px;color:var(--muted);font-size:12px}
    .right{margin-left:auto}
    .cta{background:var(--accent);border-color:var(--accent);color:#001019;font-weight:700}
    .cta:hover{filter:brightness(1.05)}
    .footer{margin:28px 0 10px;color:var(--muted);font-size:12px}
    .empty{padding:20px;border:1px dashed var(--bd);border-radius:12px;text-align:center;color:var(--muted)}
    .hero{background:linear-gradient(90deg,#0f172a,#111827 50%,#0b0f1a);border:1px solid var(--bd);border-radius:16px;padding:16px;margin-bottom:14px}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="row" style="gap:8px">
        <div class="brand">🎟️ Chuckl Tickets</div>
        <span class="pill">Beta</span>
      </div>
      <nav class="row">
        <a href="/public/events" class="pill">All Events</a>
      </nav>
    </header>

    <section class="hero">
      <div class="row" style="align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div class="title">Find a great night of stand-up</div>
          <div class="muted">Browse upcoming comedy shows and grab your seats.</div>
        </div>
        <a class="pill" href="#filters">Jump to filters ↓</a>
      </div>
    </section>

    <section id="filters" class="row" style="gap:8px;margin-bottom:12px">
      <input id="q" placeholder="Search by title, town or venue"/>
      <input id="from" type="date"/>
      <input id="to" type="date"/>
      <input id="venue" placeholder="Venue (optional)"/>
      <button id="apply">Search</button>
      <button id="reset">Reset</button>
      <span class="right muted" id="count">—</span>
    </section>

    <section id="list" class="grid"></section>

    <div class="footer">Powered by Chuckl Ticketing Platform</div>
  </div>

<script>
(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const fmtDate = (iso)=> {
    try{ const d = new Date(iso); return d.toLocaleString(); }catch{ return ''; }
  };
  const qs = new URLSearchParams(location.search);

  // Prefill filters from querystring
  $('#q').value = qs.get('q') || '';
  $('#from').value = qs.get('from') || '';
  $('#to').value = qs.get('to') || '';
  $('#venue').value = qs.get('venue') || '';

  function buildQS(){
    const p = new URLSearchParams();
    const q = $('#q').value.trim();
    const f = $('#from').value;
    const t = $('#to').value;
    const v = $('#venue').value.trim();
    if(q) p.set('q', q);
    if(f) p.set('from', f);
    if(t) p.set('to', t);
    if(v) p.set('venue', v);
    return p.toString();
  }

  async function load(){
    const list = $('#list');
    list.innerHTML = '<div class="card"><div class="muted">Loading…</div></div>';
    try{
      const qs = buildQS();
      const url = '/events' + (qs ? ('?'+qs) : '');
      const r = await fetch(url);
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();

      const items = (j.items || j || []); // be tolerant of shape
      $('#count').textContent = items.length + ' result' + (items.length===1?'':'s');

      if(!items.length){
        list.innerHTML = '<div class="empty">No events found. Try widening the dates or clearing the search.</div>';
        return;
      }

      list.innerHTML = items.map(it => {
        const title = it.title || (it.show && it.show.title) || 'Untitled show';
        const date = fmtDate(it.date || (it.show && it.show.date));
        const venue = (it.venue && it.venue.name) || (it.show && it.show.venue && it.show.venue.name) || '';
        const city = (it.venue && it.venue.city) || (it.show && it.show.venue && it.show.venue.city) || '';
        const showId = it.id || (it.show && it.show.id) || '';
        return \`
          <article class="card">
            <div class="title">\${title}</div>
            <div class="muted">\${date}\${venue? ' · ' + venue : ''}\${city? ' · ' + city : ''}</div>
            <div class="row" style="margin-top:10px">
              <a class="pill" href="/public/event/\${encodeURIComponent(showId)}">Details</a>
              <a class="cta pill" href="/checkout?showId=\${encodeURIComponent(showId)}">Book tickets</a>
            </div>
          </article>\`;
      }).join('');
    }catch(e){
      list.innerHTML = '<div class="empty">Sorry, something went wrong loading events.</div>';
    }
  }

  $('#apply').addEventListener('click', () => {
    const q = buildQS();
    const next = '/public/events' + (q?('?'+q):'');
    history.pushState(null,'',next);
    load();
  });
  $('#reset').addEventListener('click', () => {
    $('#q').value=''; $('#from').value=''; $('#to').value=''; $('#venue').value='';
    history.pushState(null,'','/public/events');
    load();
  });

  window.addEventListener('popstate', load);
  load();
})();
</script>
</body>
</html>`);
});

/**
 * PUBLIC DETAIL: /public/event/:id
 * - Fetches /events/:id (expected to exist) and renders details + CTA
 */
router.get('/event/:id', async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Event — Chuckl</title>
  <style>
    :root{ --bg:#0b0c10; --panel:#111317; --muted:#98a2b3; --ink:#f8fafc; --accent:#38bdf8; --bd:#1f2530; }
    html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    .wrap{max-width:900px;margin:0 auto;padding:20px}
    .card{background:#141821;border:1px solid var(--bd);border-radius:14px;padding:16px}
    .muted{color:var(--muted)}
    .row{display:flex;gap:10px;flex-wrap:wrap}
    .pill{display:inline-block;padding:10px 14px;border:1px solid var(--bd);border-radius:999px;color:var(--ink)}
    .cta{background:var(--accent);border-color:var(--accent);color:#001019;font-weight:800}
    a{text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div style="margin-bottom:12px"><a class="pill" href="/public/events">← Back to all events</a></div>
    <section id="view" class="card">Loading…</section>
  </div>

<script>
(async function(){
  const $ = s=>document.querySelector(s);
  const id = location.pathname.split('/').pop();

  const fmtDate = (iso)=>{ try{ return new Date(iso).toLocaleString(); }catch{ return ''; } };

  try{
    const r = await fetch('/events/' + encodeURIComponent(id));
    if(!r.ok) throw new Error('HTTP '+r.status);
    const it = await r.json();

    // normalise
    const title = it.title || (it.show && it.show.title) || 'Untitled show';
    const date = fmtDate(it.date || (it.show && it.show.date));
    const venue = (it.venue && it.venue.name) || (it.show && it.show.venue && it.show.venue.name) || '';
    const address = (it.venue && it.venue.address) || (it.show && it.show.venue && it.show.venue.address) || '';
    const city = (it.venue && it.venue.city) || (it.show && it.show.venue && it.show.venue.city) || '';
    const postcode = (it.venue && it.venue.postcode) || (it.show && it.show.venue && it.show.venue.postcode) || '';

    $('#view').innerHTML = \`
      <h1 style="margin:0 0 6px">\${title}</h1>
      <div class="muted">\${date}</div>
      <div class="muted" style="margin-bottom:10px">\${venue}\${city?' · '+city:''}\${postcode?' · '+postcode:''}</div>

      <div style="margin:10px 0 16px">
        <a class="cta pill" href="/checkout?showId=\${encodeURIComponent(id)}">Select seats / Book now</a>
      </div>

      \${it.description ? ('<p>'+it.description+'</p>') : '<p class="muted">Event details coming soon.</p>'}

      <div style="margin-top:14px">
        <span class="muted">Share:</span>
        <a class="pill" href="https://www.facebook.com/sharer/sharer.php?u='\${encodeURIComponent(location.href)}" target="_blank" rel="noopener">Facebook</a>
        <a class="pill" href="https://twitter.com/intent/tweet?url=\${encodeURIComponent(location.href)}&text=\${encodeURIComponent(title)}" target="_blank" rel="noopener">X/Twitter</a>
      </div>
    \`;
  }catch(e){
    $('#view').innerHTML = '<div class="muted">Sorry, that event could not be found.</div>';
  }
})();
</script>
</body>
</html>`);
});

export default router;
