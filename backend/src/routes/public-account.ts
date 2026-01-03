import { Router } from "express";
import prisma from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/security.js";
import {
  clearCustomerCookie,
  readCustomerSession,
  setCustomerCookie,
  signCustomerToken,
} from "../lib/customer-auth.js";
import { ensureMembership, mergeGuestCart } from "../lib/public-customer.js";

const router = Router();

function escHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAccountPage(storefrontSlug: string, storefrontName: string) {
  const title = escHtml(`${storefrontName} · Account`);
  const safeName = escHtml(storefrontName);
  const safeSlug = encodeURIComponent(storefrontSlug);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .title{margin:0 0 6px;font-size:1.6rem}
    .muted{color:var(--muted)}
    .input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:10px}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap}
    .hidden{display:none}
    .divider{height:1px;background:var(--border);margin:16px 0}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">${safeName} account</h1>
    <p class="muted">Sign in or create an account to manage your tickets.</p>

    <div class="card" id="signed-out">
      <h2>Sign in</h2>
      <input class="input" id="loginEmail" type="email" placeholder="Email" autocomplete="email" />
      <input class="input" id="loginPassword" type="password" placeholder="Password" autocomplete="current-password" />
      <div class="btn-row">
        <button class="btn primary" id="loginBtn">Sign in</button>
      </div>

      <div class="divider"></div>

      <h2>Create account</h2>
      <input class="input" id="signupName" type="text" placeholder="Full name" autocomplete="name" />
      <input class="input" id="signupEmail" type="email" placeholder="Email" autocomplete="email" />
      <input class="input" id="signupPassword" type="password" placeholder="Password" autocomplete="new-password" />
      <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
        <input type="checkbox" id="signupConsent" />
        I agree to receive updates from ${safeName}.
      </label>
      <div class="btn-row">
        <button class="btn" id="signupBtn">Create account</button>
      </div>
      <p class="muted" id="authMessage"></p>
    </div>

    <div class="card hidden" id="signed-in" style="margin-top:16px">
      <h2>You're signed in</h2>
      <p class="muted" id="welcomeText"></p>
      <div class="btn-row">
        <a class="btn primary" href="/public/${safeSlug}/account/portal">Go to portal</a>
        <button class="btn" id="logoutBtn">Sign out</button>
      </div>
    </div>
  </div>

  <script>
    const storefrontSlug = ${JSON.stringify(storefrontSlug)};
    const authMessage = document.getElementById('authMessage');
    const signedOut = document.getElementById('signed-out');
    const signedIn = document.getElementById('signed-in');
    const welcomeText = document.getElementById('welcomeText');

    async function postJSON(url, payload) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function getJSON(url) {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function applySession() {
      try {
        const data = await getJSON('/public/auth/session?storefront=' + encodeURIComponent(storefrontSlug));
        if (!data.ok || !data.customer) return;
        signedOut.classList.add('hidden');
        signedIn.classList.remove('hidden');
        welcomeText.textContent = 'Signed in as ' + data.customer.email;
      } catch {}
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/' + storefrontSlug + '/account/login', {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Sign in failed';
      }
    });

    document.getElementById('signupBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/' + storefrontSlug + '/account/register', {
          name: document.getElementById('signupName').value,
          email: document.getElementById('signupEmail').value,
          password: document.getElementById('signupPassword').value,
          marketingConsent: document.getElementById('signupConsent').checked,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Signup failed';
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await postJSON('/public/' + storefrontSlug + '/account/logout');
      location.reload();
    });

    applySession();
  </script>
</body>
</html>`;
}

function renderPortalPage(storefrontSlug: string, storefrontName: string, customerEmail: string) {
  const safeSlug = encodeURIComponent(storefrontSlug);
  const safeName = escHtml(storefrontName);
  const safeEmail = escHtml(customerEmail);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeName} · Portal</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .title{margin:0 0 6px;font-size:1.6rem}
    .muted{color:var(--muted)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">${safeName} portal</h1>
    <div class="card">
      <p class="muted">Signed in as ${safeEmail}.</p>
      <div class="btn-row">
        <a class="btn" href="/public/${safeSlug}/account">Back to account</a>
        <button class="btn primary" id="logoutBtn">Sign out</button>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/public/${safeSlug}/account/logout', { method: 'POST', credentials: 'include' });
      location.href = '/public/${safeSlug}/account';
    });
  </script>
</body>
</html>`;
}

router.get("/:organiserSlug/account", async (req, res) => {
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: organiserSlug },
    select: { companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || organiserSlug;
  res.type("html").send(renderAccountPage(organiserSlug, storefrontName));
});

router.get("/:organiserSlug/account/portal", async (req, res) => {
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: organiserSlug },
    select: { companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");

  const session = await readCustomerSession(req);
  if (!session?.sub) {
    return res.redirect(`/public/${encodeURIComponent(organiserSlug)}/account`);
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(session.sub) },
    select: { email: true },
  });

  if (!customer?.email) {
    clearCustomerCookie(res);
    return res.redirect(`/public/${encodeURIComponent(organiserSlug)}/account`);
  }

  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || organiserSlug;
  res.type("html").send(renderPortalPage(organiserSlug, storefrontName, customer.email));
});

router.post("/:organiserSlug/account/register", async (req, res) => {
  try {
    const organiserSlug = String(req.params.organiserSlug || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;
    const marketingConsent = Boolean(req.body?.marketingConsent || false);

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const existing = await prisma.customerAccount.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Account already exists" });
    }

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customerAccount.create({
      data: {
        email,
        passwordHash,
        name,
        marketingConsent,
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true, name: true },
    });

    await ensureMembership(customer.id, organiserSlug);
    await mergeGuestCart(req, res, customer.id, organiserSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    return res.status(201).json({ ok: true, customer });
  } catch (error: any) {
    console.error("public account register failed", error);
    return res.status(500).json({ ok: false, error: "Failed to create account" });
  }
});

router.post("/:organiserSlug/account/login", async (req, res) => {
  try {
    const organiserSlug = String(req.params.organiserSlug || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const customer = await prisma.customerAccount.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    await prisma.customerAccount.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    await ensureMembership(customer.id, organiserSlug);
    await mergeGuestCart(req, res, customer.id, organiserSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    return res.json({ ok: true, customer: { id: customer.id, email: customer.email, name: customer.name } });
  } catch (error: any) {
    console.error("public account login failed", error);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

router.post("/:organiserSlug/account/logout", (_req, res) => {
  clearCustomerCookie(res);
  res.json({ ok: true });
});

export default router;
