import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/**
 * Minimal ticket scanner UI.
 * Fixes common mobile issues:
 * - Ensures video has a real height
 * - Uses playsinline+muted and explicit video.play()
 * - Requests back camera via facingMode: 'environment'
 * - Adds Permissions-Policy + relaxed CSP for camera + blob:
 * - Keeps page in-place; shows green toast when a scan is accepted
 * - "Tap to Scan" does a one-shot decode using BarcodeDetector (if available)
 */

router.get('/', (_req: Request, res: Response) => {
  // helpful headers for camera + inline script
  res.set({
    'Cache-Control': 'no-store',
    'Permissions-Policy': 'camera=(self)',                  // allow camera on this origin
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "media-src 'self' blob: data:; connect-src 'self';"
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Chuckl. Ticket Scanner</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;background:#0b0b10;color:#e7e9f1;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
  .wrap{max-width:820px;margin:0 auto;padding:16px}
  h1{font-size:22px;margin:0 0 12px}
  .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  input,button,select{
    font:inherit;border-radius:12px;border:1px solid #2a2f45;background:#121523;color:#e7e9f1;
    padding:12px 14px
  }
  button.primary{background:#4f46e5;border-color:#4f46e5}
  button:disabled{opacity:.5}
  .deck{display:grid;grid-template-columns:1fr;gap:10px}
  .panel{border:1px solid #222842;background:#121523;border-radius:16px;padding:12px}
  .videoBox{position:relative;border-radius:16px;overflow:hidden;border:1px solid #222842;background:#000}
  video{
    display:block;width:100%;
    /* Give the element height so you SEE the camera */
    height:52vh; object-fit:cover; background:#000;
  }
  canvas{display:none}
  .stats{display:flex;gap:10px;flex-wrap:wrap}
  .stat{background:#0f1320;border:1px solid #20253a;padding:8px 10px;border-radius:10px;color:#b8bdd5}
  .toast{
    position:fixed;left:12px;right:12px;bottom:14px;
    background:#0f2f16;border:1px solid #1f6d32;color:#c9f3d6;
    padding:12px 14px;border-radius:12px;opacity:0;transform:translateY(10px);
    transition:opacity .25s, transform .25s; pointer-events:none; text-align:center
  }
  .toast.show{opacity:1;transform:translateY(0)}
  .err{background:#2a1010;border-color:#7f2b2b;color:#ffd5d5}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#1b2033;border:1px solid #2a2f45;color:#9aa2c7;font-size:12px}
  .muted{color:#aab; font-size:13px}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Chuckl. Ticket Scanner</h1>

    <div class="row">
      <input id="adminKey" placeholder="Admin key (x-admin-key)" value="ashdb77asjkh" style="flex:1;min-width:220px" />
      <button id="start" class="primary">Start Camera</button>
      <button id="stop">Stop</button>
      <button id="snap">Tap to Scan</button>
    </div>

    <div class="stats">
      <div class="stat"><span class="pill">Camera</span> <span id="camStatus">idle</span></div>
      <div class="stat"><span class="pill">Checked-in</span> <span id="checked">—</span></div>
      <div class="stat"><span class="pill">Remaining</span> <span id="remaining">—</span></div>
      <div class="stat"><span class="pill">Total</span> <span id="total">—</span></div>
    </div>

    <div class="deck">
      <div class="panel videoBox">
        <video id="video" playsinline muted></video>
        <canvas id="canvas"></canvas>
      </div>

      <div class="panel">
        <div class="row">
          <input id="serial" placeholder="Scan QR or type serial e.g. K9M2WTSNJNHR" style="flex:1" />
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="autoMark" checked /> auto-mark used
          </label>
          <button id="check" class="primary">Check</button>
        </div>
        <div class="muted">Tip: tap the video then “Tap to Scan” to force a read if auto decode isn’t supported.</div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast">Saved.</div>

<script>
(() => {
  const $ = (sel) => document.querySelector(sel);
  const video = $('#video');
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const startBtn = $('#start');
  const stopBtn = $('#stop');
  const snapBtn = $('#snap');
  const serialInput = $('#serial');
  const adminKeyInput = $('#adminKey');
  const camStatus = $('#camStatus');
  const checkedEl = $('#checked');
  const remainingEl = $('#remaining');
  const totalEl = $('#total');
  const checkBtn = $('#check');
  const autoMark = $('#autoMark');
  const toast = $('#toast');

  let stream = null;
  let barcodeDetector = ('BarcodeDetector' in window) ? new BarcodeDetector({ formats: ['qr_code'] }) : null;

  function showToast(msg, ok=true){
    toast.textContent = msg;
    toast.className = 'toast ' + (ok ? '' : 'err') + ' show';
    setTimeout(() => { toast.classList.remove('show'); }, 2000);
  }

  function setCamStatus(txt){ camStatus.textContent = txt; }

  async function startCamera() {
    try {
      setCamStatus('requesting…');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play(); // important on iOS
      setCamStatus('live');
    } catch (e) {
      console.error(e);
      setCamStatus('denied');
      showToast('Camera failed: ' + (e.message || e.name), false);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    setCamStatus('stopped');
  }

  async function oneShotDecode() {
    if (!stream) return showToast('Start camera first', false);
    // draw current frame
    const w = video.videoWidth || video.clientWidth;
    const h = video.videoHeight || video.clientHeight;
    if (!w || !h) return showToast('Video not ready yet', false);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    if (barcodeDetector) {
      try {
        const bmp = await createImageBitmap(canvas);
        const codes = await barcodeDetector.detect(bmp);
        if (codes && codes.length) {
          const raw = codes[0].rawValue || codes[0].raw || '';
          serialInput.value = normalizeSerial(raw);
          if (autoMark.checked) markUsed();
          else checkSerial();
          return;
        }
        showToast('No QR found. Try again.', false);
      } catch (e) {
        console.warn('Detector failed, fallback', e);
        showToast('Detector not supported on this device', false);
      }
    } else {
      showToast('BarcodeDetector not available in this browser', false);
    }
  }

  function normalizeSerial(s){
    // we encode QR as "chuckl:SERIAL", accept both
    s = (s || '').trim();
    if (s.startsWith('chuckl:')) s = s.slice(7);
    return s;
  }

  async function checkSerial() {
    const serial = normalizeSerial(serialInput.value);
    const key = adminKeyInput.value.trim();
    if (!serial) return showToast('Enter or scan a serial', false);
    if (!key) return showToast('Missing admin key', false);

    try {
      const r = await fetch('/scan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ serial })
      });
      const j = await r.json();
      if (!j.ok) {
        showToast(j.error || 'Not valid', false);
        return;
      }
      updateCounters(j.stats);
      showToast('Customer successfully signed into the event'); // wording you wanted
    } catch (e) {
      showToast('Network error', false);
    }
  }

  async function markUsed() {
    const serial = normalizeSerial(serialInput.value);
    const key = adminKeyInput.value.trim();
    if (!serial) return showToast('Enter or scan a serial', false);
    if (!key) return showToast('Missing admin key', false);

    try {
      const r = await fetch('/scan/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ serial })
      });
      const j = await r.json();
      if (!j.ok) {
        showToast(j.error || 'Failed to mark', false);
        return;
      }
      updateCounters(j.stats);
      showToast('Customer successfully signed into the event');
    } catch (e) {
      showToast('Network error', false);
    }
  }

  function updateCounters(stats){
    if (!stats) return;
    checkedEl.textContent   = stats.checkedIn ?? '—';
    remainingEl.textContent = stats.remaining ?? '—';
    totalEl.textContent     = stats.total ?? '—';
  }

  // UI bindings
  startBtn.addEventListener('click', startCamera);
  stopBtn.addEventListener('click', stopCamera);
  snapBtn.addEventListener('click', oneShotDecode);
  checkBtn.addEventListener('click', () => (autoMark.checked ? markUsed() : checkSerial()));

  // Optional: focus the video on tap (helps iOS autofocus)
  video.addEventListener('click', () => {
    // Many mobile browsers refocus/adjust exposure on user tap automatically
    // We still trigger a one-shot read to give fast feedback:
    oneShotDecode();
  });

})();
</script>
</body>
</html>`;
  res.type('html').send(html);
});

export default router;
