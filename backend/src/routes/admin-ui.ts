// backend/src/routes/admin-ui.ts
import { Router } from 'express';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

router.get('/ui', requireAdminOrOrganiser, async (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Organiser Console</title>
<style>
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280}
  html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}
  .wrap{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}
  .sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}
  .sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}
  .sb-link.active,.sb-link:hover{background:#f1f5f9}
  .content{flex:1;padding:20px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .title{font-weight:600}
  .muted{color:var(--muted)}
  .btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn:hover{background:#f9fafb}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
</style>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="sb-group">Dashboard</div>
    <a class="sb-link" href="#home" data-view="home">Home</a>
    <div class="sb-group">Manage</div>
    <a class="sb-link" href="#shows" data-view="shows">Shows</a>
    <a class="sb-link" href="#orders" data-view="orders">Orders</a>
    <a class="sb-link" href="#venues" data-view="venues">Venues</a>
    <div class="sb-group">Insights</div>
    <a class="sb-link" href="#analytics" data-view="analytics">Analytics</a>
    <div class="sb-group">Marketing</div>
    <a class="sb-link" href="#audiences" data-view="audiences">Audiences</a>
    <a class="sb-link" href="#email" data-view="email">Email Campaigns</a>
    <div class="sb-group">Settings</div>
    <a class="sb-link" href="#account" data-view="account">Account</a>
    <a class="sb-link" href="/auth/logout">Log out</a>
  </aside>
  <main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function setActive(v){ $$('.sb-link').forEach(a=>a.classList.toggle('active',a.getAttribute('data-view')===v)); }
  function setMain(html){ $('#main').innerHTML=html; }
  async function j(url,opts){ const r=await fetch(url,{credentials:'include',...(opts||{})}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  function route(){ const v=(location.hash||'#home').slice(1); setActive(v); if(v==='shows') return shows(); if(v==='venues') return venues(); if(v==='orders') return orders(); if(v==='analytics') return analytics(); if(v==='audiences') return audiences(); if(v==='email') return email(); if(v==='account') return account(); return home(); }
  window.addEventListener('hashchange',route);

  function home(){ setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>'); }

  // ----- Safe upload helper using fetch -> /api/upload -----
  async function uploadPoster(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`Upload failed (\${res.status}): \${text.slice(0, 300)}\`);
    }

    const data = await res.json().catch(async () => {
      const text = await res.text();
      throw new Error(\`Non-JSON response: \${text.slice(0, 300)}\`);
    });

    if (!data?.ok) {
      throw new Error(data?.error || "Unknown upload error");
    }

    return data; // { ok:true, key, url }
  }

  async function shows(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>
        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"/></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"/></div>
          <div class="grid"><label>Venue</label><select id="sh_venue"><option value="">Loading venues…</option></select></div>
          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none"/>
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div class="row" style="margin-top:8px;display:flex;gap:8px;align-items:center">
              <img id="prev" class="imgprev" alt=""/>
              <input id="imgurl" placeholder="(auto-set after upload) https://…"/>
            </div>
            <div class="hint">We auto-optimise to WebP and host on Cloudflare R2.</div>
          </div>
          <div class="grid" style="grid-column:1/-1"><label>Description (optional)</label><textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea></div>
        </div>
        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" placeholder="General Admission"/></div>
          <div class="grid"><label>Price (£)</label><input id="t_price" type="number" step="0.01" placeholder="25.00"/></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300"/></div>
        </div>
        <div class="row" style="display:flex;gap:8px;align-items:center">
          <button id="create" class="btn">Create show</button>
          <div id="err" class="error"></div>
        </div>
      </div>
      <div class="card">
        <div class="header"><div class="title">Shows</div><button id="refresh" class="btn">Refresh</button></div>
        <table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead><tbody id="tbody"></tbody></table>
        <div id="lerr" class="error"></div>
      </div>
    \`);

    // load venues
    try {
      const vj = await j('/admin/venues');
      const sel = $('#sh_venue'); sel.innerHTML='<option value="">Select venue…</option>'+(vj.items||[]).map(v=>\`<option value="\${v.id}">\${v.name}\${v.city?' – '+v.city:''}</option>\`).join('');
    } catch { $('#err').textContent='Failed to load venues'; }

    // drag-drop wiring (uses safe fetch helper)
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), imgurl=$('#imgurl');
    function choose(){ file.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag');});
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', async (e)=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) await doUpload(f);
    });
    file.addEventListener('change', async ()=>{
      const f = file.files && file.files[0];
      if(f) await doUpload(f);
    });

    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%'; // show 'working' immediately
      try{
        const out = await uploadPoster(f);
        imgurl.value = out.url;
        prev.src = out.url;
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%', 800);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent = e.message || 'Upload failed';
      }
    }

    // create show
    $('#create').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId: $('#sh_venue').value || null,
          imageUrl: $('#imgurl').value.trim() || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim(),
            pricePounds: $('#t_price').value ? Number($('#t_price').value) : null,
            available: $('#t_alloc').value ? Number($('#t_alloc').value) : null,
          }
        };
        if(!payload.title || !payload.date || !payload.venueId){ $('#err').textContent='Title, date/time and venue are required'; return; }
        const r = await j('/admin/shows',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(!r.ok) throw new Error(r.error||'Failed to create show');
        ['sh_title','sh_dt','sh_desc','imgurl','t_name','t_price','t_alloc'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        prev.src=''; bar.style.width='0%';
        await loadList();
      }catch(e){ $('#err').textContent=e.message||'Failed to create show'; }
    });

    async function loadList(){
      try{
        $('#lerr').textContent='';
        const jn = await j('/admin/shows');
        const tb = $('#tbody');
        tb.innerHTML = (jn.items||[]).map(s=>\`
          <tr>
            <td>\${s.title}</td>
            <td>\${new Date(s.date).toLocaleString()}</td>
            <td>\${s.venue ? (s.venue.name+(s.venue.city?' – '+s.venue.city:'')) : ''}</td>
            <td>\${s._count?.ticketTypes ?? 0}</td>
            <td>\${s._count?.orders ?? 0}</td>
          </tr>\`).join('');
      }catch(e){ $('#lerr').textContent='Failed to load shows'; }
    }
    $('#refresh').addEventListener('click', loadList);
    loadList();
  }

  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the Venues tab (already implemented) to add/search venues.</div></div>'); }
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export are available in Orders view.</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'); }
  function account(){ setMain('<div class="card"><div class="title">Account</div><div>Manage your login and security (coming soon).</div></div>'); }

  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){ e.preventDefault(); history.pushState(null,'',a.getAttribute('href')); route(); }
  });

  route();
})();
</script>
</body>
</html>`);
});

export default router;
