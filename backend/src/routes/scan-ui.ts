import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * GET /scan — serves the scanner UI (no inline JS, so CSP-friendly)
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
    .card{max-width:860px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:20px}
    h1{margin:0 0 12px;font-size:22px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    input,button{font-size:15px}
    input{flex:1;min-width:220px;padding:10px;border-radius:10px;border:1px solid #2a2f45;background:#0f1320;color:#fff}
    button{padding:10px 14px;border-radius:10px;border:1px solid #2a2f45;background:#3b82f6;color:#fff;cursor:pointer}
    button.secondary{background:#374151}
    pre{white-space:pre-wrap;background:#0f1320;border:1px solid #20253a;border-radius:10px;padding:10px;min-height:120px}
    label{font-size:12px;color:#c6c8d1;display:block;margin-bottom:6px}
    video{width:100%;max-height:320px;background:#000;border-radius:10px;border:1px solid #20253a}
    .muted{color:#9aa0aa;font-size:12px}
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
      <button id="startCam">Start Camera</button>
      <button id="stopCam" class="secondary">Stop Camera</button>
      <span class="muted" id="camStatus"></span>
    </div>

    <div class="row">
      <video id="video" playsinline muted></video>
    </div>

    <div class="row">
      <button id="checkBtn">Check</button>
      <button id="markBtn" class="secondary">Mark as Used</button>
      <button id="clearBtn" class="secondary">Clear</button>
    </div>

    <div class="row">
      <pre id="out">{ "hint": "Start camera and point at QR, or type a serial and Check/Mark." }</pre>
    </div>
  </div>

  <script src="/assets/scan-ui.js" defer></script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * GET /assets/scan-ui.js — the page’s JS (separate file so CSP is happy)
 * Uses the browser BarcodeDetector API if available (fast/native).
 */
router.get('/assets/scan-ui.js', (_req: Request, res: Response) => {
  const js = `
(() => {
  const $ = (id) => document.getElementById(id);
  const out = $('out');
  const video = $('video');
  const camStatus = $('camStatus');

  let stream = null;
  let scanning = false;
  let detector = null;
  let lastText = '';
  let adminKeyMemoryKey = 'chuckl_admin_key';

  function print(obj){ out.textContent = JSON.stringify(obj, null, 2); }

  // Persist admin key locally (door staff convenience)
  const savedKey = localStorage.getItem(adminKeyMemoryKey);
  if(savedKey) $('adminkey').value = savedKey;
  $('adminkey').addEventListener('input', () => {
    const v = $('adminkey').value.trim();
    if(v) localStorage.setItem(adminKeyMemoryKey, v);
  });

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
      if (res.ok && path.endsWith('/mark')) {
        // mark success -> briefly show toast-like message
        camStatus.textContent = 'Marked as USED ✔';
        setTimeout(() => camStatus.textContent = '', 1500);
      }
    } catch (e){
      print({ error: 'network_error', detail: String(e) });
    }
  }

  $('checkBtn').onclick = () => call('/scan/check');
  $('markBtn').onclick  = () => call('/scan/mark');
  $('clearBtn').onclick = () => { $('serial').value=''; lastText=''; print({ hint: 'Enter serial + admin key, then Check/Mark.' }); };

  // Camera controls
  $('startCam').onclick = async () => {
    try {
      if (!('mediaDevices' in navigator)) {
        camStatus.textContent = 'Camera not supported on this device/browser.';
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();
      camStatus.textContent = 'Camera running…';
      startDetectLoop();
    } catch (e) {
      camStatus.textContent = 'Camera error: ' + String(e);
    }
  };

  $('stopCam').onclick = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      camStatus.textContent = 'Camera stopped.';
    }
    scanning = false;
  };

  async function startDetectLoop() {
    scanning = true;

    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detector = null;
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tick = async () => {
      if (!scanning || !video.videoWidth) return;
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            const raw = codes[0].rawValue || '';
            handleDetected(raw);
          }
        } else {
          // Simple fallback: sample frame and try rough text scan (no heavy libs)
          // We keep fallback minimal; staff can always type the serial.
        }
      } catch(_e) {/* ignore per frame */}

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function handleDetected(text) {
    if (!text) return;
    // Accept raw serial (e.g. "XPTPMQM6TNX4") or "chuckl:<serial>" format
    let serial = text.trim();
    if (serial.toLowerCase().startsWith('chuckl:')) serial = serial.slice(7);

    if (serial && serial !== lastText) {
      lastText = serial;
      $('serial').value = serial;
      print({ scanned: serial });
      // Auto-check on scan
      $('checkBtn').click();
    }
  }
})();
`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(js);
});

export default router;
