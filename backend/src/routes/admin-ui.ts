// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Simple web-based Admin Dashboard
 * - Enter your Admin Key
 * - Load all shows (/admin/shows)
 * - Displays show list with ID, title, date, venue
 */
router.get('/', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin Dashboard</title>
<style>
  body { font-family: system-ui, -apple-system, Roboto, Arial; background: #0b0b10; color: #e8ebf7; margin: 0; padding: 20px; }
  h1 { font-size: 22px; margin-bottom: 12px; }
  input, button { font-size: 16px; border-radius: 6px; padding: 8px 12px; }
  input { width: 260px; border: 1px solid #444; background: #0f1220; color: #fff; }
  button { background: #4053ff; color: #fff; border: none; cursor: pointer; }
  button:hover { background: #5b6cff; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 10px; text-align: left; border-bottom: 1px solid #22263a; }
  tr:hover { background: #1b1e2d; }
  .small { font-size: 13px; color: #9aa0b5; }
</style>
</head>
<body>
  <h1>Chuckl. Admin Dashboard</h1>
  <label>Admin Key:</label>
  <input id="adminkey" type="text" placeholder="enter admin key"/>
  <button id="loadBtn">Load Shows</button>
  <div id="output"></div>

  <script>
    const out = document.getElementById('output');
    document.getElementById('loadBtn').addEventListener('click', async () => {
      const key = document.getElementById('adminkey').value.trim();
      if (!key) return alert('Enter your admin key');

      out.innerHTML = '<p class="small">Loading shows…</p>';
      const res = await fetch('/admin/shows', { headers: { 'x-admin-key': key } });
      const data = await res.json();
      if (!data.ok) return out.innerHTML = '<p class="small">Failed to load shows</p>';

      const rows = data.shows.map(s => {
        const v = s.venue ? [s.venue.name, s.venue.city].filter(Boolean).join(', ') : '';
        const d = new Date(s.date).toLocaleString('en-GB');
        return \`<tr><td>\${s.id}</td><td>\${s.title}</td><td>\${d}</td><td>\${v}</td></tr>\`;
      }).join('');
      out.innerHTML = \`<table><tr><th>ID</th><th>Title</th><th>Date</th><th>Venue</th></tr>\${rows}</table>\`;
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
