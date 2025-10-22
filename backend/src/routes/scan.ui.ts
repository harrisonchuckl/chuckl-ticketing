import { Router } from 'express';

export const router = Router();

// Simple HTML page so you can test /scan/check and /scan/mark from a browser.
// Requires x-admin-key (your BOOTSTRAP_KEY) to be set in the form.
router.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Chuckl. Scanner</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:24px;background:#0b0b10;color:#f6f7fb}
    .card{max-width:700px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:24px}
    input,button{font:inherit}
    input{width:100%;padding:10px;border-radius:10px;border:1px solid #303652;background:#0e1018;color:#f6f7fb}
    button{margin-top:8px;padding:10px 14px;border-radius:10px;border:1px solid #3a3f63;background:#4f46e5;color:white;cursor:pointer}
    .row{display:flex;gap:10px;margin-top:12px}
    .row > *{flex:1}
    pre{background:#0e1018;border:1px solid #2a2f4a;border-radius:12px;padding:12px;white-space:pre-wrap}
    label{display:block;margin:8px 0 6px;color:#c6c8d1}
  </style>
</head>
<body>
  <div class="card">
    <h1>Chuckl. Scanner</h1>
    <p>Paste a ticket <b>serial</b> and your <b>x-admin-key</b> (same as BOOTSTRAP_KEY) to check or mark tickets.</p>

    <label>Admin Key (x-admin-key)</label>
    <input id="adminKey" placeholder="ashdb77asjkh" value="" />

    <label>Ticket Serial</label>
    <input id="serial" placeholder="e.g. XPTPMQM6TNX4" />

    <div class="row">
      <button onclick="doCheck()">Check</button>
      <button onclick="doMark()">Mark USED</button>
    </div>

    <h3>Result</h3>
    <pre id="out">{}</pre>
  </div>

<script>
async function doCheck(){
  const serial = document.getElementById('serial').value.trim();
  const key = document.getElementById('adminKey').value.trim();
  const res = await fetch('/scan/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ serial })
  });
  document.getElementById('out').textContent = await res.text();
}

async function doMark(){
  const serial = document.getElementById('serial').value.trim();
  const key = document.getElementById('adminKey').value.trim();
  const res = await fetch('/scan/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ serial })
  });
  document.getElementById('out').textContent = await res.text();
}
</script>

</body>
</html>`);
});
