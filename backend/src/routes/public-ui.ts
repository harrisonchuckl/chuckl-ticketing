// backend/src/routes/public-ui.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

const BRAND = 'Chuckl Ticketing';
const ORIGIN_META = process.env.PUBLIC_BASE_URL || ''; // optional: set in Railway for absolute OG URLs

// LIST + SSR PAGES
router.get('/events', async (_req, res) => {
  res.type('html').send(listingHTML());
});

router.get('/event/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id },
      include: { venue: true, ticketTypes: { orderBy: { pricePence: 'asc' } } },
    });
    if (!show) return res.status(404).send(notFoundHTML('Event not found'));
    res.type('html').send(eventDetailHTML(show));
  } catch (e) {
    console.error(e);
    res.status(500).send(notFoundHTML('Failed to load event'));
  }
});

router.get('/venue/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) return res.status(404).send(notFoundHTML('Venue not found'));

    const now = new Date();
    const shows = await prisma.show.findMany({
      where: { venueId: id, date: { gte: now } },
      include: { venue: true, ticketTypes: { orderBy: { pricePence: 'asc' } } },
      orderBy: { date: 'asc' },
    });

    res.type('html').send(venueHTML(venue, shows));
  } catch (e) {
    console.error(e);
    res.status(500).send(notFoundHTML('Failed to load venue'));
  }
});

// --------------- HTML TEMPLATES ---------------

function baseHead({ title, desc, image, url }: { title: string; desc?: string; image?: string; url?: string }) {
  const t = escapeHtml(title || BRAND);
  const d = escapeHtml(desc || 'Discover and book stand-up comedy shows across the UK.');
  const i = image ? absUrl(image) : '';
  const u = url ? absUrl(url) : '';
  return `
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${t}</title>
  <meta name="description" content="${d}"/>

  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${t}"/>
  <meta property="og:description" content="${d}"/>
  ${i ? `<meta property="og:image" content="${i}"/>` : ''}
  ${u ? `<meta property="og:url" content="${u}"/>` : ''}

  <meta name="twitter:card" content="${i ? 'summary_large_image' : 'summary'}"/>
  <meta name="twitter:title" content="${t}"/>
  <meta name="twitter:description" content="${d}"/>
  ${i ? `<meta name="twitter:image" content="${i}"/>` : ''}

  <style>
    :root{ --bg:#0b1020; --panel:#0f1630; --muted:#94a3b8; --text:#e2e8f0; --brand:#60a5fa; --border:#1e293b; }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
    a{color:#a5b4fc;text-decoration:none} a:hover{text-decoration:underline}
    .wrap{max-width:1024px;margin:0 auto;padding:20px}
    header{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px}
    h1{margin:0;font-size:20px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    input,select,button{border:1px solid var(--border);background:#0b1228;color:var(--text);border-radius:8px;padding:8px 10px}
    .btn{cursor:pointer}
    .grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:12px}
    @media(min-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
    @media(min-width:980px){.grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
    .item{border:1px solid var(--border);border-radius:12px;padding:12px;background:#0b1126;display:flex;gap:12px}
    .thumb{width:96px; height:128px; flex:0 0 auto; border-radius:8px; overflow:hidden; background:#0e152a; display:flex; align-items:center; justify-content:center}
    .thumb img{width:100%; height:100%; object-fit:cover}
    .title{font-weight:700}
    .muted{color:var(--muted)}
    .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#12203d;color:#c7d2fe;font-size:12px}
    .right{margin-left:auto}
    .pagination{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:10px}
    .poster{width:100%;max-width:640px;border-radius:12px;border:1px solid var(--border)}
    iframe.map{width:100%;height:280px;border:0;border-radius:12px}
  </style>`;
}

