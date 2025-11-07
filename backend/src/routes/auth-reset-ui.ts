import { Router } from 'express';

const router = Router();

/**
 * Serves the password reset page: GET /auth/reset/:token
 * Pure HTML+JS (no frameworks). Posts to /auth/reset with { token, password }.
 */
router.get('/reset/:token', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const token = String(req.params.token || '');

  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reset your password</title>
<style>
  :root{
    --bg:#f7f8fa;--panel:#fff;--ink:#0f172a;--muted:#6b7280;--accent:#2563eb;
    --border:#e5e7eb;--bad:#dc2626;--ok:#16a34a
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif}
  .wrap{display:grid;place-items:center;min-height:100vh;padding:16px}
  .card{width:380px;max-width:95vw;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px}
  h1{margin:0 0 8px;font-size:20px}
  p.note{color:var(--muted);font-size:14px;margin:0 0 14px}
  label{font-size:12px;color:var(--muted)}
  input{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  .row{display:flex;gap:10px;align-items:center;margin-top:12px}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}
  .msg{font-size:14px;margin-top:10px}
  .bad{color:var(--bad)} .ok{color:var(--ok)}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Set a new password</h1>
    <p class="note">Enter your new password below.</p>

    <div>
      <label>New password</label>
      <input id="pw1" type="password" placeholder="••••••••"/>
    </div>
    <div style="margin-top:8px">
      <label>Confirm password</label>
      <input id="pw2" type="password" placeholder="••••••••"/>
    </div>

    <div class="row">
      <button class="btn primary" id="btnReset">Update password</button>
    </div>

    <div id="msg" class="msg"></div>
  </div>
</div>

<script>
(function(){
  const token = ${JSON.stringify(token)};
  const $ = (s)=>document.querySelector(s);

  async function doReset(){
    const pw1 = $('#pw1').value;
    const pw2 = $('#pw2').value;
    const msg = $('#msg');

    msg.textContent = '';
    msg.className = 'msg';

    if(!pw1 || !pw2){
      msg.textContent = 'Please enter and confirm your new password.';
      msg.classList.add('bad');
      return;
    }
    if(pw1 !== pw2){
      msg.textContent = 'Passwords do not match.';
      msg.classList.add('bad');
      return;
    }

    const r = await fetch('/auth/reset', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, password: pw1 })
    });
    const j = await r.json().catch(()=>({}));

    if(!r.ok || !j.ok){
      msg.textContent = j.message || 'Reset failed';
      msg.classList.add('bad');
      return;
    }
    msg.textContent = 'Password updated. You can now return to the organiser console and sign in.';
    msg.classList.add('ok');
  }

  document.getElementById('btnReset').addEventListener('click', doReset);
})();
</script>
</body>
</html>`);
});

export default router;
