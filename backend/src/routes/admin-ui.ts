// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Lightweight HTML admin shell.
 * - Accepts ?k=<adminKey> to prefill
 * - Posts JSON to /admin/shows/latest, /admin/venues, etc. with x-admin-key
 */
router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;background:#0b0b10;color:#e8ebf7;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
  .wrap{max-width:900px;margin:28px auto;padding:0 16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input[type=text]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:16px}
  button{appearance:none;border:0;border-radius:10px;padding:10px 14px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .list{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .item{background:#0f1220;border:1px solid #22263a;border-radius:10px;padding:12px}
  .muted{color:#9aa0b5;font-size:12px}
  .err{color:#ffd7d9}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>
      <label>Admin Key</label>
      <input id="adminkey" type="text" placeholder="enter admin key (or use ?k=...)" />
      <div class="row">
        <button id="loadBtn">Load latest shows</button>
      </div>
      <p class="muted">Shows load from <code>/admin/shows/latest</code> (limit 20). Your key is sent as <code>x-admin-key</code>.</p>
      <p class="muted" id="error"></p>
    </div>

    <div class="list" id="list"></div>
  </div>

<script>
const q = new URLSearchParams(location.search);
if (q.get('k')) document.getElementById('adminkey').value = q.get('k');

const errEl = document.getElementById('error');
const listEl = document.getElementById('list');

function showError(msg){ errEl.textContent = 'Error: ' + msg; errEl.className='muted err'; }
function clearError(){ errEl.textContent=''; errEl.className='muted'; }

async function loadShows(){
  clearError();
  listEl.innerHTML = '';
  const key = (document.getElementById('adminkey').value || '').trim();
  if(!key){ showError('Admin key required'); return; }
  try{
    const r = await fetch('/admin/shows/latest?limit=20', { headers: { 'x-admin-key': key }});
    if(!r.ok){
      const t = await r.text();
      showError('HTTP ' + r.status + ' – ' + t);
      return;
    }
    const data = await r.json();
    if(!data.ok){ showError(data.message || 'Invalid JSON'); return; }
    const shows = data.shows || [];
    for(const s of shows){
      const when = new Date(s.date).toLocaleString('en-GB');
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = '<strong>' + s.title + '</strong><br/><span class="muted">' + when + '</span>';
      listEl.appendChild(div);
    }
  }catch(e){
    showError(String(e && e.message || e));
  }
}

document.getElementById('loadBtn').addEventListener('click', loadShows);
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
