// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

/**
 * NOTE: This UI route should NOT require x-admin-key
 * It simply serves the admin HTML dashboard. Authentication
 * happens within the page when it makes API calls.
 */
router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px;margin-bottom:14px}
  h1{font-size:22px;margin:0 0 12px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .col{flex:1 1 260px}
  button{appearance:none;border:0;border-radius:10px;padding:10px 12px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  .muted{color:#9aa0b5}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>
      <div class="row">
        <div class="col">
          <label>Admin Key</label>
          <input id="adminkey" type="text" placeholder="enter your admin key"/>
        </div>
        <div class="col" style="align-self:flex-end">
          <button id="loadShowsBtn">Load latest shows</button>
        </div>
      </div>
      <p class="muted" id="hint">Shows load from /admin/shows/latest (limit 20). Use your admin key to authenticate requests.</p>
    </div>
    <div id="shows"></div>
  </div>

  <script>
    const adminkeyEl = document.getElementById('adminkey');
    const loadBtn = document.getElementById('loadShowsBtn');
    const showsEl = document.getElementById('shows');

    async function api(path, opts={}) {
      const key = adminkeyEl.value.trim();
      const headers = Object.assign({ 'Content-Type':'application/json' }, opts.headers || {});
      if (key) headers['x-admin-key'] = key;
      const r = await fetch(path, { ...opts, headers });
      const j = await r.json().catch(()=>({error:true,message:'Invalid JSON'}));
      if (!r.ok || j.error) throw new Error(j.message || ('HTTP ' + r.status));
      return j;
    }

    loadBtn.addEventListener('click', async () => {
      showsEl.innerHTML = '<p class="muted">Loading…</p>';
      try {
        const data = await api('/admin/shows/latest?limit=20');
        const list = (data.shows || []).map(s =>
          '<div class="card"><strong>' + s.title + '</strong><br><span class="muted">' +
          new Date(s.date).toLocaleString('en-GB') + '</span></div>'
        ).join('');
        showsEl.innerHTML = list || '<p class="muted">No shows found.</p>';
      } catch (e) {
        showsEl.innerHTML = '<p class="muted">Error: ' + e.message + '</p>';
      }
    });
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
