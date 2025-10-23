import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Super-minimal scanner UI:
 * - Big live camera view
 * - Admin key
 * - Start / Stop / Tap to scan
 * - Optional manual entry drawer
 * - Tiny stats line
 * - Success/fail banner
 *
 * NOTE: This page expects a local jsQR (served below at /assets/jsqr.min.js).
 * Paste the real minified jsQR code into that route.
 */
router.get('/scan', (_req: Request, res: Response) => {
  const html = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chuckl. Scanner</title>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0b10; color: #f6f7fb; font-family: system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    .panel { background:#151823; border:1px solid #24283a; border-radius:14px; padding:12px; }
    .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    input, button { font-size:16px; }
    input[type=text] { flex:1; min-width:180px; padding:10px 12px; border-radius:10px; border:1px solid #2a2f45; background:#0f1320; color:#fff; }
    button { padding:10px 14px; border-radius:10px; border:1px solid #2a2f45; background:#3b82f6; color:#fff; cursor:pointer; }
    button.secondary { background:#374151; }
    .muted { color:#9aa0aa; font-size:12px; }
    .bigcam { margin-top:10px; aspect-ratio: 3/4; width: 100%; position: relative; background:#000; border-radius:12px; border:1px solid #20253a; overflow:hidden; }
    video, canvas { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .bar { display:flex; gap:10px; align-items:center; justify-content:space-between; margin-top:8px; font-size:14px; }
    .stats { display:flex; gap:10px; }
    .pill { background:#0f1320; border:1px solid #20253a; border-radius:999px; padding:6px 10px; font-size:12px; color:#c6c8d1; }
    .banner { position:fixed; left:0; right:0; bottom:0; padding:12px 16px; text-align:center; font-weight:600; z-index:999; }
    .banner.ok { background:#065f46; }
    .banner.err { background:#7f1d1d; }
    .hidden { display:none; }
    details { margin-top:10px; }
    details > summary { cursor:pointer; list-style: none; }
    details > summary::marker { display:none; }
    details > summary::-webkit-details-marker { display:none; }
    .drawer { padding-top:8px; display:grid; gap:8px; grid-template-columns: 1fr auto auto; }
    .drawer button { white-space:nowrap; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chuckl. Scanner</h1>

    <div class="panel">
      <div class="row">
        <input id="adminkey" type="text" placeholder="Admin key (x-admin-key)" />
        <button id="startCam">Start Camera</button>
        <button id="stopCam" class="secondary">Stop</button>
        <button id="tapScan" class="secondary">Tap to Scan</button>
      </div>
      <div class="bar">
        <div class="muted" id="camStatus">Camera idle</div>
        <div class="stats">
          <span class="pill">Checked-in: <b id="used">–</b></span>
          <span class="pill">Remaining: <b id="rem">–</b></span>
          <span class="pill">Total: <b id="tot">–</b></span>
        </div>
      </div>

      <div class="bigcam">
        <video id="video" playsinline muted></video>
        <canvas id="frame" class="hidden"></canvas>
      </div>

      <details>
        <summary class="muted">Manual entry</summary>
        <div class="drawer">
          <input id="serial" type="text" placeholder="Scan QR or type serial e.g. K9M2WTSNJNHR" />
          <button id="checkBtn" class="secondary">Check</button>
          <button id="markBtn">Mark as Used</button>
        </div>
      </details>
    </div>
  </div>

  <div id="banner" class="banner hidden"></div>

  <script src="/assets/jsqr.min.js" defer></script>
  <script type="module">
    const $ = (id) => document.getElementById(id);
    const video = $('video');
    const canvas = $('frame');
    const ctx = canvas.getContext('2d');
    const camStatus = $('camStatus');
    const usedEl = $('used');
    const remEl = $('rem');
    const totEl = $('tot');
    const bannerEl = $('banner');

    let stream = null;
    let scanning = false;
    let lastSerial = '';
    let currentShowId = '';
    let statsTimer = 0;

    // Persist admin key
    const KEY_STORE = 'chuckl_admin_key';
    $('adminkey').value = localStorage.getItem(KEY_STORE) || '';
    $('adminkey').addEventListener('input', e => {
      localStorage.setItem(KEY_STORE, e.currentTarget.value.trim());
    });

    function banner(kind, text) {
      bannerEl.className = 'banner ' + (kind === 'ok' ? 'ok' : 'err');
      bannerEl.textContent = text;
      bannerEl.classList.remove('hidden');
      clearTimeout(bannerEl._t);
      bannerEl._t = setTimeout(() => bannerEl.classList.add('hidden'), 1500);
    }

    function stripSerial(text) {
      let s = (text || '').trim();
      if (!s) return '';
      if (s.toLowerCase().startsWith('chuckl:')) s = s.slice(7);
      return s.toUpperCase();
    }

    async function startCamera() {
      try {
        // Prefer rear camera with reasonable resolution for decoding
        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play();
        scanning = true;
        camStatus.textContent = 'Camera running…';
        loop();
      } catch (e) {
        camStatus.textContent = 'Camera error. Check Safari permissions (Settings ▸ Safari ▸ Camera ▸ Allow).';
        banner('err', 'Camera not allowed');
      }
    }

    function stopCamera() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
      scanning = false;
      camStatus.textContent = 'Camera stopped.';
    }

    async function decodeOnce() {
      if (!video.videoWidth) return;
      const w = video.videoWidth, h = video.videoHeight;
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      // Prefer native BarcodeDetector when present
      if ('BarcodeDetector' in window) {
        try {
          const det = new window.BarcodeDetector({ formats: ['qr_code'] });
          const codes = await det.detect(video);
          if (codes?.length) return handleDetected(codes[0].rawValue || '');
        } catch (_) { /* fallback below */ }
      }
      // Fallback to jsQR
      if (window.jsQR) {
        const img = ctx.getImageData(0, 0, w, h);
        const res = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (res?.data) return handleDetected(res.data);
      }
    }

    function loop() {
      if (!scanning) return;
      decodeOnce().finally(() => requestAnimationFrame(loop));
    }

    function normalize(s) { return stripSerial(s); }

    async function api(path, body) {
      const key = $('adminkey').value.trim();
      if (!key) { banner('err', 'Missing admin key'); return null; }
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        let msg = 'HTTP ' + res.status;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        banner('err', msg);
        return null;
      }
      return res.json();
    }

    async function refreshStats() {
      clearTimeout(statsTimer);
      if (!currentShowId) return;
      const key = $('adminkey').value.trim();
      if (!key) return;
      try {
        const r = await fetch('/scan/stats?showId=' + encodeURIComponent(currentShowId), {
          headers: { 'x-admin-key': key }
        });
        const j = await r.json();
        if (j?.ok) {
          usedEl.textContent = String(j.used);
          remEl.textContent  = String(j.remaining);
          totEl.textContent  = String(j.total);
        }
      } catch {}
      statsTimer = window.setTimeout(refreshStats, 5000);
    }

    function handleDetected(text) {
      const serial = normalize(text);
      if (!serial || serial === lastSerial) return;
      lastSerial = serial;
      $('serial').value = serial; // fill manual box for visibility
      mark(); // auto-mark on scan
    }

    async function check() {
      const serial = normalize($('serial').value);
      if (!serial) return banner('err','Missing serial');
      const data = await api('/scan/check', { serial });
      if (data?.ok) {
        if (data.show?.id && !currentShowId) {
          currentShowId = data.show.id;
          refreshStats();
        }
        banner('ok', 'Ticket is valid');
      }
    }

    async function mark() {
      const serial = normalize($('serial').value);
      if (!serial) return banner('err','Missing serial');
      const data = await api('/scan/mark', { serial });
      if (data?.ok) {
        banner('ok', 'Customer successfully signed into the event');
        refreshStats();
      }
    }

    // UI hooks
    $('startCam').onclick = startCamera;
    $('stopCam').onclick  = stopCamera;
    $('tapScan').onclick  = decodeOnce;
    $('checkBtn').onclick = check;
    $('markBtn').onclick  = mark;

    // Tap video to focus & scan (best-effort)
    video.addEventListener('click', () => decodeOnce());
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * Serve jsQR (minified) inlined here.
 * 👉 Replace the placeholder string with the real jsQR min.js contents
 * from https://github.com/cozmo/jsQR (dist/jsQR.js -> minify, or use any min build).
 */
router.get('/assets/jsqr.min.js', (_req: Request, res: Response) => {
  const jsqr = `/* PLACE REAL jsQR MINIFIED CODE HERE */`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(jsqr);
});

export default router;