function listingHTML() {
  return `<!doctype html>
<html lang="en">
<head>
${baseHead({ title: `Events • ${BRAND}`, desc: 'Find and book comedy shows across the UK.' })}
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
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const fmtP=p=>'£'+(Number(p||0)/100).toFixed(2), fmtDate=iso=>new Date(iso).toLocaleString();

  async function jget(u){ const r=await fetch(u,{credentials:'include'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }

  const q=$('#q'), city=$('#city'), month=$('#month'), order=$('#order'), meta=$('#meta');
  const list=$('#list'), pager=$('#pager');

  function qs(){
    const u=new URLSearchParams();
    if(q.value.trim()) u.set('q',q.value.trim());
    if(city.value) u.set('city',city.value);
    if(month.value) u.set('month',month.value);
    if(order.value) u.set('order',order.value);
    u.set('upcoming','1');
    return u.toString();
  }

  function setPager(m){
    pager.innerHTML=''; if(!m||!m.pages) return;
    const {page,pages}=m;
    const mk=(p,l,d=false)=>{ const b=document.createElement('button'); b.textContent=l; b.disabled=d; b.className='btn'; b.onclick=e=>{e.preventDefault(); load(p)}; return b; };
    pager.append(mk(page-1,'Prev',page<=1));
    const span=document.createElement('span'); span.className='muted'; span.textContent='Page '+page+' of '+pages; pager.append(span);
    pager.append(mk(page+1,'Next',page>=pages));
  }

  function setMeta(m){ meta.textContent = m ? (m.total||0)+' results' : ''; }

  async function load(page=1){
    const base='/events?'+qs()+'&page='+page+'&pageSize=21';
    const j=await jget(base);
    const items=(j.items||[]);
    list.innerHTML = items.map(it=>{
      const v=it.venue||{};
      const price=(it.ticketTypes&&it.ticketTypes[0]) ? 'from '+fmtP(it.ticketTypes[0].pricePence) : '';
      const img = it.imageUrl ? '<img src="'+it.imageUrl+'" alt="poster"/>' : '<span class="muted" style="font-size:12px">No image</span>';
      return \`
        <div class="item">
          <div class="thumb">\${img}</div>
          <div style="min-width:0">
            <div class="title">\${it.title}</div>
            <div class="muted">\${fmtDate(it.date)} • <a href="/public/venue/\${it.venueId||''}">\${v.name||''}</a> \${v.city?('('+v.city+')'):''}</div>
            <div class="row" style="margin-top:8px;align-items:center;gap:8px">
              <span class="pill">\${price}</span>
              <a class="btn" href="/public/event/\${it.id}">Details</a>
              <a class="btn" href="/checkout?showId=\${it.id}">Book</a>
            </div>
          </div>
        </div>\`;
    }).join('');
    setMeta(j.meta); setPager(j.meta);
  }

  async function loadCities(){
    const j = await jget('/events/cities?upcoming=1');
    const opts=(j.cities||[]).map(c=>'<option>'+c+'</option>').join('');
    $('#city').insertAdjacentHTML('beforeend',opts);
  }

  $('#filters').addEventListener('submit',e=>{e.preventDefault();load(1)});
  $('#reset').addEventListener('click',()=>{q.value='';city.value='';month.value='';order.value='asc';load(1)});
  loadCities().then(()=>load(1)).catch(()=>load(1));
})();
</script>
</body>
</html>`;
}

