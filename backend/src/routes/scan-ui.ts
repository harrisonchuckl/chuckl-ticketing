import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Minimal scanning UI at GET /scan
 * - Lets a door staffer enter a ticket serial
 * - Calls /scan/check and /scan/mark using your x-admin-key
 * NOTE: This UI only wraps the API you already have.
 */
router.get('/scan', (_req: Request, res: Response) => {
  const html = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chuckl. Ticket Scanner</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root{color-scheme:dark}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:24px;background:#0b0b10;color:#f6f7fb}
    .card{max-width:760px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:20px}
    h1{margin:0 0 12px;font-size:22px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    input,button{font-size:15px}
    input{flex:1;min-width:220px;padding:10px;border-radius:10px;border:1px solid #2a2f45;background:#0f1320;color:#fff}
    button{padding:10px 14px;border-radius:10px;border:1px solid #2a2f45;background:#3b82f6;color:#fff;cursor:pointer}
    button.secondary{background:#374151}
    pre{white-space:pre-wrap;background:#0f1320;border:1px solid #20253a;border-radius:10px;padding:10px;min-height:80px}
    label{font-size:12px;color:#c6c8d1;display:block;margin-bottom:6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Chuckl. Ticket Scanner</h1>

    <div class="row">
      <div style="flex:2">
        <label>Ticket Serial</label>
        <input id="serial" placeholder="e.g. XPTPMQM6TNX4" />
      </div>
      <div style="flex:2">
        <label>Admin Key (x-admin-key)</label>
        <input id="adminkey" placeholder="your admin key" />
      </div>
    </div>

    <div class="row">
      <button id="checkBtn">Check</button>
      <button id="markBtn" class="secondary">Mark as Used</button>
      <button id="clearBtn" class="secondary">Clear</button>
    </div>

    <div class="row">
      <pre id="out">{ "hint": "Enter serial + admin key, then Check/Mark." }</pre>
    </div>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    const out = $('out');
    function print(obj){ out.textContent = JSON.stringify(obj, null, 2); }

    async function call(path){
      const serial = $('serial').value.trim();
      const key = $('adminkey').value.trim();
      if(!serial) return print({ error: 'missing_serial' });
      if(!key) return print({ error: 'missing_admin_key' });

      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': key
          },
          body: JSON.stringify({ serial })
        });
        const data = await res.json();
        print({ status: res.status, data });
      } catch (e){
        print({ error: 'network_error', detail: String(e) });
      }
    }

    $('checkBtn').onclick = () => call('/scan/check');
    $('markBtn').onclick  = () => call('/scan/mark');
    $('clearBtn').onclick = () => print({ hint: 'Enter serial + admin key, then Check/Mark.' });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
