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
  :root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--accent:#111827}
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
  .btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
  .grid{display:grid;gap:8px}
  .grid-2{grid-template-columns:repeat(2,1fr)}
  .grid-3{grid-template-columns:repeat(3,1fr)}
  input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none}
  input[type="datetime-local"]{padding:7px 10px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}
  th{font-weight:600;color:#334155;background:#f8fafc}
  .error{color:#b91c1c}
  .hint{color:var(--muted);font-size:12px}
  .drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b;cursor:pointer}
  .drop.drag{background:#f8fafc;border-color:#94a3b8}
  .imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px}
  .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}
  .bar{height:8px;background:#111827;width:0%}
  .row{display:flex;gap:8px;align-items:center}

  /* Autosuggest dropdown */
  .suggest-wrap{position:relative}
  .suggest{position:absolute;top:100%;left:0;right:0;z-index:30;background:#fff;border:1px solid var(--border);border-radius:10px;margin-top:6px;box-shadow:0 8px 24px rgba(0,0,0,.06);overflow:hidden}
  .suggest-item{padding:10px 12px;cursor:pointer;border-top:1px solid #f1f5f9}
  .suggest-item:first-child{border-top:0}
  .suggest-item:hover,.suggest-item.active{background:#f8fafc}
  .suggest-empty{padding:10px 12px;color:var(--muted)}
  .create-inline{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-top:1px solid #e2e8f0}
  .create-inline .btn{padding:6px 10px}

  /* Modal */
  .modal-back{position:fixed;inset:0;background:rgba(17,24,39,.45);display:none;align-items:center;justify-content:center;z-index:50}
  .modal{width:min(640px,92vw);background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,.18);padding:16px}
  .modal .modal-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .modal .modal-t{font-weight:600}
  .modal .modal-x{border:0;background:transparent;font-size:22px;cursor:pointer;line-height:1}
  .modal .modal-f{display:grid;gap:10px}
  .modal .footer{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
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

<!-- Create Venue Modal -->
<div id="venueModalBack" class="modal-back" aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="venueModalTitle">
    <div class="modal-h">
      <div id="venueModalTitle" class="modal-t">Create venue</div>
      <button class="modal-x" id="venueModalClose" aria-label="Close">×</button>
    </div>
    <div class="modal-f">
      <div class="grid grid-2">
        <div class="grid"><label>Name</label><input id="vn_name" placeholder="e.g. Littleport Village Hall"></div>
        <div class="grid"><label>City / Town</label><input id="vn_city" placeholder="e.g. Littleport"></div>
      </div>
      <div class="grid grid-2">
        <div class="grid"><label>Address (optional)</label><input id="vn_address" placeholder=""></div>
        <div class="grid"><label>Postcode (optional)</label><input id="vn_postcode" placeholder=""></div>
      </div>
      <div class="grid grid-3">
        <div class="grid"><label>Capacity (optional)</label><input id="vn_capacity" type="number" min="0" step="1" placeholder="e.g. 350"></div>
        <div class="grid"><label>Phone (optional)</label><input id="vn_phone" placeholder=""></div>
        <div class="grid"><label>Website (optional)</label><input id="vn_website" placeholder=""></div>
      </div>
      <div id="vn_err" class="error"></div>
      <div class="footer">
        <button class="btn" id="venueCancel">Cancel</button>
        <button class="btn primary" id="venueSave">Save venue</button>
      </div>
    </div>
  </div>
</div>

<script>
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function setActive(v){ $$('.sb-link').forEach(a=>a.classList.toggle('active',a.getAttribute('data-view')===v)); }
  function setMain(html){ $('#main').innerHTML=html; }
  async function j(url,opts){
    const r=await fetch(url,{credentials:'include',...(opts||{})});
    if(!r.ok){
      const text = await r.text().catch(()=> '');
      throw new Error('HTTP '+r.status+(text?(': '+text.slice(0,200)):''));
    }
    return r.json();
  }
  function route(){
    const v=(location.hash||'#home').slice(1);
    setActive(v);
    if(v==='shows') return shows();
    if(v==='venues') return venues();
    if(v==='orders') return orders();
    if(v==='analytics') return analytics();
    if(v==='audiences') return audiences();
    if(v==='email') return email();
    if(v==='account') return account();
    return home();
  }
  window.addEventListener('hashchange',route);

  function home(){
    setMain('<div class="card"><div class="title">Welcome</div><div class="muted">Use the menu to manage shows, venues and orders.</div></div>');
  }

  // Upload helper -> /api/upload
  async function uploadPoster(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(\`Upload failed (\${res.status}): \${text.slice(0, 300)}\`);
    }
    const data = await res.json().catch(async () => {
      const text = await res.text();
      throw new Error(\`Non-JSON response: \${text.slice(0, 300)}\`);
    });
    if (!data?.ok) throw new Error(data?.error || "Unknown upload error");
    return data; // { ok:true, key, url }
  }

  // Simple debounce
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

  async function shows(){
    setMain(\`
      <div class="card">
        <div class="header"><div class="title">Add Show</div></div>
        <div class="grid grid-2" style="margin-bottom:8px">
          <div class="grid"><label>Title</label><input id="sh_title" placeholder="e.g. Chuckl. Comedy Club"></div>
          <div class="grid"><label>Date & time</label><input id="sh_dt" type="datetime-local"></div>

          <div class="grid" style="position:relative">
            <label>Venue</label>
            <div class="suggest-wrap">
              <input id="venue_input" placeholder="Start typing venue name…">
              <input id="venue_id" type="hidden">
              <div id="venue_suggest" class="suggest" style="display:none"></div>
            </div>
            <div class="hint">Pick an existing venue or create a new one.</div>
          </div>

          <div class="grid">
            <label>Poster image</label>
            <div id="drop" class="drop">Drop image here or click to choose</div>
            <input id="file" type="file" accept="image/*" style="display:none">
            <div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>
            <div class="row" style="margin-top:10px">
              <img id="prev" class="imgprev" alt="Poster preview" style="display:none">
              <button id="removeImg" class="btn" style="display:none">Remove</button>
            </div>
            <input id="imgurl" type="hidden">
          </div>

          <div class="grid" style="grid-column:1/-1">
            <label>Description (optional)</label>
            <textarea id="sh_desc" rows="3" placeholder="Short blurb…"></textarea>
          </div>
        </div>

        <div class="header" style="margin-top:10px"><div class="title">First ticket type</div></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="grid"><label>Name</label><input id="t_name" placeholder="General Admission"></div>
          <div class="grid"><label>Price (£)</label><input id="t_price" type="number" step="0.01" placeholder="25.00"></div>
          <div class="grid"><label>Allocation (optional)</label><input id="t_alloc" type="number" placeholder="e.g. 300"></div>
        </div>

        <div class="row" style="display:flex;gap:8px;align-items:center">
          <button id="create" class="btn">Create show</button>
          <div id="err" class="error"></div>
        </div>
      </div>

      <div class="card">
        <div class="header"><div class="title">Shows</div><button id="refresh" class="btn">Refresh</button></div>
        <table>
          <thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Tickets</th><th>Orders</th></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
        <div id="lerr" class="error"></div>
      </div>
    \`);

    // ------ Venue autosuggest ------
    const vin = $('#venue_input');
    const vid = $('#venue_id');
    const vsg = $('#venue_suggest');

    function hideSuggest(){ vsg.style.display='none'; vsg.innerHTML=''; }
    function showSuggest(){ vsg.style.display='block'; }

    function setChosenVenue(v){
      vin.value = v.name + (v.city ? ' – ' + v.city : '');
      vid.value = v.id;
      hideSuggest();
    }

    vin.addEventListener('input', ()=>{
      // typing invalidates a previously chosen id
      vid.value = '';
      debouncedSearch(vin.value.trim());
    });

    vin.addEventListener('focus', ()=>{
      if (vin.value.trim()) debouncedSearch.flush?.();
    });

    document.addEventListener('click', (e)=>{
      if (!vsg.contains(e.target) && e.target !== vin) hideSuggest();
    });

    const searchVenues = async (q)=>{
      if(!q){ hideSuggest(); return; }
      try{
        const r = await j('/admin/venues?query='+encodeURIComponent(q));
        const items = (r.items||[]);
        let html='';
        if(items.length){
          html += items.slice(0,8).map(v=>\`<div class="suggest-item" data-id="\${v.id}" data-name="\${v.name}" data-city="\${v.city||''}">\${v.name}\${v.city?' – <span class="muted">'+v.city+'</span>':''}</div>\`).join('');
        } else {
          html += '<div class="suggest-empty">No matching venues</div>';
        }
        // Inline create row
        html += \`
          <div class="create-inline">
            <div>Create "<strong>\${escapeHtml(q)}</strong>" as a new venue</div>
            <button class="btn" id="createInlineBtn">Create venue</button>
          </div>\`;
        vsg.innerHTML = html;
        showSuggest();

        // wire up clicks
        vsg.querySelectorAll('.suggest-item').forEach(el=>{
          el.addEventListener('click', ()=>{
            setChosenVenue({ id: el.getAttribute('data-id'), name: el.getAttribute('data-name'), city: el.getAttribute('data-city') });
          });
        });
        const createBtn = $('#createInlineBtn', vsg);
        if(createBtn){
          createBtn.addEventListener('click', ()=>{
            openVenueModal({ presetName: vin.value.trim() });
          });
        }
      }catch(_e){
        hideSuggest();
      }
    };

    const debouncedSearch = debounce(searchVenues, 180);
    debouncedSearch.flush = ()=>searchVenues(vin.value.trim());

    // ------ Venue modal ------
    const back = $('#venueModalBack');
    const closeBtn = $('#venueModalClose');
    const cancelBtn = $('#venueCancel');
    const saveBtn = $('#venueSave');
    const err = $('#vn_err');

    function openVenueModal({presetName=''}={}){
      $('#vn_name').value = presetName;
      $('#vn_city').value = '';
      $('#vn_address').value = '';
      $('#vn_postcode').value = '';
      $('#vn_capacity').value = '';
      $('#vn_phone').value = '';
      $('#vn_website').value = '';
      err.textContent='';
      back.style.display='flex';
      setTimeout(()=>$('#vn_name').focus(), 0);
    }
    function closeVenueModal(){
      back.style.display='none';
    }
    [closeBtn,cancelBtn].forEach(b=>b.addEventListener('click', closeVenueModal));
    back.addEventListener('click', (e)=>{ if(e.target===back) closeVenueModal(); });

    async function saveVenue(){
      err.textContent='';
      const payload = {
        name: $('#vn_name').value.trim(),
        city: $('#vn_city').value.trim() || null,
        address: $('#vn_address').value.trim() || null,
        postcode: $('#vn_postcode').value.trim() || null,
        capacity: $('#vn_capacity').value ? Number($('#vn_capacity').value) : null,
        phone: $('#vn_phone').value.trim() || null,
        website: $('#vn_website').value.trim() || null
      };
      if(!payload.name){ err.textContent='Name is required'; return; }
      try{
        const res = await j('/admin/venues', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(!res?.ok && !res?.id){ throw new Error(res?.error || 'Failed to create venue'); }
        const v = res.id ? res : (res.venue || res.data || res); // be liberal with shapes
        setChosenVenue(v);
        closeVenueModal();
      }catch(e){
        err.textContent = e.message || 'Failed to create venue';
      }
    }
    saveBtn.addEventListener('click', saveVenue);
    // enter submits inside modal
    $$('#venueModalBack input').forEach(inp=>{
      inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') saveVenue(); });
    });

    // ------ Poster upload ------
    const drop=$('#drop'), file=$('#file'), bar=$('#bar'), prev=$('#prev'), imgurl=$('#imgurl'), removeBtn=$('#removeImg');
    const choose=()=>file.click();
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
    removeBtn.addEventListener('click', ()=>{
      imgurl.value = '';
      prev.src = '';
      prev.style.display = 'none';
      removeBtn.style.display = 'none';
      bar.style.width='0%';
    });
    async function doUpload(f){
      $('#err').textContent='';
      bar.style.width='15%';
      try{
        const out = await uploadPoster(f);
        imgurl.value = out.url;
        prev.src = out.url;
        prev.style.display = 'block';
        removeBtn.style.display = 'inline-block';
        bar.style.width='100%';
        setTimeout(()=>bar.style.width='0%', 800);
      }catch(e){
        bar.style.width='0%';
        $('#err').textContent = e.message || 'Upload failed';
      }
    }

    // ------ Create show ------
    $('#create').addEventListener('click', async ()=>{
      $('#err').textContent='';
      try{
        const payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value ? new Date($('#sh_dt').value).toISOString() : null,
          venueId: $('#venue_id').value || null,
          venueName: !$('#venue_id').value && $('#venue_input').value.trim() ? $('#venue_input').value.trim() : null, // optional: server can ignore or use
          imageUrl: $('#imgurl').value.trim() || null,
          description: $('#sh_desc').value.trim() || null,
          ticket: {
            name: $('#t_name').value.trim(),
            pricePounds: $('#t_price').value ? Number($('#t_price').value) : null,
            available: $('#t_alloc').value ? Number($('#t_alloc').value) : null
          }
        };
        if(!payload.title || !payload.date){
          $('#err').textContent='Title and date/time are required';
          return;
        }
        if(!payload.venueId){
          $('#err').textContent='Please choose an existing venue or create one';
          return;
        }
        const r = await j('/admin/shows',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(!r.ok) throw new Error(r.error||'Failed to create show');
        // reset
        ['sh_title','sh_dt','sh_desc','t_name','t_price','t_alloc','venue_input'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        $('#venue_id').value='';
        imgurl.value=''; prev.src=''; prev.style.display='none'; removeBtn.style.display='none'; bar.style.width='0%';
        await loadList();
      }catch(e){
        $('#err').textContent=e.message||'Failed to create show';
      }
    });

    // ------ Shows list ------
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
      }catch(_e){
        $('#lerr').textContent='Failed to load shows';
      }
    }
    $('#refresh').addEventListener('click', loadList);
    loadList();
  }

  // Placeholder tabs
  function venues(){ setMain('<div class="card"><div class="title">Venues</div><div class="muted">Use the Shows tab to search/create venues inline.</div></div>'); }
  function orders(){ setMain('<div class="card"><div class="title">Orders</div><div class="muted">Filters & CSV export are available in Orders view.</div></div>'); }
  function analytics(){ setMain('<div class="card"><div class="title">Analytics</div><div class="muted">Charts coming soon.</div></div>'); }
  function audiences(){ setMain('<div class="card"><div class="title">Audiences</div><div>Coming soon.</div></div>'); }
  function email(){ setMain('<div class="card"><div class="title">Email Campaigns</div><div>Coming soon.</div></div>'); }
  function account(){ setMain('<div class="card"><div class="title">Account</div><div>Manage your login and security (coming soon).</div></div>'); }

  // basic HTML escape for inline display
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  document.addEventListener('click', function(e){
    const a = e.target?.closest && e.target.closest('a.sb-link');
    if(a && a.getAttribute('data-view')){
      e.preventDefault(); history.pushState(null,'',a.getAttribute('href')); route();
    }
  });

  route();
})();
</script>
</body>
</html>`);
});

export default router;
