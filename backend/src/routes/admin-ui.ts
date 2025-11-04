// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', async (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin Dashboard</title>
<style>
  :root { color-scheme: dark; }
  body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b10;color:#e8ebf7;margin:0;padding:20px;}
  h1{font-size:24px;margin-bottom:20px}
  h2{font-size:18px;margin-top:20px}
  input,select,textarea{width:100%;padding:10px;margin:6px 0;border-radius:8px;border:1px solid #2a2f46;background:#141724;color:#e8ebf7}
  button{padding:10px 14px;border:0;border-radius:8px;background:#4053ff;color:white;font-weight:600;cursor:pointer}
  .card{background:#141724;padding:20px;border-radius:14px;margin-bottom:20px;border:1px solid #22263a}
  .tabs button{margin-right:10px}
  .hidden{display:none}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{padding:8px;border-bottom:1px solid #2a2f46;text-align:left}
  .toast{position:fixed;bottom:20px;left:20px;right:20px;padding:12px 14px;border-radius:10px;font-weight:600;display:none}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
</style>
</head>
<body>
  <h1>Chuckl. Admin Dashboard</h1>
  <div class="tabs">
    <button id="tabShows">🎭 Shows</button>
    <button id="tabVenues">🏛️ Venues</button>
  </div>

  <div id="showsTab">
    <div class="card">
      <h2>Create New Show</h2>
      <label>Admin Key</label><input id="adminKey" type="text" placeholder="Enter admin key">
      <label>Title</label><input id="title" type="text" placeholder="Show title">
      <label>Date & Time</label><input id="date" type="datetime-local">
      <label>Venue</label><select id="venue"></select>
      <label>Ticket Price (£)</label><input id="ticketPrice" type="number" placeholder="e.g. 25">
      <label>Image URL</label><input id="imageUrl" type="url" placeholder="https://...">
      <label>Description</label><textarea id="description"></textarea>
      <label>Capacity (optional)</label><input id="capacity" type="number">
      <button id="createShow">Create Show</button>
    </div>
  </div>

  <div id="venuesTab" class="hidden">
    <div class="card">
      <h2>Add New Venue</h2>
      <label>Name</label><input id="venueName" type="text">
      <label>Address</label><input id="venueAddress" type="text">
      <label>City</label><input id="venueCity" type="text">
      <label>Postcode</label><input id="venuePostcode" type="text">
      <label>Capacity</label><input id="venueCapacity" type="number">
      <button id="addVenue">Add Venue</button>
    </div>

    <div class="card">
      <h2>Existing Venues</h2>
      <table id="venueTable">
        <thead><tr><th>Name</th><th>City</th><th>Capacity</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const toast = document.getElementById('toast');
    function showToast(msg, ok=true){toast.textContent=msg;toast.className='toast '+(ok?'ok':'err');toast.style.display='block';setTimeout(()=>toast.style.display='none',5000)}

    const tabShows=document.getElementById('tabShows');
    const tabVenues=document.getElementById('tabVenues');
    const showsTab=document.getElementById('showsTab');
    const venuesTab=document.getElementById('venuesTab');
    tabShows.onclick=()=>{showsTab.classList.remove('hidden');venuesTab.classList.add('hidden')}
    tabVenues.onclick=()=>{venuesTab.classList.remove('hidden');showsTab.classList.add('hidden');loadVenues()}

    async function loadVenues(){
      const key=document.getElementById('adminKey').value.trim();
      const res=await fetch('/admin/venues/list',{headers:{'x-admin-key':key}});
      const data=await res.json();
      const tbody=document.querySelector('#venueTable tbody');
      tbody.innerHTML='';
      if(data.ok&&data.venues){
        data.venues.forEach(v=>{
          const tr=document.createElement('tr');
          tr.innerHTML=\`<td>\${v.name}</td><td>\${v.city||''}</td><td>\${v.capacity||''}</td><td><button data-id="\${v.id}">Delete</button></td>\`;
          tr.querySelector('button').onclick=()=>deleteVenue(v.id);
          tbody.appendChild(tr);
        });
      }
    }

    async function deleteVenue(id){
      const key=document.getElementById('adminKey').value.trim();
      if(!confirm('Delete this venue?'))return;
      const res=await fetch('/admin/venues/'+id,{method:'DELETE',headers:{'x-admin-key':key}});
      const data=await res.json();
      if(data.ok){showToast('Venue deleted');loadVenues()}else{showToast('Error deleting venue',false)}
    }

    document.getElementById('addVenue').onclick=async()=>{
      const key=document.getElementById('adminKey').value.trim();
      const name=document.getElementById('venueName').value.trim();
      const address=document.getElementById('venueAddress').value.trim();
      const city=document.getElementById('venueCity').value.trim();
      const postcode=document.getElementById('venuePostcode').value.trim();
      const capacity=document.getElementById('venueCapacity').value.trim();
      const res=await fetch('/admin/venues/create',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({name,address,city,postcode,capacity})});
      const data=await res.json();
      if(data.ok){showToast('Venue added ✅');loadVenues()}else{showToast(data.message||'Error adding venue',false)}
    }

    async function fetchVenuesForShow(){
      const res=await fetch('/admin/venues');
      const data=await res.json();
      if(data.ok&&data.venues){
        const sel=document.getElementById('venue');
        sel.innerHTML=data.venues.map(v=>\`<option value="\${v.id}">\${v.name}</option>\`).join('');
      }
    }

    document.getElementById('createShow').onclick=async()=>{
      const key=document.getElementById('adminKey').value.trim();
      const title=document.getElementById('title').value.trim();
      const date=document.getElementById('date').value;
      const venueId=document.getElementById('venue').value;
      const ticketPrice=document.getElementById('ticketPrice').value;
      const imageUrl=document.getElementById('imageUrl').value;
      const description=document.getElementById('description').value;
      const capacity=document.getElementById('capacity').value;
      if(!key||!title||!date||!venueId)return showToast('Missing required fields',false);
      const res=await fetch('/admin/show/create',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({title,date,venueId,ticketPrice,imageUrl,description,capacity})});
      const data=await res.json();
      if(data.ok)showToast('Show created ✅');else showToast(data.message||'Error creating show',false);
    }

    fetchVenuesForShow();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
