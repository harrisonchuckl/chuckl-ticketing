// backend/src/routes/public-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * Public HTML UI:
 *  - /public/events         (listing with search, city, month, pagination)
 *  - /public/event/:id      (details with Add to Calendar and Book CTA)
 */
router.get(['/events', '/event/:id'], async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Events • Chuckl Ticketing</title>
  <style>
    :root{
      --bg:#0b1020; --panel:#0f1630; --muted:#94a3b8; --text:#e2e8f0; --brand:#60a5fa; --border:#1e293b;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    a{color:#a5b4fc;text-decoration:none}
    a:hover{text-decoration:underline}
    .wrap{max-width:1024px;margin:0 auto;padding:20px}
    header{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px}
    h1{margin:0;font-size:20px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    input,select,button{border:1px solid var(--border);background:#0b1228;color:var(--text);border-radius:8px;padding:8px 10px}
    .btn{cursor:pointer}
    .grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:12px}
    @media(min-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
    .item{border:1px solid var(--border);border-radius:12px;padding:12px;background:#0b1126}
    .title{font-weight:700}
    .muted{color:var(--muted)}
    .right{margin-left:auto}
    .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#12203d;color:#c7d2fe;font-size:12px}
    .pagination{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:10px}
    .cal{display:inline-block;margin-left:8px}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Events</h1>
    <a href="/admin/ui">Organiser login</a>
  </header>

  <div class="card">
    <form id="filters" class="row">
      <input type="search" id="q" placeholder="Search by title, venue, city…" />
      <select id="city"><option value="">All locations</option></select>
      <input type="month" id="month" />
      <select id="order">
        <option value="asc">Soonest first</option>
        <option value="desc">Latest first</option>
      </select>
      <button class="btn" type="submit">Apply</button>
      <button class="btn" type="button" id="reset">Reset</button>
      <span class="right muted" id="meta"></span>
    </form>
  </div>

  <div id="list" class="grid"></div>
  <div class="pagination" id="pager"></div>
</div>

<script>
(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const fmtP = p => '£'+(Number(p||0)/100).toFixed(2);
  const fmtDate = iso => new Date(iso).toLocaleString();

  async function jget(url){
    const r = await fetch(url, {credentials:'include'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  const q=$('#q'), city=$('#city'), month=$('#month'), order=$('#order'), meta=$('#meta');
  const list=$('#list'), pager=$('#pager');

  function qs(){
    const u = new URLSearchParams();
    if(q.value.trim()) u.set('q', q.value.trim());
    if(city.value) u.set('city', city.value);
    if(month.value) u.set('month', month.value);
    if(order.value) u.set('order', order.value);
    u.set('upcoming','1');
    return u.toString();
  }

  function setPager(m){
    pager.innerHTML='';
    if(!m || !m.pages) return;
    const {page, pages} = m;
    const mk = (p,lab,dis=false)=>{
      const b = document.createElement('button');
      b.textContent = lab;
      b.disabled = dis;
      b.className = 'btn';
      b.addEventListener('click', (e)=>{ e.preventDefault(); load(p); });
      return b;
    };
    pager.append(mk(page-1,'Prev', page<=1));
    const span = document.createElement('span');
    span.className='muted';
    span.textContent = 'Page '+page+' of '+pages;
    pager.append(span);
    pager.append(mk(page+1,'Next', page>=pages));
  }

  function setMeta(m){
    if(!m) { meta.textContent=''; return; }
    meta.textContent = (m.total||0)+' results';
  }

  async function load(page=1){
    const base = '/events?'+qs()+'&page='+page+'&pageSize=20';
    const j = await jget(base);
    const items = (j.items||[]);
    list.innerHTML = items.map(it=>{
      const v = it.venue || {};
      const price = (it.ticketTypes && it.ticketTypes[0]) ? 'from '+fmtP(it.ticketTypes[0].pricePence) : '';
      return \`
        <div class="item">
          <div class="title">\${it.title}</div>
          <div class="muted">\${fmtDate(it.date)} • \${v.name||''} \${v.city?('('+v.city+')'):''}</div>
          <div class="row" style="margin-top:8px;align-items:center;gap:8px">
            <span class="pill">\${price}</span>
            <a class="btn" href="/public/event/\${it.id}">Details</a>
            <a class="btn" href="/checkout?showId=\${it.id}">Book</a>
          </div>
        </div>\`;
    }).join('');
    setMeta(j.meta);
    setPager(j.meta);
  }

  async function loadCities(){
    const j = await jget('/events/cities?upcoming=1');
    const opts = (j.cities||[]).map(c=>\`<option>\${c}</option>\`).join('');
    $('#city').insertAdjacentHTML('beforeend', opts);
  }

  $('#filters').addEventListener('submit', (e)=>{ e.preventDefault(); load(1); });
  $('#reset').addEventListener('click', ()=>{ q.value=''; city.value=''; month.value=''; order.value='asc'; load(1); });

  // If this is an event details route, render details view
  const isDetails = location.pathname.startsWith('/public/event/');
  if(isDetails){
    const id = location.pathname.split('/').pop();
    document.title = 'Event • Chuckl Ticketing';
    document.body.innerHTML = \`
      <div class="wrap">
        <header><a href="/public/events">← All events</a></header>
        <div id="detail"></div>
      </div>\`;
    (async ()=>{
      try{
        const j = await jget('/events/'+id);
        if(!j.ok){ document.body.innerHTML = '<div class="wrap"><p>Not found</p></div>'; return; }
        const s = j.show;
        const v = s.venue || {};
        const price = (s.ticketTypes && s.ticketTypes[0]) ? 'from '+fmtP(s.ticketTypes[0].pricePence) : '';
        $('#detail').innerHTML = \`
          <div class="card">
            <div class="title" style="font-size:22px">\${s.title}</div>
            <div class="muted">\${fmtDate(s.date)} • \${v.name||''} \${v.city?('('+v.city+')'):''}</div>
            <p style="margin-top:8px">\${s.description||''}</p>
            <div class="row" style="margin-top:8px;align-items:center">
              <span class="pill">\${price}</span>
              <a class="btn" href="/checkout?showId=\${s.id}">Book Now</a>
              <a class="btn cal" href="/calendar/event/\${s.id}.ics">Add to calendar</a>
            </div>
          </div>\`;
      }catch(e){
        document.body.innerHTML = '<div class="wrap"><p>Failed to load event</p></div>';
      }
    })();
  } else {
    // Listing view
    loadCities().then(()=>load(1)).catch(()=>load(1));
  }
})();
</script>
</body>
</html>`);
});

export default router;
