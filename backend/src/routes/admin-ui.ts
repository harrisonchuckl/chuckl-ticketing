// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

// A tiny HTML admin dashboard that:
// - Lets you enter/save your x-admin-key (stored in localStorage)
// - Fetches recent orders and groups them by show
// - On demand, loads check-in counts by fetching each order's tickets
// - Links to the /scan page (it will reuse the saved admin key)

router.get('/ui', (_req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Chuckl. Admin</title>
  <style>
    :root{
      --bg:#0b0b10; --card:#151823; --muted:#c6c8d1; --line:#24283a;
      --brand:#2da8ff; --brand-2:#4f46e5; --ok:#16a34a; --warn:#d97706; --err:#ef4444;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif;}
    .wrap{max-width:1100px;margin:0 auto;padding:28px}
    h1{margin:0 0 18px;font-size:28px}
    p{color:var(--muted);margin:0 0 18px}
    .row{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 16px}
    input,select,button{height:40px;border-radius:10px;border:1px solid var(--line);background:#0f1320;color:#fff;padding:0 12px}
    button{background:var(--brand-2);border-color:transparent;cursor:pointer}
    button.secondary{background:#0f1320;border-color:var(--line)}
    button.link{background:transparent;border:0;color:var(--brand);padding:0;height:auto}
    .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
    .meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:13px}
    .pill{display:inline-flex;gap:8px;align-items:center;background:#0f1320;border:1px solid var(--line);padding:6px 10px;border-radius:20px}
    .pill.ok{border-color:#134e1f;background:#0b1a11}
    .pill.warn{border-color:#57320a;background:#1a1209}
    .pill.err{border-color:#5f1313;background:#1a0c0c}
    .tbl{width:100%;border-collapse:collapse;margin-top:10px}
    .tbl th,.tbl td{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:14px}
    .notice{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:#0f1320}
    .hide{display:none}
    .muted{color:var(--muted)}
    .right{margin-left:auto}
    .small{font-size:12px;color:var(--muted)}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chuckl. Admin</h1>
    <div class="card">
      <div class="row">
        <label class="small">Admin Key</label>
        <input id="adminKey" placeholder="x-admin-key e.g. ashdb77asjkh" style="width:360px"/>
        <button id="saveKey">Save</button>
        <button id="loadShows" class="secondary">Load latest shows</button>
        <span class="right small">Tip: key is stored only in this browser (localStorage)</span>
      </div>
    </div>

    <div id="showsWrap" class="grid" style="margin-top:16px;"></div>
  </div>

  <div id="toast" class="notice hide"></div>

  <script>
    const $ = (s,el=document)=>el.querySelector(s);
    const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
    const toast = (msg, ms=2200)=>{ const n=$("#toast"); n.textContent=msg; n.classList.remove("hide"); setTimeout(()=>n.classList.add("hide"), ms); };

    // Persist admin key in localStorage
    const keyInput = $("#adminKey");
    const savedKey = localStorage.getItem("x-admin-key") || "";
    if (savedKey) keyInput.value = savedKey;
    $("#saveKey").onclick = () => {
      localStorage.setItem("x-admin-key", keyInput.value.trim());
      toast("Admin key saved");
    };

    $("#loadShows").onclick = () => loadShows();

    async function api(path){
      const key = keyInput.value.trim();
      if(!key){ toast("Enter your admin key first"); throw new Error("no key"); }
      const res = await fetch(path, { headers: { "x-admin-key": key } });
      if(!res.ok){ const t = await res.text(); throw new Error("API " + res.status + ": " + t); }
      return res.json();
    }

    // 1) Load recent orders then aggregate by show
    async function loadShows(){
      $("#showsWrap").innerHTML = "";
      try{
        // Pull last 200 orders (tweak if needed)
        const data = await api("/admin/orders?limit=200");
        const byShow = new Map();
        for(const o of data.orders||[]){
          const s = o.show || {};
          const k = s.id || "unknown";
          if(!byShow.has(k)){
            byShow.set(k, {
              showId: s.id, title: s.title, date: s.date, venue: (s.venue && s.venue.name) || "",
              orders: [], totalQty: 0
            });
          }
          const bucket = byShow.get(k);
          bucket.orders.push(o);
          bucket.totalQty += Number(o.quantity||0);
        }
        if (byShow.size===0){
          $("#showsWrap").innerHTML = '<div class="card"><p class="muted">No recent orders.</p></div>';
          return;
        }
        renderShows(Array.from(byShow.values()).sort((a,b)=>(a.date||"").localeCompare(b.date||"")));
      }catch(e){
        console.error(e);
        toast("Failed to load shows");
      }
    }

    function fmtDate(iso){ try{ return new Date(iso).toLocaleString(); }catch{ return iso||""; } }

    function renderShows(items){
      const wrap = $("#showsWrap");
      wrap.innerHTML = "";
      for(const s of items){
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = \`
          <div class="row" style="align-items:flex-start;">
            <div>
              <div style="font-weight:700;font-size:18px;">\${s.title||"Unknown show"}</div>
              <div class="meta" style="margin-top:6px;">
                <span class="pill">Date: \${fmtDate(s.date)}</span>
                <span class="pill">Venue: \${s.venue||"-"}</span>
                <span class="pill">Orders: \${s.orders.length}</span>
                <span class="pill">Total tickets: <strong>\${s.totalQty}</strong></span>
              </div>
            </div>
            <span class="right"></span>
            <div class="row">
              <button class="secondary" data-action="stats">Load check-ins</button>
              <button class="secondary" data-action="refresh">Refresh orders</button>
              <button data-action="scan">Open scanner</button>
            </div>
          </div>
          <table class="tbl small">
            <tbody>
              <tr><td>Checked-in</td><td id="in_\${s.showId}">—</td></tr>
              <tr><td>Remaining</td><td id="rem_\${s.showId}">—</td></tr>
              <tr><td>Total</td><td>\${s.totalQty}</td></tr>
            </tbody>
          </table>
        \`;
        wrap.appendChild(card);

        card.querySelector('[data-action="scan"]').onclick = ()=>{
          // Make the scanner reuse the saved key
          localStorage.setItem("x-admin-key", ($("#adminKey").value||"").trim());
          window.open("/scan","_blank");
        };
        card.querySelector('[data-action="refresh"]').onclick = ()=>loadShows();
        card.querySelector('[data-action="stats"]').onclick = ()=>loadCheckinsForShow(s);
      }
    }

    // 2) On demand, load check-in counts by fetching each order's ticket statuses
    async function loadCheckinsForShow(show){
      const key = keyInput.value.trim();
      if(!key){ toast("Enter your admin key first"); return; }
      let used = 0;
      try{
        // Fetch each order fully, count tickets with status USED (or scannedAt not null)
        for(const o of show.orders){
          const full = await api("/admin/order/" + o.id);
          const tickets = full.tickets || [];
          for(const t of tickets){
            if (t.status === "USED" || (t.scannedAt && t.scannedAt !== null)) used++;
          }
        }
        const remaining = Math.max(0, Number(show.totalQty||0) - used);
        const setTxt = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=String(v); };
        setTxt("in_"+show.showId, used);
        setTxt("rem_"+show.showId, remaining);
        toast("Check-ins updated");
      }catch(e){
        console.error(e);
        toast("Failed loading check-ins");
      }
    }

    // Auto-load on open if a key exists
    if(savedKey){ loadShows(); }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
