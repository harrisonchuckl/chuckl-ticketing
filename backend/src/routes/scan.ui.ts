import { Router } from 'express';

export const router = Router();

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Chuckl. | Scanner</title>
<style>
  :root { color-scheme: dark; }
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;background:#0b0b10;color:#f6f7fb}
  .wrap{max-width:720px;margin:32px auto;padding:0 16px}
  .card{background:#151823;border:1px solid #24283a;border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  h1{margin:0 0 12px;font-size:22px}
  p{margin:6px 0;color:#c6c8d1}
  label{display:block;margin:10px 0 6px;color:#c6c8d1}
  input[type=text]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2b3046;background:#0f1320;color:#eaf0ff;font-size:16px}
  .row{display:flex;gap:10px;margin-top:12px}
  button{padding:10px 14px;border-radius:10px;border:1px solid #2b3046;background:#29304a;color:#fff;cursor:pointer}
  button.primary{background:#4f46e5}
  .res{margin-top:16px;padding:14px;border-radius:12px;border:1px solid #2b3046;background:#0f1320}
  .ok{border-color:#1f6e39;background:#0f1a14}
  .warn{border-color:#8a2c2c;background:#1b0f10}
  code{background:#0b0f1a;border:1px solid #20253a;padding:.2em .45em;border-radius:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .kv{background:#111527;border:1px solid #252a3e;border-radius:10px;padding:10px}
  .kv b{display:block;color:#9aa2bf;margin-bottom:4px;font-weight:600}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Chuckl. Ticket Scanner</h1>
    <p>Paste or scan a ticket <code>serial</code>. Then <b>Check</b> and <b>Mark Used</b>.</p>

    <label for="key">Admin key (x-admin-key)</label>
    <input id="key" type="text" placeholder="ashdb77asjkh" />

    <label for="serial">Ticket serial</label>
    <input id="serial" type="text" placeholder="e.g. XPTPMQM6TNX4" autofocus />

    <div class="row">
      <button class="primary" id="btnCheck">Check</button>
      <button id="btnMark">Mark used</button>
      <button id="btnClear">Clear</button>
    </div>

    <div id="out" class="res" style="display:none"></div>
  </div>
</div>

<script>
const $ = (s)=>document.querySelector(s);
const out = $('#out');

function show(obj, kind){
  out.style.display = 'block';
  out.className = 'res ' + (kind||'');
  out.innerHTML = '';
  if (obj.error) {
    out.innerHTML = '<b>Error:</b> ' + obj.error;
    return;
  }
  if (obj.ticket) {
    const t = obj.ticket, show = obj.show || {};
    out.innerHTML = \`
      <div class="grid">
        <div class="kv"><b>Status</b><span>\${t.status}</span></div>
        <div class="kv"><b>Serial</b><code>\${t.serial}</code></div>
        <div class="kv"><b>Scanned at</b><span>\${t.scannedAt || '—'}</span></div>
        <div class="kv"><b>Purchaser</b><span>\${t.purchaser || '—'}</span></div>
      </div>
      <div class="grid">
        <div class="kv"><b>Show</b><span>\${show.title || '—'}</span></div>
        <div class="kv"><b>Date</b><span>\${show.date || '—'}</span></div>
        <div class="kv"><b>Venue</b><span>\${show.venue?.name || '—'}</span></div>
        <div class="kv"><b>Address</b><span>\${[show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', ') || '—'}</span></div>
      </div>
    \`;
  } else {
    out.innerHTML = '<pre>'+JSON.stringify(obj,null,2)+'</pre>';
  }
}

async function post(path){
  const key = $('#key').value.trim();
  const serial = $('#serial').value.trim();
  if (!key) return show({ error:'Enter admin key'},'warn');
  if (!serial) return show({ error:'Enter a serial'},'warn');
  try {
    const res = await fetch(path, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-admin-key': key },
      body: JSON.stringify({ serial })
    });
    const json = await res.json();
    if (!res.ok) return show({ error: json?.error || res.statusText }, 'warn');
    if (json.status === 'USED' || json.ok) return show(json, 'ok');
    return show(json);
  } catch (e) {
    show({ error: String(e) }, 'warn');
  }
}

$('#btnCheck').onclick = ()=>post('/scan/check');
$('#btnMark').onclick = ()=>post('/scan/mark');
$('#btnClear').onclick = ()=>{
  $('#serial').value=''; out.style.display='none'; out.className='res'; out.innerHTML='';
  $('#serial').focus();
};
</script>
</body>
</html>`;

router.get('/', (_req, res) => {
  res.type('html').send(HTML);
});
