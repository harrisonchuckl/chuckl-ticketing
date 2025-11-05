// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Public Admin UI HTML (no auth). The UI itself calls JSON endpoints with x-admin-key.
 * Path: GET /admin/ui
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
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; background:#0b0b10; color:#e8ebf7; }
  .wrap { max-width: 900px; margin: 24px auto; padding: 16px; }
  .card { background:#141724; border:1px solid #22263a; border-radius:14px; padding:16px; }
  h1 { font-size:20px; margin:0 0 12px; }
  label { display:block; font-size:12px; color:#9aa0b5; margin:8px 0 6px; }
  input[type=text] { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #2a2f46; background:#0f1220; color:#e8ebf7; font-size:16px; }
  button { appearance:none; border:0; border-radius:10px; padding:10px 14px; background:#4053ff; color:#fff; font-weight:600; cursor:pointer; }
  button.secondary { background:#2a2f46; }
  .row { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
  .show { padding:12px; border-radius:10px; background:#0f1220; border:1px solid #22263a; margin-top:10px; cursor:pointer; }
  .err { color:#ffb3b8; margin-top:8px; font-size:13px; }
  .small { color:#9aa0b5; font-size:12px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>

      <label>Admin Key</label>
      <input id="adminkey" type="text" placeholder="enter admin key (x-admin-key)" />

      <div class="row">
        <button id="loadBtn">Load latest shows</button>
      </div>

      <p class="small">Shows load from /admin/shows/latest (limit 20). Your key is sent as x-admin-key.</p>
      <div id="error" class="err" style="display:none"></div>
    </div>

    <div id="shows"></div>
  </div>

  <script>
    const keyEl = document.getElementById('adminkey');
    const errEl = document.getElementById('error');
    const showsEl = document.getElementById('shows');

    document.getElementById('loadBtn').addEventListener('click', loadShows);

    async function loadShows() {
      errEl.style.display = 'none';
      errEl.textContent = '';
      showsEl.innerHTML = '';

      const key = keyEl.value.trim();
      if (!key) {
        errEl.textContent = 'Please enter admin key.';
        errEl.style.display = 'block';
        return;
      }

      try {
        const r = await fetch('/admin/shows/latest?limit=20', {
          headers: { 'x-admin-key': key }
        });
        const data = await r.json();
        if (!data || data.error) {
          throw new Error(data?.message || 'Invalid JSON');
        }
        if (!Array.isArray(data.shows)) {
          throw new Error('Unexpected response');
        }
        for (const s of data.shows) {
          const div = document.createElement('div');
          div.className = 'show';
          const dt = new Date(s.date);
          const when = dt.toLocaleString('en-GB');
          div.textContent = \`\${s.title}\\n\${when}\`;
          div.onclick = () => alert('More actions coming next: view, email, scan, ticket types, etc.');
          showsEl.appendChild(div);
        }
      } catch (e) {
        errEl.textContent = 'Error: ' + (e?.message || e || 'Unknown');
        errEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
