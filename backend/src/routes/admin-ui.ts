// backend/src/routes/admin-ui.ts
import { Router } from 'express';

const router = Router();

router.get('/ui', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Organiser Console</title>
<style>
  :root{
    --bg:#f7f8fa;--panel:#fff;--ink:#0f172a;--muted:#6b7280;--accent:#2563eb;--accent-2:#eff6ff;--border:#e5e7eb;--bad:#dc2626;--ok:#16a34a
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:5}
  header .brand{font-weight:800} header .user{font-size:14px;color:var(--muted)}
  main{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px;min-height:calc(100vh - 64px)}
  nav{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px}
  nav h4{margin:8px 10px 12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  nav button{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;border-radius:10px;margin:2px 0;font-size:14px;color:var(--ink);cursor:pointer}
  nav button.active,nav button:hover{background:var(--accent-2);color:var(--accent)}
  section.view{background:var(--panel);border:1px solid var(--border);border-radius:14px;min-height:60vh}
  .toolbar{display:flex;gap:8px;align-items:center;padding:14px;border-bottom:1px solid var(--border)}
  .toolbar h2{font-size:16px;margin:0}
  .content{padding:16px}
  .grid{display:grid;gap:12px}.two{grid-template-columns:1fr 1fr}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  input,select,textarea{width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);font-size:14px}
  label{font-size:12px;color:var(--muted)}
  .btn{border:0;border-radius:10px;padding:10px 12px;font-weight:600;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff}.btn.ghost{background:#fff;border:1px solid var(--border)}
  .note{font-size:13px;color:var(--muted)}
  .card{border:1px solid var(--border);border-radius:12px;padding:12px;background:#fff}
  .danger{color:var(--bad)} .ok{color:var(--ok)}
  .overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:50}
  .overlay.show{display:flex}
  .login{width:420px;background:#fff;border-radius:14px;border:1px solid var(--border);padding:18px}
  .login h3{margin:0 0 8px}
  .tabs{display:flex;gap:8px;margin:8px 0 16px}
  .tabs button{border:1px solid var(--border);background:#fff;padding:8px 10px;border-radius:8px;cursor:pointer}
  .tabs button.active{background:var(--accent-2);color:var(--accent)}
  .hidden{display:none}
  .success{color:var(--ok)}
</style>
</head>
<body>
<header>
  <div class="brand">Organiser Console</div>
  <div class="user"><span id="userEmail">Not signed in</span></div>
</header>

<main>
  <nav>
    <h4>Dashboard</h4>
    <button data-view="home" class="active">Home</button>
    <button data-view="shows">Shows</button>
    <button data-view="venues">Venues</button>
    <button data-view="orders">Orders</button>
    <h4>Marketing</h4>
    <button data-view="audiences">Audiences</button>
    <button data-view="emails">Email Campaigns</button>
    <h4>Settings</h4>
    <button data-view="account">Account</button>
    <button id="btnLogout" class="danger">Log out</button>
  </nav>

  <section class="view">
    <div class="toolbar"><h2 id="viewTitle">Home</h2></div>
    <div class="content" id="viewContent">
      <div class="card">
        <p>Welcome to your organiser console. Use the menu to manage shows, venues, orders, and marketing.</p>
        <p class="note">You’ll see more tools appear here as we build them in.</p>
      </div>
    </div>
  </section>
</main>

<div class="overlay" id="loginOverlay">
  <div class="login">
    <h3>Access your account</h3>
    <div class="tabs">
      <button id="tabSignIn" class="active">Sign in</button>
      <button id="tabSignUp">Create account</button>
      <button id="tabForgot">Forgot password</button>
    </div>

    <div id="paneSignIn">
      <div class="grid">
        <div><label>Email</label><input id="si_email" type="email" placeholder="you@venue.com"/></div>
        <div><label>Password</label><input id="si_password" type="password" placeholder="••••••••"/></div>
        <div class="row">
          <button class="btn primary" id="btnLogin">Sign in</button>
          <button class="btn ghost" id="btnDemo">Quick demo user</button>
        </div>
        <div class="note danger" id="loginError" style="display:none;"></div>
      </div>
    </div>

    <div id="paneSignUp" class="hidden">
      <div class="grid">
        <div><label>Name (optional)</label><input id="su_name" type="text" placeholder="Your name"/></div>
        <div><label>Email</label><input id="su_email" type="email" placeholder="you@venue.com"/></div>
        <div><label>Password</label><input id="su_password" type="password" placeholder="Create a password"/></div>
        <div class="row">
          <button class="btn primary" id="btnSignup">Create account</button>
        </div>
        <div class="note danger" id="signupError" style="display:none;"></div>
      </div>
    </div>

    <div id="paneForgot" class="hidden">
      <div class="grid">
        <div><label>Email</label><input id="fp_email" type="email" placeholder="you@venue.com"/></div>
        <div class="row">
          <button class="btn primary" id="btnRequestReset">Send reset link</button>
        </div>
        <div class="note" id="forgotMsg" style="display:none;"></div>
      </div>
    </div>

  </div>
</div>

<script>
(function(){
  const $ = (sel) => document.querySelector(sel);
  const API = (path, opts) => fetch(path, Object.assign({
    credentials:'include',
    headers:{'Content-Type':'application/json'}
  }, opts || {}));

  // Views (placeholder stubs – you already have these wiring up shows/venues elsewhere)
  const views = {
    home(){ 
      $('#viewTitle').textContent = 'Home';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Recent activity</h4><p class="note">Recent sales, scans and edits will appear here.</p></div>'
        + '<div class="card"><h4>Shortcuts</h4><div class="row">'
        + '<button class="btn ghost" data-goto="shows">Create show</button>'
        + '<button class="btn ghost" data-goto="venues">Add venue</button>'
        + '</div></div></div>';
      $('#viewContent').addEventListener('click', function(e){
        const el = e.target.closest('[data-goto]');
        if(!el) return;
        e.preventDefault();
        switchView(el.getAttribute('data-goto'));
      }, { once:true });
    },
    shows(){
      $('#viewTitle').textContent = 'Shows';
      $('#viewContent').innerHTML =
        '<div class="card"><p class="note">Shows management will load here.</p></div>';
    },
    venues(){
      $('#viewTitle').textContent = 'Venues';
      $('#viewContent').innerHTML =
        '<div class="card"><p class="note">Venue tools will load here.</p></div>';
    },
    orders(){
      $('#viewTitle').textContent = 'Orders';
      $('#viewContent').innerHTML = '<div class="note">Orders list coming next.</div>';
    },
    audiences(){
      $('#viewTitle').textContent = 'Audiences';
      $('#viewContent').innerHTML = '<div class="note">Audience tools coming soon.</div>';
    },
    emails(){
      $('#viewTitle').textContent = 'Email Campaigns';
      $('#viewContent').innerHTML = '<div class="note">Scheduler + templates placeholder.</div>';
    },
    account(){
      $('#viewTitle').textContent = 'Account';
      $('#viewContent').innerHTML = '<div class="note">Manage your password and organisation details.</div>';
    }
  };

  function switchView(name){
    document.querySelectorAll('nav button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-view')===name);
    });
    if (views[name]) views[name](); else views.home();
  }

  // Tabs
  const tabSignIn = $('#tabSignIn'), tabSignUp = $('#tabSignUp'), tabForgot = $('#tabForgot');
  const paneSignIn = $('#paneSignIn'), paneSignUp = $('#paneSignUp'), paneForgot = $('#paneForgot');

  function showPane(which){
    [paneSignIn, paneSignUp, paneForgot].forEach(el => el.classList.add('hidden'));
    [tabSignIn, tabSignUp, tabForgot].forEach(el => el.classList.remove('active'));
    if(which==='signin'){ paneSignIn.classList.remove('hidden'); tabSignIn.classList.add('active'); }
    if(which==='signup'){ paneSignUp.classList.remove('hidden'); tabSignUp.classList.add('active'); }
    if(which==='forgot'){ paneForgot.classList.remove('hidden'); tabForgot.classList.add('active'); }
  }
  tabSignIn.addEventListener('click', ()=>showPane('signin'));
  tabSignUp.addEventListener('click', ()=>showPane('signup'));
  tabForgot.addEventListener('click', ()=>showPane('forgot'));

  async function ensureAuth(){
    const me = await fetch('/auth/me', { credentials: 'include' });
    if(me.status===200){
      const j = await me.json();
      $('#userEmail').textContent = (j.user && j.user.email) ? j.user.email : 'Signed in';
      $('#loginOverlay').classList.remove('show');
      return true;
    } else {
      $('#loginOverlay').classList.add('show');
      return false;
    }
  }

  // Sidebar nav
  document.querySelectorAll('nav button[data-view]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Logout
  $('#btnLogout').addEventListener('click', async function(){
    await API('/auth/logout', { method:'POST' });
    location.reload();
  });

  // Sign in
  $('#btnLogin').addEventListener('click', async function(){
    const email = $('#si_email').value;
    const password = $('#si_password').value;
    const r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    const j = await r.json();
    if(!j.ok){
      const e = $('#loginError');
      e.textContent = j.message || 'Login failed';
      e.style.display = 'block';
      return;
    }
    location.reload();
  });

  // Demo
  $('#btnDemo').addEventListener('click', async function(){
    const email = 'demo@organiser.test';
    const password = 'demo1234';
    let r = await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    if(r.status===401){
      await API('/auth/signup', { method:'POST', body: JSON.stringify({ email, password, name: 'Demo User' }) });
    }
    await API('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    location.reload();
  });

  // Sign up
  $('#btnSignup').addEventListener('click', async function(){
    const email = $('#su_email').value;
    const password = $('#su_password').value;
    const name = $('#su_name').value;
    const r = await API('/auth/signup', { method:'POST', body: JSON.stringify({ email, password, name }) });
    const j = await r.json();
    if(!j.ok){
      const e = $('#signupError');
      e.textContent = j.message || 'Signup failed';
      e.style.display = 'block';
      return;
    }
    location.reload();
  });

  // Password reset request
  $('#btnRequestReset').addEventListener('click', async function(){
    const email = $('#fp_email').value;
    const r = await API('/auth/request-reset', { method:'POST', body: JSON.stringify({ email }) });
    // Always show success to avoid enumeration
    $('#forgotMsg').textContent = 'If the email exists, a reset link has been sent.';
    $('#forgotMsg').style.display = 'block';
  });

  (async function boot(){
    const ok = await ensureAuth();
    if(ok) switchView('home');
  })();
})();
</script>
</body>
</html>`);
});

export default router;
