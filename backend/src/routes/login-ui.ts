// backend/src/routes/login-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * GET /auth/login
 * Simple HTML login form that POSTs to /auth/login (your existing JSON endpoint).
 * On success it redirects to /admin/ui.
 */
router.get('/login', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sign in</title>
  <style>
    :root { --border:#e5e7eb; --text:#111827; --muted:#6b7280; --bg:#f7f8fb; }
    html,body{margin:0;padding:0;background:var(--bg);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text)}
    .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
    .card{width:100%;max-width:420px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:20px}
    h1{margin:0 0 12px 0;font-size:20px}
    label{display:block;font-size:14px;margin:10px 0 6px}
    input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;padding:10px 12px}
    button{margin-top:14px;width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:#111827;color:#fff;cursor:pointer}
    button:hover{opacity:.95}
    .muted{color:var(--muted);font-size:13px;margin-top:10px}
    .err{color:#b91c1c;margin-top:10px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Sign in</h1>
      <form id="f">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Sign in</button>
        <div id="err" class="err"></div>
        <div class="muted">After signing in you’ll be taken to your organiser console.</div>
      </form>
    </div>
  </div>
  <script>
    (function(){
      const f=document.getElementById('f');
      const err=document.getElementById('err');
      f.addEventListener('submit', async function(ev){
        ev.preventDefault();
        err.textContent='';
        const email=(document.getElementById('email') as any).value.trim();
        const password=(document.getElementById('password') as any).value;
        try{
          const r = await fetch('/auth/login', {
            method:'POST',
            headers:{ 'content-type':'application/json' },
            credentials:'include',
            body: JSON.stringify({ email, password })
          });
          const j = await r.json().catch(()=>({}));
          if(!r.ok || !j.ok){ throw new Error(j.error||'Sign in failed'); }
          // success
          window.location.href = '/admin/ui#home';
        }catch(e){ err.textContent = e.message || 'Sign in failed'; }
      });
    })();
  </script>
</body>
</html>`);
});

export default router;
