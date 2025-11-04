// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

export const router = Router();

router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Chuckl. Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:960px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #23263b;border-radius:14px;padding:20px}
  h1{font-size:22px;margin:0 0 12px}
  label{display:block;margin:10px 0 6px;font-size:13px;color:#9aa0b5}
  input,select,textarea{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  textarea{resize:vertical;min-height:80px}
  button{border:0;border-radius:10px;padding:10px 16px;font-weight:600;cursor:pointer}
  .primary{background:#4053ff;color:#fff}
  .secondary{background:#2a2f46;color:#fff}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .row>*{flex:1}
  .list{margin-top:14px;display:flex;flex-direction:column;gap:10px}
  .show{background:#0f1220;border:1px solid #23263b;border-radius:10px;padding:12px}
  .title{font-weight:700}
  .sub{font-size:12px;color:#9aa0b5}
  details{margin-top:6px}
  summary{cursor:pointer}
  .drawer{margin-top:14px;border-top:1px dashed #2a2f46;padding-top:14px;display:none}
  .toast{position:fixed;bottom:12px;left:12px;right:12px;padding:12px 14px;border-radius:10px;font-weight:600;text-align:center;display:none}
  .toast.ok{background:#0f5132;color:#c7f5d5;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Chuckl. Admin</h1>

    <label>Admin Key</label>
    <input id="adminkey" type="text" placeholder="Enter your admin key" />

    <div class="row" style="margin-top:10px">
      <button class="primary" id="loadBtn">Load latest shows</button>
      <button class="secondary" id="toggleCreate">Create new show</button>
    </div>
    <p style="font-size:12px;color:#9aa0b5">Shows load from <code>/admin/shows/latest</code> (limit 20). Your key is sent as <code>x-admin-key</code>.</p>

    <div id="createDrawer" class="drawer">
      <h3 style="margin:0 0 8px">Create Show</h3>
      <div class="row">
        <div><label>Title</label><input id="title" type="text" /></div>
        <div><label>Date & Time</label><input id="date" type="datetime-local" /></div>
      </div>

      <label>Venue</label>
      <div class="row">
        <select id="venueSelect"><option>Loading venues...</option></select>
        <button class="secondary" id="refreshVenues">↻</button>
      </div>

      <label>Description</label>
      <textarea id="desc"></textarea>

      <h4 style="margin:10px 0 4px">Ticket Type</h4>
      <div class="row">
        <div><label>Name</label><input id="ttName" value="General Admission" /></div>
        <div><label>Price (pence)</label><input id="ttPrice" type="number" value="2000" /></div>
        <div><label>Available</label><input id="ttAvail" type="number" placeholder="auto" /></div>
      </div>

      <div class="row" style="margin-top:10px">
        <button class="primary" id="createBtn">Create Show</button>
        <button class="secondary" id="cancelCreate">Cancel</button>
      </div>
    </div>

    <div id="list" class="list"></div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
const $ = (s)=>document.querySelector(s);
const keyEl=$('#adminkey'),list=$('#list'),toast=$('#toast');

function showToast(msg,ok=true){toast.textContent=msg;toast.className='toast '+(ok?'ok':'err');toast.style.display='block';setTimeout(()=>toast.style.display='none',3000);}

async function api(p,opt={}){const k=keyEl.value.trim();const h={'Content-Type':'application/json',...(k?{'x-admin-key':k}:{})};const r=await fetch(p,{...opt,headers:h});const t=await r.text();try{return JSON.parse(t);}catch(e){return{error:true,message:'Invalid JSON',raw:t};}}

async function loadVenues(){const r=await api('/admin/venues');const sel=$('#venueSelect');sel.innerHTML='';if(!r||r.error){sel.innerHTML='<option>Failed</option>';return;}r.venues.forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name+(v.city?' ('+v.city+')':'');o.dataset.capacity=v.capacity||'';sel.appendChild(o);});}

function showCard(s){const v=s.venue?[\`\${s.venue.name}\`,s.venue.city,s.venue.postcode].filter(Boolean).join(', '):'';const tt=(s.ticketTypes||[]).map(t=>\`\${t.name} £\${(t.pricePence/100).toFixed(2)}\`).join(' · ')||'No tickets';const el=document.createElement('div');el.className='show';el.innerHTML=\`<div class='title'>\${s.title}</div><div class='sub'>\${new Date(s.date).toLocaleString()} — \${v}</div><details><summary>Details</summary><div>Tickets: \${s._count?.tickets||0}, Orders: \${s._count?.orders||0}</div><div>\${tt}</div></details>\`;return el;}

async function loadShows(){list.innerHTML='';const r=await api('/admin/shows/latest?limit=20');if(!r||r.error)return showToast(r?.message||'Failed',false);r.shows.forEach(s=>list.appendChild(showCard(s)));}

$('#loadBtn').onclick=loadShows;
$('#toggleCreate').onclick=async()=>{const d=$('#createDrawer');d.style.display=d.style.display==='none'?'block':'none';if(d.style.display==='block')await loadVenues();};
$('#cancelCreate').onclick=()=>$('#createDrawer').style.display='none';
$('#refreshVenues').onclick=loadVenues;

$('#createBtn').onclick=async()=>{
  const payload={title:$('#title').value.trim(),description:$('#desc').value.trim()||null,date:new Date($('#date').value).toISOString(),venueId:$('#venueSelect').value,ticketType:{name:$('#ttName').value.trim(),pricePence:Number($('#ttPrice').value),available:$('#ttAvail').value?Number($('#ttAvail').value):null}};
  if(!payload.title||!payload.date||!payload.venueId)return showToast('Missing fields',false);
  const r=await api('/admin/shows',{method:'POST',body:JSON.stringify(payload)});
  if(r&&r.ok){showToast('Created');$('#createDrawer').style.display='none';loadShows();}else showToast(r?.message||'Error',false);
};

(function(){const k=localStorage.getItem('adminkey');if(k)keyEl.value=k;keyEl.addEventListener('input',()=>localStorage.setItem('adminkey',keyEl.value));})();
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
