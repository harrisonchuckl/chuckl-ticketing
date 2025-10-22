import { Router } from 'express';

export const router = Router();

// Super-lightweight check-in UI (manual input)
// Uses your existing JSON endpoints: POST /scan/check and POST /scan/mark
router.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Chuckl. Scanner</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#f6f7fb;margin:0;padding:24px}
  .wrap{max-width:720px;margin:0 auto}
  .card{background:#151823;border:1px solid #24283a;border-radius:16px;padding:20px}
  h1{margin:0 0 12px;font-size:24px}
  label{display:block;margin:12px 0 6px;color:#c6c8d1}
  input{width:100%;padding:10px;border-radius:8px;border:1px solid #2a2f45;background:#0f1320;color:#fff}
  .row{display:flex;gap:10px;margin-top:12px}
  button{padding:10px 14px;border-radius:10px;border:0;background:#4f46e5;color:#fff;cursor:pointer}
  pre{white-space:pre-wrap;background:#0f1320;border:1px solid #20253a;border-radius:8px;padding:12px;margin-top:14px}
  small{color:#9aa0b5}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. – Door Scanner</h1>
      <label for="serial">Ticket serial</label>
      <input id="serial" placeholder="e.g. XPTPMQM6TNX4" />
      <div class="row">
        <button id="check">Check</button>
        <button id="mark">Mark used</button>
      </div>
      <pre id="out">Ready</pre>
      <small>Tip: paste the serial from the email. This UI calls <code>/scan/check</code> and <code>/scan/mark</code>.</small>
    </div>
  </div>
<script>
const out = document.getElementById('out');
const input = document.getElementById('serial');

async function post(path){
  const serial = input.value.trim();
  if(!serial){ out.textContent = 'Enter a serial'; return; }
  out.textContent = 'Working...';
  try{
    const res = await fetch(path,{ method:'POST', headers:{ 'Content-Type':'application/json','x-admin-key':'${process.env.ADMIN_KEY || 'ashdb77asjkh'}' }, body: JSON.stringify({ serial }) });
    const json = await res.json();
    out.textContent = JSON.stringify(json,null,2);
  }catch(e){ out.textContent = 'Error: '+(e?.message || e); }
}
document.getElementById('check').onclick = () => post('/scan/check');
document.getElementById('mark').onclick = () => post('/scan/mark');
</script>
</body>
</html>`);
});

export default router;
