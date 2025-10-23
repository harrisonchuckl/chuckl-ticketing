import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Scanner page (served HTML) + two static assets:
 *  - /assets/jsqr.min.js  (js decoder fallback)
 *  - /assets/scan-ui.js   (page logic)
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
    .wrap{max-width:980px;margin:0 auto;padding:20px}
    .card{background:#151823;border:1px solid #24283a;border-radius:16px;padding:18px}
    h1{margin:0 0 10px;font-size:22px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
    input,button,label{font-size:15px}
    input{flex:1;min-width:220px;padding:10px;border-radius:10px;border:1px solid #2a2f45;background:#0f1320;color:#fff}
    button{padding:10px 14px;border-radius:10px;border:1px solid #2a2f45;background:#3b82f6;color:#fff;cursor:pointer}
    button.secondary{background:#374151}
    .muted{color:#9aa0aa;font-size:12px;align-self:center}
    video,canvas{width:100%;max-height:420px;background:#000;border-radius:10px;border:1px solid #20253a}
    .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .toggle{display:flex;gap:6px;align-items:center}
    .banner{position:fixed;left:0;right:0;bottom:0;padding:12px 16px;text-align:center;font-weight:600;z-index:999}
    .banner.ok{background:#065f46}      /* green */
    .banner.err{background:#7f1d1d}     /* red */
    .hidden{display:none}
    .pill{background:#0f1320;border:1px solid #20253a;border-radius:999px;padding:6px 10px;font-size:12px;color:#c6c8d1}
    .stats{display:flex;gap:10px;flex-wrap:wrap}
    .stat{background:#0f1320;border:1px solid #20253a;border-radius:12px;padding:10px 12px}
    .stat b{font-size:18px}
    .tapHelp{position:absolute;right:12px;bottom:12px;background:#0f1320aa;border:1px solid #20253a;border-radius:10px;padding:6px 10px;font-size:12px}
    .vidwrap{position:relative}
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
        <button id="snapBtn" class="secondary">Tap to Scan</button>
        <span id="camStatus" class="muted">Camera idle</span>
        <span id="decoderMode" class="pill">Decoder: auto</span>
        <label class="toggle">
          <input type="checkbox" id="autoMark" checked />
          Auto-Mark as Used
        </label>
        <label class="toggle">
          <input type="checkbox" id="torchToggle" />
          Torch
        </label>
      </div>

      <div class="row">
        <div class="vidwrap">
          <video id="video" playsinline muted></video>
          <div class="tapHelp">Tip: tap video to focus & scan</div>
        </div>
        <canvas id="frame" class="hidden"></canvas>
      </div>

      <div class="row controls">
        <button id="checkBtn">Check</button>
        <button id="markBtn" class="secondary">Mark as Used</button>
        <button id="clearBtn" class="secondary">Clear</button>
      </div>

      <div class="row stats">
        <div class="stat"><div>Checked-in</div><b id="usedCount">–</b></div>
        <div class="stat"><div>Remaining</div><b id="remainingCount">–</b></div>
        <div class="stat"><div>Total</div><b id="totalCount">–</b></div>
        <span class="muted" id="statsShowTitle"></span>
      </div>

      <div class="row">
        <span class="muted">If scanning is slow on iOS, use “Tap to Scan”.</span>
      </div>
    </div>
  </div>

  <script src="/assets/jsqr.min.js" defer></script>
  <script src="/assets/scan-ui.js" defer></script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

router.get('/assets/scan-ui.js', (_req: Request, res: Response) => {
  const js = `(() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const canvas = $('frame');
  const ctx = canvas.getContext('2d');
  const camStatus = $('camStatus');
  const decoderMode = $('decoderMode');
  const torchToggle = $('torchToggle');

  let stream = null;
  let scanning = false;
  let lastSerial = '';
  let currentShowId = '';
  let statsTimer = 0;
  let imageCapture = null;

  const usedEl = $('usedCount');
  const remEl  = $('remainingCount');
  const totEl  = $('totalCount');
  const titleEl= $('statsShowTitle');

  const adminKeyMemoryKey = 'chuckl_admin_key';
  const savedKey = localStorage.getItem(adminKeyMemoryKey);
  if (savedKey) $('adminkey').value = savedKey;
  $('adminkey').addEventListener('input', () => {
    const v = $('adminkey').value.trim();
    if (v) localStorage.setItem(adminKeyMemoryKey, v);
  });

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
        if (data?.error === 'already_used') {
          banner('err','Ticket already used');
        } else if (data?.error === 'not_found') {
          banner('err','Ticket not found');
        } else {
          banner('err', data?.error || ('HTTP ' + res.status));
        }
      } else {
        if (path.endsWith('/mark')) {
          banner('ok','Customer successfully signed into the event');
          // Update stats if we know the showId
          if (currentShowId) refreshStats();
        } else {
          banner('ok','Ticket is valid'); // used only when hitting "Check"
          if (!currentShowId && data?.show?.id) {
            currentShowId = data.show.id;
            titleEl.textContent = data.show.title ? 'Show: ' + data.show.title : '';
            refreshStats();
          }
        }
        // If we checked (not marked) we can still capture show id to start stats polling
        if (!currentShowId && data?.show?.id) {
          currentShowId = data.show.id;
          titleEl.textContent = data.show.title ? 'Show: ' + data.show.title : '';
          refreshStats();
        }
      }
    } catch(e){
      banner('err', 'Network error');
    }
  }

  async function refreshStats(){
    clearTimeout(statsTimer);
    const key = $('adminkey').value.trim();
    if (!currentShowId || !key) return;

    try {
      const res = await fetch('/scan/stats?showId=' + encodeURIComponent(currentShowId), {
        headers: { 'x-admin-key': key }
      });
      if (res.ok) {
        const s = await res.json();
        if (s?.ok) {
          usedEl.textContent = String(s.used);
          remEl.textContent  = String(s.remaining);
          totEl.textContent  = String(s.total);
        }
      }
    } catch(_e) {}
    // poll every 5s while on this show
    statsTimer = window.setTimeout(refreshStats, 5000);
  }

  $('checkBtn').onclick = () => call('/scan/check');
  $('markBtn').onclick  = () => call('/scan/mark');
  $('clearBtn').onclick = () => { lastSerial=''; $('serial').value=''; };

  // Torch toggle (where supported)
  torchToggle.addEventListener('change', () => {
    try {
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      if (caps && 'torch' in caps) {
        track.applyConstraints({ advanced: [{ torch: torchToggle.checked }] });
      } else {
        torchToggle.checked = false;
      }
    } catch(_e){}
  });

  // Tap video to focus & single-frame decode
  video.addEventListener('click', async () => {
    if (imageCapture && imageCapture.focus) {
      try { await imageCapture.focus(); } catch(_) {}
    }
    // force a single decode
    decodeOnce();
  });

  $('snapBtn').onclick = () => decodeOnce();

  async function startCamera(){
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },  // ask for higher res for better decode
          height:{ ideal: 1080 }
        },
        audio: false
      });
      const track = stream.getVideoTracks()[0];
      // try continuous focus if supported
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' as any }] });
      } catch(_) {}

      if ('ImageCapture' in window) {
        // @ts-ignore
        imageCapture = new ImageCapture(track);
      }

      video.srcObject = stream;
      await video.play();
      camStatus.textContent = 'Camera running…';
      startLoop();
    } catch (e) {
      camStatus.textContent = 'Camera error: ' + String(e);
    }
  }

  $('startCam').onclick = startCamera;

  $('stopCam').onclick = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    scanning = false;
    camStatus.textContent = 'Camera stopped.';
  };

  let useBarcodeDetector = false;
  async function startLoop(){
    scanning = true;
    useBarcodeDetector = 'BarcodeDetector' in window;
    decoderMode.textContent = 'Decoder: ' + (useBarcodeDetector ? 'BarcodeDetector' : 'jsQR');
    const detector = useBarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;

    const tick = async () => {
      if (!scanning || !video.videoWidth) { requestAnimationFrame(tick); return; }
      try {
        if (useBarcodeDetector && detector) {
          const codes = await detector.detect(video);
          if (codes && codes.length) handleDetected(codes[0].rawValue || '');
        } else if (window.jsQR) {
          // draw frame to canvas
          const w = video.videoWidth, h = video.videoHeight;
          canvas.width = w; canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const res = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (res && res.data) handleDetected(res.data);
        }
      } catch(_e) {}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function decodeOnce() {
    if (!video.videoWidth) return;
    const w = video.videoWidth, h = video.videoHeight;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    if (window.jsQR) {
      const res = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (res && res.data) handleDetected(res.data);
      else banner('err','No QR detected');
    }
  }

  function handleDetected(text){
    const serial = stripSerial(text);
    if (!serial || serial === lastSerial) return;
    lastSerial = serial;
    $('serial').value = serial;

    if ($('autoMark').checked) {
      call('/scan/mark');
    } else {
      // still show the nicer wording on non-mark scans
      banner('ok', 'Customer successfully signed into the event');
    }
  }
})();`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(js);
});

// IMPORTANT: paste the real minified jsQR here (or serve a static file).
router.get('/assets/jsqr.min.js', (_req: Request, res: Response) => {
  const jsqr = `/* jsQR v1.4.0 minified goes here. Get it from https://github.com/cozmo/jsQR */`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(jsqr);
});

export default router;
