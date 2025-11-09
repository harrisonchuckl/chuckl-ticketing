// backend/src/routes/auth.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import * as cookie from 'cookie';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

const COOKIE_NAME = 'sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function serializeSessionCookie(value: string) {
  return cookie.serialize(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

async function getUserFromRequest(req: any) {
  const raw = req.headers.cookie || '';
  const parsed = cookie.parse(raw || '');
  const sid = parsed[COOKIE_NAME];
  if (!sid) return null;

  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });
  if (!session) return null;

  // (Optional) simple rolling session: extend expiry on use
  return session.user;
}

/* ----------------------------- AUTH SCREENS ----------------------------- */

router.get('/login', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sign in</title>
  <style>
    :root { --panel:#fff; --bg:#f7f8fb; --border:#e5e7eb; --text:#111827; --muted:#6b7280;}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    .wrap{max-width:560px;margin:48px auto;padding:16px;}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px;}
    .tabs{display:flex;gap:8px;margin-bottom:12px;}
    .tab{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
    .tab.active{background:#111827;color:#fff;border-color:#111827}
    .row{display:flex;flex-direction:column;gap:6px;margin:10px 0}
    label{font-size:12px;color:var(--muted)}
    input{border:1px solid var(--border);border-radius:8px;padding:10px}
    .btn{appearance:none;border:0;background:#111827;color:#fff;border-radius:8px;padding:10px 14px;cursor:pointer}
    .muted{color:var(--muted);font-size:12px}
    .err{color:#b91c1c;margin-top:8px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="tabs">
        <button class="tab active" data-tab="signin">Sign in</button>
        <button class="tab" data-tab="create">Create account</button>
        <button class="tab" data-tab="forgot">Forgot password</button>
      </div>

      <div id="signin" class="view">
        <form id="f_signin">
          <div class="row">
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <div class="row">
            <label>Password</label>
            <input type="password" name="password" required />
          </div>
          <button class="btn" type="submit">Sign in</button>
          <div id="e1" class="err"></div>
          <div class="muted" style="margin-top:10px">After signing in you'll be taken to your organiser console.</div>
        </form>
      </div>

      <div id="create" class="view" style="display:none">
        <form id="f_create">
          <div class="row">
            <label>Name (optional)</label>
            <input type="text" name="name" />
          </div>
          <div class="row">
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <div class="row">
            <label>Password</label>
            <input type="password" name="password" required />
          </div>
          <button class="btn" type="submit">Create account</button>
          <div id="e2" class="err"></div>
          <div class="muted" style="margin-top:10px">We'll create your organiser login and sign you in.</div>
        </form>
      </div>

      <div id="forgot" class="view" style="display:none">
        <form id="f_forgot">
          <div class="row">
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <button class="btn" type="submit">Send reset link</button>
          <div id="e3" class="err"></div>
          <div class="muted" style="margin-top:10px">We'll email you a password reset link if your account exists.</div>
        </form>
      </div>
    </div>
  </div>

<script>
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const views = { signin: document.getElementById('signin'), create: document.getElementById('create'), forgot: document.getElementById('forgot') };
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const k = t.getAttribute('data-tab');
    Object.keys(views).forEach(v => views[v].style.display = (v===k ? 'block' : 'none'));
  }));

  async function postJSON(url, data) {
    const r = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(data), credentials:'include' });
    return r.json();
  }

  document.getElementById('f_signin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    document.getElementById('e1').textContent = '';
    const fd = new FormData(ev.currentTarget);
    const j = await postJSON('/auth/login', { email: fd.get('email'), password: fd.get('password') });
    if (j.ok) { window.location.href = '/admin/ui#home'; } else { document.getElementById('e1').textContent = j.error || 'Sign in failed'; }
  });

  document.getElementById('f_create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    document.getElementById('e2').textContent = '';
    const fd = new FormData(ev.currentTarget);
    const j = await postJSON('/auth/create', { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
    if (j.ok) { window.location.href = '/admin/ui#home'; } else { document.getElementById('e2').textContent = j.error || 'Create failed'; }
  });

  document.getElementById('f_forgot').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    document.getElementById('e3').textContent = '';
    const fd = new FormData(ev.currentTarget);
    const j = await postJSON('/auth/forgot', { email: fd.get('email') });
    document.getElementById('e3').textContent = j.ok ? 'If that email exists we have sent a reset link.' : (j.error || 'Failed to send reset link');
  });
</script>
</body>
</html>`);
});

/* ------------------------------- API ROUTES ------------------------------ */

// Who am I?
router.get('/me', async (req, res) => {
  const user = await getUserFromRequest(req);
  res.json({ ok: !!user, user: user ? { id: user.id, email: user.email, name: user.name } : null });
});

// Create account
router.post('/create', async (req, res) => {
  try {
    const { name, email, password } = (req.body || {}) as { name?: string; email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing email/password' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ ok: false, error: 'Account already exists' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email, name: name || null, password: hash },
    });

    const sid = crypto.randomBytes(24).toString('hex');
    await prisma.session.create({ data: { id: sid, userId: user.id, createdAt: new Date() } });

    res.setHeader('Set-Cookie', serializeSessionCookie(sid));
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/create', err);
    res.status(500).json({ ok: false, error: 'Create account failed' });
  }
});

// Sign in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing email/password' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), String(user.password));
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const sid = crypto.randomBytes(24).toString('hex');
    await prisma.session.create({ data: { id: sid, userId: user.id, createdAt: new Date() } });

    res.setHeader('Set-Cookie', serializeSessionCookie(sid));
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/login', err);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

// Log out (kept here too; your /routes/logout.ts can also handle it)
router.get('/logout', async (req, res) => {
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw || '');
    const sid = parsed[COOKIE_NAME];
    if (sid) {
      await prisma.session.deleteMany({ where: { id: sid } }).catch(() => {});
    }
  } finally {
    res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', { path: '/', httpOnly: true, maxAge: 0, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }));
    res.redirect('/auth/login');
  }
});

// Forgot password (stub)
router.post('/forgot', async (_req, res) => {
  // You can wire actual email later. For now, always succeed.
  res.json({ ok: true });
});

export default router;
