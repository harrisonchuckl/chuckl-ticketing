// backend/src/routes/public-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * Public UI shell (hash-less SPA using real paths).
 * Serves /public/events and /public/event/:id and lets client JS render.
 */
function htmlShell() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Events • Chuckl</title>
<meta name="robots" content="index,follow" />
<style>
  :root{--bg:#0b0f19;--panel:#0f1525;--card:#111827;--text:#e5e7eb;--muted:#94a3b8;--brand:#38bdf8;--border:#1f2937}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1100px;margin:0 auto;padding:20px}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
  .brand{font-weight:700;letter-spacing:.2px}
  .muted{color:var(--muted)}
  .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  @media (max-width:980px){ .grid{grid-template-columns:repeat(2,1fr)} }
  @media (max-width:640px){ .grid{grid-template-columns:1fr} }
  .card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
  .thumb{width:100%;aspect-ratio:4/3;background:#0b1220;object-fit:cover;display:block}
  .pad{padding:12px}
  .title{font-weight:700;margin:6px 0 4px}
  .sub{color:var(--muted);font-size:14px}
  .btn{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 12px;background:#0c1322;cursor:pointer}
  .btn:hover{background:#0e172a}
  .hero{display:grid;grid-template-columns:360px 1fr;gap:20px}
  @media (max-width:880px){ .hero{grid-template-columns:1fr} .hero img{width:100%} }
  .hero img{width:360px;border-radius:14px;border:1px solid var(--border);background:#0b1220}
  .divider{height:1px;background:var(--border);margin:16px 0}
  .price-fee{font-weight:400;font-size:0.95rem;color:var(--muted);margin-left:6px}
  .sr-only{position:absolute!important;height:1px;width:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);white-space:nowrap}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">Chuckl <span class="muted">Events</span></div>
    <nav><a href="/public/events" class="btn">All events</a></nav>
  </header>
  <main id="app">
    <div class="muted">Loading…</div>
  </main>
</div>

<script>
(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const app = $('#app');

  function fmtDate(iso){
    try{
      const d=new Date(iso);
      return d.toLocaleString(undefined,{weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
    }catch{ return iso; }
  }

  async function getJSON(url){
    const r = await fetch(url, { credentials: 'include' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  async function renderList(){
    document.title = 'Events • Chuckl';
    app.innerHTML = '<div class="muted">Loading events…</div>';
    try{
      // Expecting { ok:true, items:[{ id,title,date,imageUrl,venue:{name,city} }] }
      const j = await getJSON('/events');
      const items = (j.items || j) || [];
      if(!items.length){
        app.innerHTML = '<div class="muted">No upcoming events yet.</div>';
        return;
      }
      const html = '<div class="grid">' + items.map(it => {
        const img = it.imageUrl ? ('/img/fetch?src=' + encodeURIComponent(it.imageUrl) + '&w=600') : '';
        const sub = [fmtDate(it.date), it.venue && (it.venue.name + (it.venue.city ? ' — ' + it.venue.city : ''))].filter(Boolean).join(' • ');
        return (
          '<a class="card" href="/public/event/' + it.id + '">' +
            (img ? ('<img class="thumb" alt="" src="' + img + '"/>') : '<div class="thumb" aria-hidden="true"></div>') +
            '<div class="pad">' +
              '<div class="title">' + (it.title || 'Untitled show') + '</div>' +
              '<div class="sub">' + sub + '</div>' +
              '<div style="margin-top:10px"><span class="btn">View details</span></div>' +
            '</div>' +
          '</a>'
        );
      }).join('') + '</div>';
      app.innerHTML = html;
    } catch(e){
      console.error(e);
      app.innerHTML = '<div class="muted">Failed to load events.</div>';
    }
  }

  async function renderDetail(id){
    app.innerHTML = '<div class="muted">Loading…</div>';
    try{
      // Expecting { ok:true, item:{ id,title,date,description,imageUrl,venue:{name,city,address?}, ticketTypes:[{name,pricePence}] } }
      const j = await getJSON('/events/' + encodeURIComponent(id));
      const it = j.item || j;
      if(!it || !it.id){ app.innerHTML = '<div class="muted">Event not found.</div>'; return; }

      document.title = (it.title || 'Event') + ' • Chuckl';

      const hero = it.imageUrl
        ? ('<img alt="" src="/img/fetch?src=' + encodeURIComponent(it.imageUrl) + '&w=1200">')
        : '<div style="height:360px;border:1px solid var(--border);border-radius:14px;background:#0b1220"></div>';

      const when = fmtDate(it.date);
      const where = it.venue
        ? (it.venue.name + (it.venue.city ? ' — ' + it.venue.city : ''))
        : '';

      const firstTicket = (it.ticketTypes && it.ticketTypes[0]) ? it.ticketTypes[0] : null;
      const priceStr = firstTicket ? ('£' + ( (firstTicket.pricePence||0) / 100 ).toFixed(2)) : '';
      const bookingFeeBps = it.venue && typeof it.venue.bookingFeeBps === 'number' ? it.venue.bookingFeeBps : 0;
      const bookingFeePence = firstTicket && bookingFeeBps > 0
        ? Math.round((firstTicket.pricePence || 0) * bookingFeeBps / 10000)
        : 0;
      const bookingFeeStr = bookingFeePence > 0 ? (' + £' + (bookingFeePence / 100).toFixed(2) + ' b.f.') : '';

      app.innerHTML =
        '<section class="hero">' +
          '<div>' + hero + '</div>' +
          '<div>' +
            '<h1 class="title" style="font-size:28px;margin:0 0 6px">' + (it.title || 'Event') + '</h1>' +
            '<div class="sub">' + [when, where].filter(Boolean).join(' • ') + '</div>' +
            (priceStr ? ('<div style="margin-top:8px">From <strong>' + priceStr + '</strong>' + (bookingFeeStr ? '<span class="price-fee">' + bookingFeeStr + '</span>' : '') + '</div>') : '') +
            '<div class="divider"></div>' +
            (it.description ? ('<p style="line-height:1.6;margin:0 0 10px">' + it.description + '</p>') : '') +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">' +
              '<a class="btn" href="/checkout?showId=' + encodeURIComponent(it.id) + '">Book tickets</a>' +
              '<a class="btn" href="/public/events">Back to events</a>' +
            '</div>' +
          '</div>' +
        '</section>';
    } catch(e){
      console.error(e);
      app.innerHTML = '<div class="muted">Could not load event.</div>';
    }
  }

  // Simple client-side router for two paths
  function handleRoute(){
    const p = location.pathname;
    const m = p.match(/^\\/public\\/event\\/([^\\/]+)\\/?$/);
    if(m){ renderDetail(m[1]); return; }
    renderList();
  }

  // Intercept same-origin <a> clicks for SPA feel
  document.addEventListener('click', function(ev){
    const a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!href.startsWith('/public/')) return;
    const u = new URL(href, location.origin);
    if(u.origin !== location.origin) return;
    ev.preventDefault();
    history.pushState(null, '', href);
    handleRoute();
  });

  window.addEventListener('popstate', handleRoute);
  handleRoute();
})();
</script>
</body>
</html>`;
}

router.get('/public/events', (_req, res) => {
  res.type('html').send(htmlShell());
});

router.get('/public/event/:id', (_req, res) => {
  res.type('html').send(htmlShell());
});

export default router;
