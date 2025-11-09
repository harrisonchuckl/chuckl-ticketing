// backend/src/routes/auth.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import cookie from 'cookie';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

function setSessionCookie(res: any, sid: string) {
  // 30 days
  const c = cookie.serialize('sid', sid, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  res.setHeader('Set-Cookie', c);
}

async function createSession(userId: string) {
  const sid = crypto.randomBytes(24).toString('hex');
  await prisma.session.create({
    data: { id: sid, userId, createdAt: new Date() },
  });
  return sid;
}

// -------- HTML login page (with tabs) --------
router.get('/login', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in</title>
<style>
  :root { --panel:#fff; --bg:#f7f8fb; --border:#e5e7eb; --text:#111827; --muted:#6b7280; }
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
  .wrap{max-width:520px;margin:40px auto;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px}
  h1{font-size:18px;margin:0 0 12px 0}
  label{display:block;font-size:12px;color:var(--muted);margin:10px 0 6px}
  input{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff}
  .row{margin-top:10px}
  button{width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:#0f172a;color:#fff;cursor:pointer}
  button:hover{background:#111827}
  .error{color:#b91c1c;margin-top:8px}
  .tabs{display:flex;gap:8px;margin-bottom:12px}
  .tab{flex:1;text-align:center;padding:8px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer}
  .tab.active{background:#111827;color:#fff;border-color:#111827}
  .muted{color:var(--muted);font-size:12px;margin-top:8px}
  .hidden{display:none}
</style>
</head>
<body>
  <div class="wrap">
    <div class="tabs">
      <div class="tab active" data-tab="signin">Sign in</div>
      <div class="tab" data-tab="signup">Create account</div>
      <div class="tab" data-tab="forgot">Forgot password</div>
    </div>

    <!-- Sign in -->
    <div id="panel-signin">
      <h1>Sign in</h1>
      <label>Email</label>
      <input id="li-email" type="email" autocomplete="email" />
      <label>Password</label>
      <input id="li-password" type="password" autocomplete="current-password" />
      <div class="row"><button id="btn-login">Sign in</button></div>
      <div id="li-err" class="error"></div>
      <div class="muted">After signing in you'll be taken to your organiser console.</div>
    </div>

    <!-- Create account -->
    <div id="panel-signup" class="hidden">
      <h1>Create account</h1>
      <label>Name (optional)</label>
      <input id="su-name" type="text" />
      <label>Email</label>
      <input id="su-email" type="email" autocomplete="email" />
      <label>Password</label>
      <input id="su-password" type="password" autocomplete="new-password" />
      <div class="row"><button id="btn-signup">Create account</button></div>
      <div id="su-err" class="error"></div>
      <div class="muted">We'll create your organiser login and sign you in.</div>
    </div>

    <!-- Forgot -->
    <div id="panel-forgot" class="hidden">
      <h1>Forgot password</h1>
      <label>Email</label>
      <input id="fp-email" type="email" autocomplete="email" />
      <div class="row"><button id="btn-forgot">Send reset link</button></div>
      <div id="fp-err" class="error"></div>
      <div class="muted">We'll email you a password reset link if your account exists.</div>
    </div>
  </div>

<script>
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // Tabs
  $$('.tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      const key = t.dataset.tab;
      $('#panel-signin').classList.toggle('hidden', key!=='signin');
      $('#panel-signup').classList.toggle('hidden', key!=='signup');
      $('#panel-forgot').classList.toggle('hidden', key!=='forgot');
    });
  });

  function gotoApp(){ window.location.href = '/admin/ui#home'; }

  $('#btn-login')?.addEventListener('click', async () => {
    $('#li-err').textContent = '';
    const email = $('#li-email').value.trim();
    const password = $('#li-password').value;
    if(!email || !password){ $('#li-err').textContent='Enter email and password'; return; }
    try{
      const r = await fetch('/auth/login', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const j = await r.json();
      if(j && j.ok) return gotoApp();
      $('#li-err').textContent = j && j.error ? j.error : 'Sign in failed';
    }catch(e){ $('#li-err').textContent='Sign in failed'; }
  });

  $('#btn-signup')?.addEventListener('click', async () => {
    $('#su-err').textContent = '';
    const name = $('#su-name').value.trim();
    const email = $('#su-email').value.trim();
    const password = $('#su-password').value;
    if(!email || !password){ $('#su-err').textContent='Enter email and password'; return; }
    try{
      const r = await fetch('/auth/signup', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ name, email, password })
      });
      const j = await r.json();
      if(j && j.ok) return gotoApp();
      $('#su-err').textContent = j && j.error ? j.error : 'Could not create account';
    }catch(e){ $('#su-err').textContent='Could not create account'; }
  });

  $('#btn-forgot')?.addEventListener('click', async () => {
    $('#fp-err').textContent = '';
    const email = $('#fp-email').value.trim();
    if(!email){ $('#fp-err').textContent='Enter your email'; return; }
    try{
      const r = await fetch('/auth/forgot', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ email })
      });
      const j = await r.json();
      if(j && j.ok){ alert('If your account exists, a reset link will be emailed.'); }
      else { $('#fp-err').textContent = j && j.error ? j.error : 'Password reset endpoint not available yet.'; }
    }catch(e){ $('#fp-err').textContent='Password reset endpoint not available yet.'; }
  });
</script>
</body>
</html>`);
});

// -------- Login / Signup / Forgot JSON endpoints --------

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing email or password' });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.password) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const sid = await createSession(user.id);
    setSessionCookie(res, sid);
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /auth/login failed', e);
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing email or password' });

    const lower = String(email).toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: lower } });
    if (existing) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: lower, name: name || null, password: hash },
    });

    const sid = await createSession(user.id);
    setSessionCookie(res, sid);
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /auth/signup failed', e);
    return res.status(500).json({ ok: false, error: 'Signup failed' });
  }
});

router.post('/forgot', async (_req, res) => {
  // You can wire real email later. For now, return a friendly placeholder.
  return res.json({ ok: false, error: 'Password reset endpoint not available yet.' });
});

// -------- Logout (clear cookie + redirect) --------
router.get('/logout', async (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sid = cookies.sid;
    if (sid) {
      // Best-effort delete
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
    }
  } catch (_) {}
  res.setHeader('Set-Cookie', cookie.serialize('sid', '', { path: '/', maxAge: 0 }));
  res.redirect('/auth/login');
});

export default router;
