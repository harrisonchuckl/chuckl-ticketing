import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Scanner page (no inline JS; CSP friendly)
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
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;background:#0b0b10;color:#f6f7fb}
    .wrap{max-width:920px;margin:0 auto;padding:20px}
    .card{background:#151823;border:1px solid #24283a;border-radius:16px;padding:18px}
    h1{margin:0 0 10px;font-size:22px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    input,button,label{font-size:15px}
    input{flex:1;min-width:220px;padding:10px;border-radius:10px;border:1px solid #2a2f45;background:#0f1320;color:#fff}
    button{padding:10px 14px;border-radius:10px;border:1px solid #2a2f45;background:#3b82f6;color:#fff;cursor:pointer}
    button.secondary{background:#374151}
    .muted{color:#9aa0aa;font-size:12px;align-self:center}
    video,canvas{width:100%;max-height:360px;background:#000;border-radius:10px;border:1px solid #20253a}
    .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .toggle{display:flex;gap:6px;align-items:center}
    .banner{position:fixed;left:0;right:0;bottom:0;padding:12px 16px;text-align:center;font-weight:600}
    .banner.ok{background:#065f46}      /* green */
    .banner.err{background:#7f1d1d}     /* red */
    .hidden{display:none}
    .pill{background:#0f1320;border:1px solid #20253a;border-radius:999px;padding:6px 10px;font-size:12px;color:#c6c8d1}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Ticket Scanner</h1>

      <div class="row">
        <input id="serial" placeholder="Scan QR or type serial e.g. K9M2WTSNJNHR" />
        <input id="adminkey" placeholder="x-admin-key" />
      </div>

      <div class="row controls">
        <button id="startCam">Start Camera</button>
        <button id="stopCam" class="secondary">Stop</button>
        <span id="camStatus" class="muted">Camera idle</span>
        <span id="decoderMode" class="pill">Decoder: auto</span>
        <label class="toggle">
          <input type="checkbox" id="autoMark" checked />
          Auto-Mark as Used
        </label>
      </div>

      <div class="row">
        <video id="video" playsinline muted></video>
        <canvas id="frame" class="hidden"></canvas>
      </div>

      <div class="row controls">
        <button id="checkBtn">Check</button>
        <button id="markBtn" class="secondary">Mark as Used</button>
        <button id="clearBtn" class="secondary">Clear</button>
      </div>

      <div class="row">
        <span class="muted">Tip: aim at the QR for ~1s; the serial will be read and (if enabled) auto-marked.</span>
      </div>
    </div>
  </div>

  <!-- External (served by us) scripts so CSP is happy -->
  <script src="/assets/jsqr.min.js" defer></script>
  <script src="/assets/scan-ui.js" defer></script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * The page’s JS (no inline code). Uses:
 *  - BarcodeDetector when available (Chrome/Android)
 *  - jsQR fallback (Safari/iOS and others)
 * Also shows green/red bottom banners instead of raw JSON dumps.
 */
router.get('/assets/scan-ui.js', (_req: Request, res: Response) => {
  const js = `(() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const canvas = $('frame');
  const ctx = canvas.getContext('2d');
  const camStatus = $('camStatus');
  const decoderMode = $('decoderMode');

  let stream = null;
  let scanning = false;
  let lastSerial = '';
  const adminKeyMemoryKey = 'chuckl_admin_key';

  // persist admin key locally
  const savedKey = localStorage.getItem(adminKeyMemoryKey);
  if (savedKey) $('adminkey').value = savedKey;
  $('adminkey').addEventListener('input', () => {
    const v = $('adminkey').value.trim();
    if (v) localStorage.setItem(adminKeyMemoryKey, v);
  });

  // status banner
  function banner(kind, text) {
    let el = document.getElementById('banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'banner';
      document.body.appendChild(el);
    }
    el.className = 'banner ' + (kind === 'ok' ? 'ok' : 'err');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout((el)._t);
    (el)._t = setTimeout(() => { el.classList.add('hidden'); }, 1500);
  }

  function stripSerial(text){
    let s = (text || '').trim();
    if (!s) return '';
    if (s.toLowerCase().startsWith('chuckl:')) s = s.slice(7);
    return s.toUpperCase();
  }

  async function call(path){
    const serial = $('serial').value.trim();
    const key = $('adminkey').value.trim();
    if (!serial) return banner('err','Missing serial');
    if (!key)    return banner('err','Missing admin key');

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
      if (!res.ok || data?.error) {
        banner('err', data?.error || ('HTTP ' + res.status));
      } else {
        if (path.endsWith('/mark')) banner('ok', 'Checked in ✔');
        else banner('ok', 'Valid ✔');
      }
    } catch(e){
      banner('err', 'Network error');
    }
  }

  $('checkBtn').onclick = () => call('/scan/check');
  $('markBtn').onclick  = () => call('/scan/mark');
  $('clearBtn').onclick = () => { lastSerial=''; $('serial').value=''; };

  $('startCam').onclick = async () => {
    try {
      if (!('mediaDevices' in navigator)) {
        camStatus.textContent = 'Camera not supported';
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }});
      video.srcObject = stream;
      await video.play();
      camStatus.textContent = 'Camera running…';
      startLoop();
    } catch (e) {
      camStatus.textContent = 'Camera error: ' + String(e);
    }
  };

  $('stopCam').onclick = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    scanning = false;
    camStatus.textContent = 'Camera stopped.';
  };

  let useBarcodeDetector = false;
  async function startLoop(){
    scanning = true;

    // choose decoder
    useBarcodeDetector = 'BarcodeDetector' in window;
    decoderMode.textContent = 'Decoder: ' + (useBarcodeDetector ? 'BarcodeDetector' : 'jsQR');

    const detector = useBarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;

    const tick = async () => {
      if (!scanning || !video.videoWidth) return;

      try {
        if (useBarcodeDetector && detector) {
          const codes = await detector.detect(video);
          if (codes && codes.length) handleDetected(codes[0].rawValue || '');
        } else if (window.jsQR) {
          // draw frame to canvas
          const w = video.videoWidth;
          const h = video.videoHeight;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const res = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (res && res.data) handleDetected(res.data);
        }
      } catch(_e) { /* ignore frame errors */ }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function handleDetected(text){
    const serial = stripSerial(text);
    if (!serial || serial === lastSerial) return;
    lastSerial = serial;
    $('serial').value = serial;

    if ($('autoMark').checked) {
      call('/scan/mark');
    } else {
      banner('ok', 'Scanned: ' + serial);
    }
  }
})();`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(js);
});

/**
 * Serve a local, minified jsQR build so we don't rely on CDNs.
 * (This is a trimmed official build header + minified body.)
 * If you ever want to update it, replace the string with the latest jsQR.min.js.
 */
router.get('/assets/jsqr.min.js', (_req: Request, res: Response) => {
  const jsqr = `/* jsQR v1.4.0 | MIT | https://github.com/cozmo/jsQR */!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).jsQR=t()}(this,(function(){"use strict";function e(e,t){return e<<t|e>>>32-t}function t(e,t){return e&~t|~e&t}/* …(minified contents omitted for brevity in this comment)… */;return function(e,t,r,n){/* jsQR entry */return function(e,t,r){/* huge minified function body */}(e,t,r)}}));`;
  // NOTE: the above is a placeholder header to keep this reply concise.
  // In your repo, paste the full official jsQR.min.js content here.
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(jsqr);
});

export default router;
