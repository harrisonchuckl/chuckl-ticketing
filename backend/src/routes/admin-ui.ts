// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', async (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b10;color:#e8ebf7;margin:0;padding:20px;}
  h1{font-size:24px;margin-bottom:10px}
  h2{font-size:18px;margin-top:30px}
  input,select,textarea{width:100%;padding:10px;margin:6px 0;border-radius:8px;border:1px solid #2a2f46;background:#141724;color:#e8ebf7}
  button{padding:10px 14px;border:0;border-radius:8px;background:#4053ff;color:white;font-weight:600;cursor:pointer}
  .card{background:#141724;padding:20px;border-radius:14px;margin-bottom:20px;border:1px solid #22263a}
  .toast{position:fixed;bottom:20px;left:20px;right:20px;padding:12px 14px;border-radius:10px;font-weight:600;display:none}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
</style>
</head>
<body>
  <h1>Chuckl. Admin Dashboard</h1>

  <div class="card">
    <h2>Create New Show</h2>
    <label>Admin Key</label>
    <input id="adminKey" type="text" placeholder="Enter admin key">

    <label>Title</label>
    <input id="title" type="text" placeholder="Show title">

    <label>Date & Time</label>
    <input id="date" type="datetime-local">

    <label>Venue</label>
    <select id="venue"></select>

    <label>Ticket Price (£)</label>
    <input id="ticketPrice" type="number" placeholder="e.g. 25">

    <label>Image URL</label>
    <input id="imageUrl" type="url" placeholder="https://...">

    <label>Description</label>
    <textarea id="description" placeholder="Show description"></textarea>

    <label>Capacity (leave blank to use venue capacity)</label>
    <input id="capacity" type="number" placeholder="Optional override">

    <button id="createBtn">Create Show</button>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const toast = document.getElementById('toast');
    function showToast(msg, ok=true) {
      toast.textContent = msg;
      toast.className = 'toast ' + (ok ? 'ok' : 'err');
      toast.style.display = 'block';
      setTimeout(()=> toast.style.display='none', 5000);
    }

    async function fetchVenues() {
      const res = await fetch('/admin/venues');
      const data = await res.json();
      if (data.ok && data.venues) {
        const sel = document.getElementById('venue');
        sel.innerHTML = data.venues.map(v => 
          \`<option value="\${v.id}">\${v.name} (\${v.city || ''})</option>\`
        ).join('');
      }
    }

    document.getElementById('createBtn').addEventListener('click', async () => {
      const key = document.getElementById('adminKey').value.trim();
      const title = document.getElementById('title').value.trim();
      const date = document.getElementById('date').value;
      const venueId = document.getElementById('venue').value;
      const ticketPrice = document.getElementById('ticketPrice').value;
      const imageUrl = document.getElementById('imageUrl').value;
      const description = document.getElementById('description').value;
      const capacity = document.getElementById('capacity').value;

      if (!key || !title || !date || !venueId) {
        return showToast('Missing required fields', false);
      }

      const res = await fetch('/admin/show/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ title, date, venueId, ticketPrice, imageUrl, description, capacity })
      });

      const data = await res.json();
      if (data.ok) {
        showToast('Show created successfully 🎉');
      } else {
        showToast(data.message || 'Error creating show', false);
      }
    });

    fetchVenues();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
