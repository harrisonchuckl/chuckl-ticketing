// backend/src/routes/login-ui.ts
import { Router } from 'express';

const router = Router();

/**
 * GET /auth/login
 * Multi-tab auth page: Login / Sign up / Forgot password
 * Uses fetch to hit your JSON auth endpoints:
 *   POST /auth/login       { email, password }
 *   POST /auth/signup      { email, password, name? }
 *   POST /auth/password/request { email }   (if not implemented yet, shows a helpful error)
 * On success, redirects to /admin/ui#home
 */
router.get('/login', (req, res) => {
  const qpEmail = (req.query.email ?? '').toString();
  const qpPassword = (req.query.password ?? '').toString();

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Sign in</title>
<style>
:root { --border:#e5e7eb; --text:#111827; --muted:#6b7280; --bg:#009fe3; --brand:#111827; }
html,body{
  margin:0;
  padding:0;
  height:100%;
  background:#009fe3 !important;
  background-image:none !important;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
  color:var(--text);
}
.wrap{
  min-height:100vh;
  display:grid;
  place-items:center;
  padding:24px;
  background:#009fe3 !important;
  background-image:none !important;
}
  .card{width:100%;max-width:460px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:20px}
  h1{margin:0 0 12px 0;font-size:20px}
  label{display:block;font-size:14px;margin:10px 0 6px}
  input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;padding:10px 12px}
  button{margin-top:14px;width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--brand);color:#fff;cursor:pointer}
  button:hover{opacity:.95}
  .muted{color:var(--muted);font-size:13px;margin-top:10px}
  .err{color:#b91c1c;margin-top:10px}
  .tabs{display:flex;gap:4px;margin-bottom:12px}
  .tab{flex:1;text-align:center;border:1px solid var(--border);padding:10px;border-radius:8px;cursor:pointer;background:#fff}
  .tab.active{background:#f1f5f9}
  .hidden{display:none}
    .row{display:grid;gap:8px}

/* -------------------------
   Login UI polish (Dec 2025)
   ------------------------- */

/* Fix “blurry” bold text rendering */
html, body {
  height: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
  font-synthesis: none; /* prevents faux-bold in some setups */
}

/* Reduce/remove the heavy gradient on the background
   (your page was flat grey; this gives you the clean blue look) */
body {
  background-color: #0e86c7 !important; /* solid */
  background-image: none !important;    /* kill gradients */
}


/* Remove any shadow behind the white box (future-proof) */
.card,
.panel,
.auth-card,
.modal,
div[role="dialog"] {
  box-shadow: none !important;
}

/* Keep a soft border so it still “lifts” without a shadow */
.card,
.panel,
.auth-card {
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
}

/* If your title feels too heavy */
h1 {
  font-weight: 700;
}

/* Force SOLID TIXALL blue (no overlays, no gradients) */
html, body, .wrap {
  background:#009fe3 !important;
  background-image:none !important;
}

body::before, body::after, .wrap::before, .wrap::after {
  content:none !important;
  display:none !important;
}

body, .wrap {
  filter:none !important;
  backdrop-filter:none !important;
}

</style>

  
  </head>
<body>
<div class="wrap">
  <div class="card">
    <div class="tabs">
      <div class="tab active" data-tab="login">Sign in</div>
      <div class="tab" data-tab="signup">Create account</div>
      <div class="tab" data-tab="forgot">Forgot password</div>
    </div>

    <!-- LOGIN -->
    <form id="f-login" class="row">
      <label for="login-email">Email</label>
      <input id="login-email" name="email" type="email" autocomplete="username" required />
   <label for="login-password">Password</label>
<input id="login-password" name="password" type="password" autocomplete="current-password" required />

<div style="margin-top:10px">
  <a href="#" id="go-forgot" style="color:#0284c7;text-decoration:none;font-size:13px">
    Forgot password?
  </a>
</div>

<button type="submit">Sign in</button>

      <div id="login-err" class="err"></div>
      <div class="muted">After signing in you’ll be taken to your organiser console.</div>
    </form>

    <!-- SIGNUP -->
    <form id="f-signup" class="row hidden">
      <label for="su-name">Name (optional)</label>
      <input id="su-name" name="name" type="text" autocomplete="name" />
      <label for="su-email">Email</label>
      <input id="su-email" name="email" type="email" autocomplete="email" required />
      <label for="su-password">Password</label>
      <input id="su-password" name="password" type="password" autocomplete="new-password" required />
      <button type="submit">Create account</button>
      <div id="signup-err" class="err"></div>
      <div class="muted">We’ll create your organiser login and sign you in.</div>
    </form>

    <!-- FORGOT -->
    <form id="f-forgot" class="row hidden">
      <label for="fp-email">Email</label>
      <input id="fp-email" name="email" type="email" autocomplete="email" required />
      <button type="submit">Send reset link</button>
      <div id="forgot-err" class="err"></div>
      <div class="muted">We’ll email you a password reset link if your account exists.</div>
    </form>

  </div>
</div>

<script>
(function(){
  // Tab logic
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const views = {
    login:  document.getElementById('f-login'),
    signup: document.getElementById('f-signup'),
    forgot: document.getElementById('f-forgot'),
  };
  function sel(tab){
    tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
    Object.keys(views).forEach(k=>views[k].classList.toggle('hidden', k!==tab));
  }
  tabs.forEach(t => t.addEventListener('click', () => sel(t.dataset.tab)));

    // "Forgot password?" link under login password -> switch to Forgot tab
  const goForgot = document.getElementById('go-forgot');
  if (goForgot) {
    goForgot.addEventListener('click', (e) => {
      e.preventDefault();
      sel('forgot');
      // optional: prefill forgot email from login email
      const em = (document.getElementById('login-email')?.value || '').trim();
      if (em) document.getElementById('fp-email').value = em;
      document.getElementById('fp-email')?.focus();
    });
  }


  // Prefill from query params (for convenience)
  try{
    const u = new URL(window.location.href);
    const em = u.searchParams.get('email') || '';
    const pw = u.searchParams.get('password') || '';
    if(em) document.getElementById('login-email').value = em;
    if(pw) document.getElementById('login-password').value = pw;
  }catch(e){}

  // If already authenticated, jump to console (best-effort)
  (async function(){
    try{
      const r = await fetch('/auth/me', { credentials:'include' });
      if(r.ok){
        const j = await r.json().catch(()=>({}));
        if(j && j.ok){ window.location.href = '/admin/ui#home'; }
      }
    }catch(e){}
  })();

  // Helpers
  async function postJSON(url, body){
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      credentials:'include',
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(()=>({}));
    return { ok:r.ok && j && j.ok, status:r.status, data:j };
  }

  // Login submit
  document.getElementById('f-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('login-err'); err.textContent='';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { ok, data } = await postJSON('/auth/login', { email, password });
    if(!ok){ err.textContent = (data && data.error) || 'Sign in failed'; return; }
    window.location.href = '/admin/ui#home';
  });

  // Signup submit
  document.getElementById('f-signup').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('signup-err'); err.textContent='';
    const name = document.getElementById('su-name').value.trim() || undefined;
    const email = document.getElementById('su-email').value.trim();
    const password = document.getElementById('su-password').value;
    const { ok, data } = await postJSON('/auth/signup', { email, password, name });
    if(!ok){ err.textContent = (data && data.error) || 'Sign up failed'; return; }
    // After successful signup, try logging in automatically
    const out = await postJSON('/auth/login', { email, password });
    if(!out.ok){ err.textContent = 'Account created but login failed. Try signing in.'; sel('login'); return; }
    window.location.href = '/admin/ui#home';
  });

  // Forgot submit
  document.getElementById('f-forgot').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('forgot-err'); err.textContent='';
    const email = document.getElementById('fp-email').value.trim();
const { ok, data } = await postJSON('/auth/forgot-password', { email });
    if(!ok){
      err.textContent = (data && data.error) || 'Password reset endpoint not available yet.';
      return;
    }
    err.style.color = '#15803d';
    err.textContent = 'If the email exists, a reset link has been sent.';
  });

})();
</script>
</body>
</html>`);
});

export default router;
