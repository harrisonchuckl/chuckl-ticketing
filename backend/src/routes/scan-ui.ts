// backend/src/routes/scan-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Chuckl. Scanner UI (minimal + fast)
 * - Camera start/stop
 * - QR read via jsQR
 * - Admin key stored in localStorage
 * - 5s green success banner
 * - Compact stats (calls /scan/stats)
 * - Manual entry fallback
 */
router.get('/', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Ticket Scanner</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:960px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:14px}
  h1{font-size:20px;margin:0 0 10px}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  input[type=text]{flex:1;min-width:220px;height:40px;padding:0 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  button{height:40px;padding:0 12px;border-radius:10px;border:0;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .videoBox{margin-top:10px;background:#000;border-radius:12px;border:1px solid #22263a;overflow:hidden}
  video{display:block;width:100%;height:auto;background:#000}
  canvas{display:none}
  .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 0}
  .stat{background:#0f1220;border:1px solid #22263a;border-radius:10px;padding:10px}
  .stat small{display:block;color:#9aa0b5;font-size:12px;margin-bottom:4px}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
  .muted{color:#9aa0b5}
  .bar{display:flex;gap:8px;align-items:center;justify-content:space-between}
  .shy{opacity:.85}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="bar">
        <h1>Chuckl. Scanner</h1>
        <div class="muted shy" id="camStatus">camera: idle</div>
      </div>

      <div class="row" style="margin-top:8px">
        <input id="adminkey" type="text" placeholder="x-admin-key (required)"/>
        <button id="saveKey" class="secondary">Save key</button>
        <button id="startBtn">Start camera</button>
        <button id="stopBtn" class="secondary">Stop</button>
      </div>

      <div class="videoBox" style="margin-top:10px">
        <video id="video" playsinline muted></video>
        <canvas id="canvas" width="640" height="480"></canvas>
      </div>

      <div class="stats">
        <div class="stat"><small>Checked-in</small><div id="checked">–</div></div>
        <div class="stat"><small>Remaining</small><div id="remaining">–</div></div>
        <div class="stat"><small>Total</small><div id="total">–</div></div>
      </div>

      <div class="row" style="margin-top:10px">
        <input id="serial" type="text" placeholder="Manual serial e.g. K9M2WTSNJNHR"/>
        <button id="checkBtn" class="secondary">Check</button>
        <button id="markBtn">Mark used</button>
      </div>
      <div class="muted shy" style="margin-top:6px">Tip: If scan doesn’t trigger, tap the camera view once to refocus.</div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <!-- jsQR for decoding -->
  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const checkBtn = document.getElementById('checkBtn');
    const markBtn = document.getElementById('markBtn');
    const serialEl = document.getElementById('serial');
    const adminEl = document.getElementById('adminkey');
    const saveKeyBtn = document.getElementById('saveKey');
    const toast = document.getElementById('toast');
    const camStatus = document.getElementById('camStatus');
    const checkedEl = document.getElementById('checked');
    const remainingEl = document.getElementById('remaining');
    const totalEl = document.getElementById('total');

    let stream = null;
    let rafId = null;
    let lastScan = "";
    let lastScanAt = 0;
    const SCAN_THROTTLE_MS = 1200;  // block duplicate scans for ~1.2s
    const TOAST_MS = 5000;          // ✅ keep banner visible for 5 seconds
    const AUTO_MARK = true;

    // Persist admin key
    const savedKey = localStorage.getItem('x-admin-key') || '';
    if (savedKey) adminEl.value = savedKey;
    saveKeyBtn.addEventListener('click', () => {
      localStorage.setItem('x-admin-key', adminEl.value.trim());
      showToast('Admin key saved', true);
    });

    function showToast(msg, ok=true) {
      toast.textContent = msg;
      toast.className = 'toast ' + (ok ? 'ok' : 'err');
      toast.classList.remove('hidden');
      setTimeout(()=> toast.classList.add('hidden'), TOAST_MS);
    }

    async function fetchJSON(url, opts) {
      const r = await fetch(url, opts);
      try { return await r.json(); } catch { return { ok:false, error: 'bad_json' }; }
    }

    async function refreshStats() {
      const key = adminEl.value.trim();
      if (!key) return;
      try {
        const r = await fetchJSON('/scan/stats', {
          method: 'GET',
          headers: { 'x-admin-key': key }
        });
        if (r && r.ok) {
          checkedEl.textContent = r.checkedIn ?? '0';
          remainingEl.textContent = r.remaining ?? '0';
          totalEl.textContent = r.total ?? '0';
        }
      } catch {}
    }

    function extractSerial(raw) {
      if (!raw) return '';
      let d = String(raw).trim();
      if (d.toLowerCase().startsWith('chuckl:')) d = d.slice(7);
      return d;
    }

    async function handleSerial(serial, doMark=false) {
      const key = adminEl.value.trim();
      if (!key) { showToast('Enter admin key', false); return; }
      if (!serial) { showToast('No serial', false); return; }

      // 1) Check ticket
      const resp = await fetchJSON('/scan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ serial })
      });

      if (!resp || resp.error) {
        showToast(resp?.message || 'Ticket not found', false);
        await refreshStats();
        return;
      }

      if (resp.ok && resp.ticket?.status === 'VALID') {
        if (doMark || AUTO_MARK) {
          // 2) Mark as used
          const mark = await fetchJSON('/scan/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify({ serial })
          });
          if (mark && mark.ok) {
            showToast('Customer successfully signed into the event.', true);
          } else {
            showToast('Could not mark as used', false);
          }
        } else {
          showToast('Customer successfully signed into the event (VALID).', true);
        }
      } else if (resp.ok && resp.ticket?.status === 'USED') {
        showToast('Already used.', false);
      } else {
        showToast('Not valid.', false);
      }

      await refreshStats();
    }

    function drawAndScan() {
      if (!video.videoWidth) { rafId = requestAnimationFrame(drawAndScan); return; }

      const vw = video.videoWidth, vh = video.videoHeight;
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }

      ctx.drawImage(video, 0, 0, vw, vh);
      try {
        const img = ctx.getImageData(0, 0, vw, vh);
        const code = jsQR(img.data, vw, vh);
        if (code && code.data) {
          const now = Date.now();
          let serial = extractSerial(code.data);
          if (serial && (serial !== lastScan || (now - lastScanAt) > SCAN_THROTTLE_MS)) {
            lastScan = serial;
            lastScanAt = now;
            serialEl.value = serial;
            // Mark used automatically (typical door flow)
            handleSerial(serial, true);
            // Brief pause to avoid double-hit
            setTimeout(()=> { rafId = requestAnimationFrame(drawAndScan); }, 900);
            return;
          }
        }
      } catch {}
      rafId = requestAnimationFrame(drawAndScan);
    }

    async function startCamera() {
      try {
        camStatus.textContent = 'camera: starting…';
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        video.srcObject = stream;
        // iOS Safari likes muted+playsinline for autoplay
        video.setAttribute('playsinline', '');
        video.muted = true;
        await video.play();
        camStatus.textContent = 'camera: live';
        drawAndScan();

        // tapping the video can help trigger autofocus on some browsers
        video.addEventListener('click', () => {
          // No direct focus API, but tapping often prompts refocus by the UA
        }, { passive: true });
      } catch (e) {
        camStatus.textContent = 'camera: blocked';
        showToast('Camera permission denied (check browser settings).', false);
      }
    }

    function stopCamera() {
      camStatus.textContent = 'camera: idle';
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
        stream = null;
      }
      video.srcObject = null;
    }

    // Buttons
    document.getElementById('startBtn').addEventListener('click', startCamera);
    document.getElementById('stopBtn').addEventListener('click', stopCamera);
    document.getElementById('checkBtn').addEventListener('click', ()=> handleSerial(serialEl.value.trim(), false));
    document.getElementById('markBtn').addEventListener('click', ()=> handleSerial(serialEl.value.trim(), true));

    // Auto-refresh stats
    setInterval(refreshStats, 10000);
    refreshStats();

    // If a key is present, start the camera immediately (useful at doors)
    if (adminEl.value.trim()) startCamera();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
