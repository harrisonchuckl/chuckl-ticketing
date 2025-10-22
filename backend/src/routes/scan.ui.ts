import { Router } from 'express';

export const router = Router();

// Simple HTML page to check/mark tickets by serial.
// Uses fetch() to call /scan/check and /scan/mark with x-admin-key.
router.get('/', (_req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chuckl. Door – Scanner</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; background:#0b0b10; color:#f6f7fb; margin:0; padding:24px; }
    .card { max-width:780px; margin:0 auto; background:#151823; border:1px solid #24283a; border-radius:16px; padding:24px; }
    h1 { margin:0 0 12px; font-size:28px; }
    label { display:block; margin-top:12px; font-size:14px; color:#c6c8d1; }
    input, button, textarea { font-size:16px; }
    input[type=text] { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #30364d; background:#0f1320; color:#fff; }
    .row { display:flex; gap:10px; margin-top:12px; }
    button { padding:10px 14px; border-radius:10px; border:1px solid #30364d; background:#2a3160; color:#fff; cursor:pointer; }
    button.primary { background:#4f46e5; border-color:#4f46e5; }
    pre { background:#0f1320; border:1px solid #20253a; border-radius:10px; padding:12px; overflow:auto; color:#d7dbff; }
    .small { font-size:12px; color:#aab0c6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Chuckl. Door – Scanner</h1>

    <label>Admin Key <span class="small">(x-admin-key)</span></label>
    <input id="adminkey" type="text" placeholder="enter your admin key" />

    <label>Ticket Serial</label>
    <input id="serial" type="text" placeholder="e.g. XPTPMQM6TNX4" />

    <div class="row">
      <button onclick="check()">Check</button>
      <button class="primary" onclick="mark()">Mark as Used</button>
    </div>

    <h3>Result</h3>
    <pre id="out">–</pre>
  </div>

  <script>
    const base = location.origin;

    async function check() {
      const key = (document.getElementById('adminkey').value || '').trim();
      const serial = (document.getElementById('serial').value || '').trim();
      if (!key || !serial) return set('Provide admin key and serial.');
      try {
        const r = await fetch(base + '/scan/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
          body: JSON.stringify({ serial })
        });
        set(await r.text());
      } catch (e) { set(String(e)); }
    }

    async function mark() {
      const key = (document.getElementById('adminkey').value || '').trim();
      const serial = (document.getElementById('serial').value || '').trim();
      if (!key || !serial) return set('Provide admin key and serial.');
      try {
        const r = await fetch(base + '/scan/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
          body: JSON.stringify({ serial })
        });
        set(await r.text());
      } catch (e) { set(String(e)); }
    }

    function set(msg) {
      try { document.getElementById('out').textContent = JSON.stringify(JSON.parse(msg), null, 2); }
      catch { document.getElementById('out').textContent = msg; }
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
