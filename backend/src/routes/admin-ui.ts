// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  body {
    margin:0;
    font-family:system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
    background:#f7f8fa;
    color:#111;
  }
  .layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
  .aside{background:#fff;border-right:1px solid #e3e5ea;padding:16px}
  .brand{font-weight:700;font-size:18px;margin-bottom:8px}
  .kbox{background:#fafbfc;border:1px solid #e3e5ea;border-radius:8px;padding:10px;margin-bottom:16px}
  .nav button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:#333;cursor:pointer}
  .nav button.active{background:#eef1f6;font-weight:600}
  .main{padding:20px}
  .panel{background:#fff;border:1px solid #e3e5ea;border-radius:8px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .btn{border:0;border-radius:6px;padding:8px 12px;background:#4053ff;color:#fff;cursor:pointer;font-weight:600}
  .btn.secondary{background:#e9ebf3;color:#111}
  .muted{color:#666}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{padding:8px;border-bottom:1px solid #e3e5ea;text-align:left}
  th{color:#666;font-weight:600}
  input,select{border:1px solid #ccd0d8;border-radius:6px;padding:8px;width:100%;font-size:14px}
  #toast{position:fixed;bottom:16px;left:16px;padding:10px 12px;border-radius:6px;background:#111;color:#fff;font-weight:600;display:none}
</style>
</head>
<body>
<div class="layout">
  <aside class="aside">
    <div class="brand">Chuckl. Admin</div>
    <div class="kbox">
      <label style="font-size:12px">Admin Key</label>
      <input id="adminkey" type="text" placeholder="enter your admin key"/>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn secondary" id="saveKeyBtn">Save</button>
        <button class="btn secondary" id="clearKeyBtn">Clear</button>
      </div>
    </div>
    <div class="nav">
      <button data-tab="dashboard" class="active">Dashboard</button>
      <button data-tab="shows">Shows</button>
      <button data-tab="venues">Venues</button>
      <button data-tab="orders">Orders</button>
      <button data-tab="marketing">Marketing</button>
      <button data-tab="finance">Finance</button>
      <button data-tab="settings">Settings</button>
    </div>
  </aside>

  <main class="main">
    <!-- DASHBOARD -->
    <section id="tab-dashboard" class="panel">
      <div class="toolbar">
        <button class="btn" id="loadLatestBtn">Load latest shows</button>
        <span class="muted">Quick overview of your most recent events.</span>
      </div>
      <div>
        <table id="latestTable">
          <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- SHOWS -->
    <section id="tab-shows" class="panel hidden">
      <div class="toolbar">
        <button class="btn" id="refreshShowsBtn">Refresh</button>
        <span class="muted">Create and manage shows</span>
      </div>
      <div id="showsTableWrap">
        <table id="showsTable">
          <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- VENUES -->
    <section id="tab-venues" class="panel hidden">
      <div class="toolbar">
        <input id="venueSearch" placeholder="Search venues"/>
        <button class="btn secondary" id="searchVenuesBtn">Search</button>
      </div>
      <table id="venuesTable">
        <thead><tr><th>Name</th><th>City</th><th>Capacity</th></tr></thead>
        <tbody></tbody>
      </table>
    </section>

    <!-- ORDERS -->
    <section id="tab-orders" class="panel hidden">
      <div class="toolbar">
        <input id="ordersSearch" placeholder="Search by email or ID" style="flex:1;max-width:240px"/>
        <select id="ordersShowFilter" style="max-width:220px"></select>
        <button class="btn" id="loadOrdersBtn">Load Orders</button>
      </div>
      <table id="ordersTable">
        <thead><tr><th>ID</th><th>Date</th><th>Show</th><th>Email</th><th>Tickets</th></tr></thead>
        <tbody></tbody>
      </table>
    </section>
  </main>
</div>

<div id="toast"></div>

<script>
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
function showToast(m){const t=$("#toast");t.textContent=m;t.style.display="block";setTimeout(()=>t.style.display="none",2000);}
function getKey(){return localStorage.getItem("adminKey")||"";}
function setKey(v){localStorage.setItem("adminKey",v||"");}
async function jget(p){const k=getKey();const qs=p.includes("?")?"&":"?";const u=p+qs+"k="+encodeURIComponent(k);const r=await fetch(u,{headers:{"x-admin-key":k}});return r.json();}
async function loadLatest(){const tb=$("#latestTable tbody");tb.innerHTML="<tr><td colspan=5>Loading…</td></tr>";const r=await jget("/admin/shows/latest?limit=20");if(!r.ok){tb.innerHTML="<tr><td colspan=5>Failed</td></tr>";return;}tb.innerHTML=r.shows.map(s=>{const d=new Date(s.date).toLocaleString();return \`<tr><td>\${s.title}</td><td>\${d}</td><td>\${s.venue?.name||"—"}</td><td>\${s._count?.tickets||0}</td><td>\${s._count?.orders||0}</td></tr>\`;}).join("");}
$("#loadLatestBtn").onclick=loadLatest;
$("#saveKeyBtn").onclick=()=>{setKey($("#adminkey").value.trim());showToast("Key saved");};
$("#clearKeyBtn").onclick=()=>{setKey("");$("#adminkey").value="";showToast("Cleared");};
const tabs=$$(".nav button");tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove("active"));b.classList.add("active");$$("main>section").forEach(s=>s.classList.add("hidden"));$("#tab-"+b.dataset.tab).classList.remove("hidden");});
$("#adminkey").value=getKey();

// Shows
async function refreshShows(){const tb=$("#showsTable tbody");tb.innerHTML="<tr><td colspan=4>Loading…</td></tr>";const r=await jget("/admin/shows/latest?limit=20");if(!r.ok){tb.innerHTML="<tr><td colspan=4>Failed</td></tr>";return;}tb.innerHTML=r.shows.map(s=>{const d=new Date(s.date).toLocaleString();return \`<tr><td>\${s.title}</td><td>\${d}</td><td>\${s.venue?.name||"—"}</td><td>\${s._count?.tickets||0}</td></tr>\`;}).join("");const sel=$("#ordersShowFilter");sel.innerHTML='<option value="">All shows</option>'+r.shows.map(s=>\`<option value="\${s.id}">\${s.title}</option>\`).join("");}
$("#refreshShowsBtn").onclick=refreshShows;

// Venues
async function refreshVenues(){const tb=$("#venuesTable tbody");tb.innerHTML="<tr><td colspan=3>Loading…</td></tr>";const r=await jget("/admin/venues?limit=100");if(!r.ok){tb.innerHTML="<tr><td colspan=3>Failed</td></tr>";return;}tb.innerHTML=r.venues.map(v=>\`<tr><td>\${v.name}</td><td>\${v.city||"—"}</td><td>\${v.capacity||"—"}</td></tr>\`).join("");}
$("#searchVenuesBtn").onclick=refreshVenues;

// Orders
async function loadOrders(){const tb=$("#ordersTable tbody");tb.innerHTML="<tr><td colspan=5>Loading…</td></tr>";const showId=$("#ordersShowFilter").value;const q=$("#ordersSearch").value.trim();let path="/admin/orders?";if(showId)path+="showId="+encodeURIComponent(showId)+"&";if(q)path+="q="+encodeURIComponent(q);const r=await jget(path);if(!r.ok){tb.innerHTML="<tr><td colspan=5>Failed</td></tr>";return;}tb.innerHTML=r.orders.map(o=>{const d=new Date(o.createdAt).toLocaleString();return \`<tr><td>\${o.id}</td><td>\${d}</td><td>\${o.show?.title||"—"}</td><td>\${o.email||"—"}</td><td>\${o.tickets?.length||0}</td></tr>\`;}).join("");}
$("#loadOrdersBtn").onclick=loadOrders;

// init
(async()=>{await refreshShows();await refreshVenues();await loadLatest();})();
</script>
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
