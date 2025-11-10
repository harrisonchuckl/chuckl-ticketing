// backend/src/routes/public-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * Public SPA shell (Listings UI)
 * - /public/events  -> lists upcoming shows
 * - /public/event/:id is handled by your SSR route; this shell keeps a lightweight client for listing
 *
 * This version avoids nested template strings so it compiles cleanly under TS.
 */
router.get(['/events', '/'], async (_req, res) => {
  res.type('html').send(getShellHtml());
});

function getShellHtml(): string {
  // NOTE: No nested template strings in the script. We build DOM with createElement().
  return (
    '<!doctype html>' +
    '<html lang="en">' +
    '<head>' +
    '  <meta charset="utf-8" />' +
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '  <title>Comedy Tickets – Events</title>' +
    '  <meta name="description" content="Find and book tickets for upcoming stand-up comedy shows." />' +
    '  <style>' +
    '    :root{--bg:#ffffff;--text:#0f172a;--muted:#475569;--border:#e2e8f0;--brand:#0ea5e9;}' +
    '    *{box-sizing:border-box}' +
    '    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}' +
    '    header{padding:16px;border-bottom:1px solid var(--border)}' +
    '    .wrap{max-width:1100px;margin:0 auto;padding:16px}' +
    '    .muted{color:var(--muted)}' +
    '    .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}' +
    '    .card{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;display:flex;flex-direction:column}' +
    '    .poster{width:100%;aspect-ratio:3/4;object-fit:cover;background:#f8fafc}' +
    '    .pad{padding:12px}' +
    '    .title{font-weight:600;margin:0 0 6px 0;font-size:16px}' +
    '    .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '    .btn{display:inline-block;border:1px solid var(--brand);border-radius:10px;padding:8px 12px;text-decoration:none;color:#111}' +
    '    .btn:hover{background:#e6f6fe}' +
    '    .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}' +
    '    input,select{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}' +
    '    .empty{border:1px dashed var(--border);border-radius:12px;padding:24px;text-align:center;color:var(--muted)}' +
    '  </style>' +
    '</head>' +
    '<body>' +
    '  <header>' +
    '    <div class="wrap">' +
    '      <h1 style="margin:0;font-size:20px;">Comedy Tickets</h1>' +
    '      <div class="muted">Discover upcoming stand-up shows</div>' +
    '    </div>' +
    '  </header>' +
    '  <main class="wrap">' +
    '    <div class="toolbar">' +
    '      <input id="q" type="text" placeholder="Search by title or city" />' +
    '      <select id="sort">' +
    '        <option value="date:asc">Soonest first</option>' +
    '        <option value="date:desc">Latest first</option>' +
    '        <option value="price:asc">Lowest price</option>' +
    '        <option value="price:desc">Highest price</option>' +
    '      </select>' +
    '      <button id="btnGo" class="btn" type="button">Search</button>' +
    '    </div>' +
    '    <div id="err" class="muted" style="min-height:18px;"></div>' +
    '    <div id="grid" class="grid"></div>' +
    '    <div id="empty" class="empty" style="display:none;">No matching shows yet — check back soon.</div>' +
    '  </main>' +
    '  <script>' +
    '    (function(){' +
    '      var q = document.getElementById("q");' +
    '      var sortSel = document.getElementById("sort");' +
    '      var btn = document.getElementById("btnGo");' +
    '      var grid = document.getElementById("grid");' +
    '      var empty = document.getElementById("empty");' +
    '      var err = document.getElementById("err");' +
    '' +
    '      function fmtP(p){ return "£" + (Number(p||0)/100).toFixed(2); }' +
    '      function el(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }' +
    '' +
    '      function applyQueryParamsToControls(){' +
    '        var sp = new URLSearchParams(location.search);' +
    '        if (sp.get("q")) q.value = sp.get("q");' +
    '        if (sp.get("sort")) sortSel.value = sp.get("sort");' +
    '      }' +
    '' +
    '      function buildQuery(){' +
    '        var sp = new URLSearchParams();' +
    '        if (q.value.trim()) sp.set("q", q.value.trim());' +
    '        // backend can just return upcoming; we can pass a hint if supported' +
    '        sp.set("upcoming","1");' +
    '        return sp.toString();' +
    '      }' +
    '' +
    '      function clientSort(items){' +
    '        var s = sortSel.value || "date:asc";' +
    '        if (s === "date:asc") items.sort(function(a,b){ return new Date(a.date) - new Date(b.date); });' +
    '        else if (s === "date:desc") items.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });' +
    '        else if (s === "price:asc") items.sort(function(a,b){ return (a.minPricePence||0) - (b.minPricePence||0); });' +
    '        else if (s === "price:desc") items.sort(function(a,b){ return (b.minPricePence||0) - (a.minPricePence||0); });' +
    '        return items;' +
    '      }' +
    '' +
    '      function render(items){' +
    '        grid.innerHTML = "";' +
    '        if (!items || !items.length){ empty.style.display="block"; return; }' +
    '        empty.style.display="none";' +
    '        for (var i=0;i<items.length;i++){' +
    '          var s = items[i];' +
    '          var card = el("div","card");' +
    '          var img = el("img","poster");' +
    '          img.alt = s.title || "Poster";' +
    '          img.loading = "lazy";' +
    '          img.src = s.imageUrl || "";' +
    '          if (!s.imageUrl){ img.style.background="#f8fafc"; }' +
    '          card.appendChild(img);' +
    '' +
    '          var box = el("div","pad");' +
    '          var h = el("h3","title"); h.textContent = s.title || ""; box.appendChild(h);' +
    '' +
    '          var meta = el("div","muted");' +
    '          var d = s.date ? new Date(s.date).toLocaleString() : "";' +
    '          var vline = "";' +
    '          if (s.venue){' +
    '            var parts = [];' +
    '            if (s.venue.name) parts.push(s.venue.name);' +
    '            var addrBits = [];' +
    '            if (s.venue.city) addrBits.push(s.venue.city);' +
    '            if (s.venue.postcode) addrBits.push(s.venue.postcode);' +
    '            if (addrBits.length) parts.push(addrBits.join(", "));' +
    '            vline = parts.join(" · ");' +
    '          }' +
    '          meta.textContent = (d ? d : "") + (vline ? " · " + vline : "");' +
    '          box.appendChild(meta);' +
    '' +
    '          if (s.minPricePence != null){' +
    '            var from = el("div","muted");' +
    '            from.textContent = "From " + fmtP(s.minPricePence);' +
    '            box.appendChild(from);' +
    '          }' +
    '' +
    '          var row = el("div","row");' +
    '          var a = el("a","btn");' +
    '          a.href = "/public/event/" + encodeURIComponent(s.id);' +
    '          a.textContent = "View details";' +
    '          row.appendChild(a);' +
    '          box.appendChild(row);' +
    '' +
    '          card.appendChild(box);' +
    '          grid.appendChild(card);' +
    '        }' +
    '      }' +
    '' +
    '      function handleSearch(){' +
    '        var qs = buildQuery();' +
    '        var url = "/events";' +
    '        if (qs) url += "?" + qs;' +
    '        err.textContent = "";' +
    '        fetch(url, { credentials:"include" })' +
    '          .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })' +
    '          .then(function(j){' +
    '            var items = (j && j.items) ? j.items : [];' +
    '            // compute minPrice client-side if not provided' +
    '            for (var i=0;i<items.length;i++){' +
    '              var tts = items[i].ticketTypes || [];' +
    '              if (tts.length){' +
    '                var min = null;' +
    '                for (var k=0;k<tts.length;k++){' +
    '                  var pp = tts[k].pricePence;' +
    '                  if (pp != null && (min==null || pp<min)) min = pp;' +
    '                }' +
    '                items[i].minPricePence = min;' +
    '              }' +
    '            }' +
    '            clientSort(items);' +
    '            render(items);' +
    '            var sp = new URLSearchParams();' +
    '            if (q.value.trim()) sp.set("q", q.value.trim());' +
    '            if (sortSel.value) sp.set("sort", sortSel.value);' +
    '            var newUrl = "/public/events" + (sp.toString() ? "?" + sp.toString() : "");' +
    '            history.replaceState(null,"",newUrl);' +
    '          })' +
    '          .catch(function(){ err.textContent = "Failed to load events."; });' +
    '      }' +
    '' +
    '      btn.addEventListener("click", handleSearch);' +
    '      sortSel.addEventListener("change", handleSearch);' +
    '      q.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); handleSearch(); } });' +
    '' +
    '      applyQueryParamsToControls();' +
    '      handleSearch();' +
    '    })();' +
    '  </script>' +
    '</body>' +
    '</html>'
  );
}

export default router;