function eventDetailHTML(show: any) {
  const v = show.venue || {};
  const price = (show.ticketTypes && show.ticketTypes[0]) ? 'from £'+(show.ticketTypes[0].pricePence/100).toFixed(2) : '';
  const when = new Date(show.date).toLocaleString();
  const title = `${show.title} • ${v.name || v.city || ''}`;
  const desc = (show.description || 'Book tickets now.');
  const img = show.imageUrl || '';
  const url = `/public/event/${show.id}`;
  return `<!doctype html>
<html lang="en">
<head>
${baseHead({ title, desc, image: img, url })}
</head>
<body>
<div class="wrap">
  <header><a href="/public/events">← All events</a></header>
  <div class="card">
    <h1 style="font-size:24px; margin:0 0 8px">${escapeHtml(show.title)}</h1>
    <div class="row" style="align-items:flex-start; gap:16px">
      ${img ? `<img class="poster" src="${escapeHtml(img)}" alt="Poster for ${escapeHtml(show.title)}"/>` : ''}
      <div>
        <div class="muted">${escapeHtml(when)} • ${escapeHtml(v.name||'')}${v.city?(' ('+escapeHtml(v.city)+')'):''}</div>
        ${show.description ? `<p style="margin-top:8px">${escapeHtml(show.description)}</p>` : ''}
        <div class="row" style="margin-top:8px;align-items:center">
          ${price ? `<span class="pill">${price}</span>` : ''}
          <a class="btn" href="/checkout?showId=${show.id}">Book Now</a>
          <a class="btn" href="/calendar/event/${show.id}.ics">Add to calendar</a>
          ${v.id ? `<a class="btn" href="/public/venue/${v.id}">More at this venue</a>` : ''}
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function venueHTML(venue: any, shows: any[]) {
  const title = `${venue.name}${venue.city ? ' • ' + venue.city : ''} • Venue`;
  const addr = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');
  const mapQ = encodeURIComponent(addr || venue.name || '');
  return `<!doctype html>
<html lang="en">
<head>
${baseHead({ title, desc: `Upcoming shows at ${venue.name}.` })}
</head>
<body>
<div class="wrap">
  <header>
    <a href="/public/events">← All events</a>
    <a href="/admin/ui">Organiser login</a>
  </header>

  <div class="card">
    <h1 style="margin:0 0 6px">${escapeHtml(venue.name)}</h1>
    <div class="muted">${escapeHtml(addr)}</div>
    <div style="margin-top:10px">
      <iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps?q=${mapQ}&output=embed"></iframe>
    </div>
  </div>

  <div class="card">
    <div class="row" style="align-items:center;justify-content:space-between">
      <div><strong>Upcoming shows</strong></div>
      <a class="btn" href="/events?venueId=${venue.id}">JSON</a>
    </div>
    <div class="grid" style="margin-top:10px">
      ${shows.map(s=>{
        const v=s.venue||{};
        const price=(s.ticketTypes&&s.ticketTypes[0])?'from £'+(s.ticketTypes[0].pricePence/100).toFixed(2):'';
        return `
          <div class="item">
            <div class="thumb">${s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" alt="poster"/>` : '<span class="muted" style="font-size:12px">No image</span>'}</div>
            <div style="min-width:0">
              <div class="title">${escapeHtml(s.title)}</div>
              <div class="muted">${new Date(s.date).toLocaleString()} • ${escapeHtml(v.name||'')}</div>
              <div class="row" style="margin-top:8px;align-items:center;gap:8px">
                ${price ? `<span class="pill">${price}</span>` : ''}
                <a class="btn" href="/public/event/${s.id}">Details</a>
                <a class="btn" href="/checkout?showId=${s.id}">Book</a>
              </div>
            </div>
          </div>`;
      }).join('')}
      ${shows.length === 0 ? '<div class="muted">No upcoming shows.</div>' : ''}
    </div>
  </div>
</div>
</body>
</html>`;
}

function notFoundHTML(msg: string){
  return `<!doctype html><meta charset="utf-8"/><title>Not found</title><body style="font-family:ui-sans-serif;background:#0b1020;color:#e2e8f0"><div style="max-width:720px;margin:10vh auto;padding:20px;border:1px solid #1e293b;border-radius:12px;background:#0f1630"><h1 style="margin:0 0 8px">Oops</h1><div>${escapeHtml(msg)}</div><div style="margin-top:10px"><a href="/public/events" style="color:#a5b4fc">← Back to events</a></div></div></body>`;
}

function escapeHtml(s: string){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function absUrl(p?: string){ if(!p) return ''; if(/^https?:\/\//i.test(p)) return p; const base=(ORIGIN_META||'').replace(/\/+$/,''); return base ? base + (p.startsWith('/')?p:'/'+p) : p; }

export default router;
