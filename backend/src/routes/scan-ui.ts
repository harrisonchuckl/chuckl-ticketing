// backend/src/routes/scan-ui.ts
import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Minimal scanner UI:
 * - Start/Stop camera
 * - Tap-to-scan (focus assist)
 * - Enter Admin Key (x-admin-key)
 * - Green toast for success, red for errors
 * - Shows running totals for Checked-in / Remaining / Total (calls /scan/stats)
 *
 * QR decoding: uses jsQR from CDN + getUserMedia.
 * Works in iOS Safari (https required — you’re on https via Railway).
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
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:900px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px}
  h1{font-size:22px;margin:0 0 12px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input[type=text]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:16px}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  button{appearance:none;border:0;border-radius:10px;padding:12px 14px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .stats{display:flex;gap:10px;margin:12px 0}
  .stat{flex:1;background:#0f1220;border:1px solid #22263a;border-radius:10px;padding:10px}
  .stat small{display:block;color:#9aa0b5}
  .videoBox{margin-top:12px;background:#000;border-radius:12px;border:1px solid #22263a;overflow:hidden}
  video{display:block;width:100%;height:auto;background:#000}
  canvas{display:none}
  .actions{display:flex;gap:10px;margin-top:12px}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
  .small{font-size:12px;color:#9aa0b5}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Ticket Scanner</h1>

      <label>Admin Key (required)</label>
      <input id="adminkey" type="text" placeholder="enter your admin key" />

      <div class="row">
        <button id="startBtn">Start Camera</button>
        <button id="stopBtn" class="secondary">Stop</button>
        <button id="tapBtn" class="secondary">Tap to Scan</button>
      </div>

      <div class="stats">
        <div class="stat"><small>Camera</small><div id="camStatus">idle</div></div>
        <div class="stat"><small>Checked-in</small><div id="checked">–</div></div>
        <div class="stat"><small>Remaining</small><div id="remaining">–</div></div>
        <div class="stat"><small>Total</small><div id="total">–</div></div>
      </div>

      <div class="videoBox">
        <video id="video" playsinline></video>
        <canvas id="canvas" width="640" height="480"></canvas>
      </div>

      <label>Manual entry (fallback)</label>
      <div class="row">
        <input id="serial" type="text" placeholder="Scan QR or type serial e.g. K9M2WTSNJNR"/>
        <button id="checkBtn" class="secondary">Check</button>
        <button id="markBtn">Mark as Used</button>
      </div>

      <p class="small" id="hint">Tip: if scan doesn’t trigger, tap the video once to focus.</p>
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
    const tapBtn = document.getElementById('tapBtn');
    const checkBtn = document.getElementById('checkBtn');
    const markBtn = document.getElementById('markBtn');
    const serialEl = document.getElementById('serial');
    const adminEl = document.getElementById('adminkey');
    const toast = document.getElementById('toast');
    const camStatus = document.getElementById('camStatus');
    const checkedEl = document.getElementById('checked');
    const remainingEl = document.getElementById('remaining');
    const totalEl = document.getElementById('total');

    let stream = null;
    let rafId = null;
    let autoMark = true; // if true, automatically mark as USED after a successful check

    function showToast(msg, ok=true) {
      toast.textContent = msg;
      toast.className = 'toast ' + (ok ? 'ok' : 'err');
      toast.classList.remove('hidden');
      setTimeout(()=> toast.classList.add('hidden'), 2200);
    }

    async function fetchJSON(url, opts) {
      const r = await fetch(url, opts);
      return r.json();
    }

    async function refreshStats() {
      try {
        const key = adminEl.value.trim();
        if (!key) return;
        const r = await fetchJSON('/scan/stats', {
          method: 'GET',
          headers: { 'x-admin-key': key }
        });
        if (r && r.ok) {
          checkedEl.textContent = r.checkedIn ?? '0';
          remainingEl.textContent = r.remaining ?? '0';
          totalEl.textContent = r.total ?? '0';
        }
      } catch (e) {}
    }

    async function handleSerial(serial, doMark = false) {
      const key = adminEl.value.trim();
      if (!key) { showToast('Enter admin key', false); return; }
      if (!serial) { showToast('No serial', false); return; }

      // 1) Check ticket
      let resp = await fetchJSON('/scan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ serial })
      });

      if (!resp || resp.error) {
        showToast(resp?.message || 'Ticket not found', false);
        return;
      }

      if (resp.ok && resp.ticket?.status === 'VALID') {
        showToast('Customer successfully signed into the event (VALID).');
        if (doMark || autoMark) {
          // 2) Mark as used
          const mark = await fetchJSON('/scan/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify({ serial })
          });
          if (mark && mark.ok) showToast('Customer successfully signed into the event.');
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
      canvas.width = vw; canvas.height = vh;
      ctx.drawImage(video, 0, 0, vw, vh);
      try {
        const img = ctx.getImageData(0, 0, vw, vh);
        const code = jsQR(img.data, vw, vh);
        if (code && code.data) {
          let data = String(code.data || '').trim();
          // We encode tickets as either 'chuckl:SERIAL' or just SERIAL
          if (data.startsWith('chuckl:')) data = data.slice(7);
          serialEl.value = data;
          handleSerial(data, /*doMark*/ true);
          // brief pause to avoid double-scanning the same QR immediately
          setTimeout(()=> { rafId = requestAnimationFrame(drawAndScan); }, 900);
          return;
        }
      } catch (e) {}
      rafId = requestAnimationFrame(drawAndScan);
    }

    async function startCamera() {
      try {
        camStatus.textContent = 'starting…';
        // rear camera preference
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        await video.play();
        camStatus.textContent = 'live';
        drawAndScan();
      } catch (e) {
        camStatus.textContent = 'blocked';
        showToast('Camera permission denied (check Safari settings).', false);
      }
    }

    function stopCamera() {
      camStatus.textContent = 'idle';
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
        stream = null;
      }
      video.srcObject = null;
    }

    // UI handlers
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    tapBtn.addEventListener('click', ()=> video.focus());

    checkBtn.addEventListener('click', ()=> handleSerial(serialEl.value.trim(), false));
    markBtn.addEventListener('click', ()=> handleSerial(serialEl.value.trim(), true));

    // Keep stats fresh every 10s
    setInterval(refreshStats, 10000);
    refreshStats();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
