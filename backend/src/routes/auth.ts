import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcryptNS from "bcryptjs";

// Works whether bcryptjs arrives as a namespace object or default export (ESM/CJS interop)
const bcrypt: any = (bcryptNS as any).default ?? bcryptNS;
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth.js";

import crypto from "crypto";
import { sendMail } from "../lib/mailer.js";

const prisma = new PrismaClient();
const router = Router();

function sign(user: { id: string; email: string; role: string | null }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? "user" },
    String(process.env.JWT_SECRET || "dev-secret"),
{ expiresIn: Math.floor((Number(process.env.AUTH_SESSION_MS || 60*60*1000)) / 1000) }
   );
}

function normaliseStorefrontSlug(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function appOriginFromRequest(req: any) {
  // Prefer explicit env (recommended)
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;

  // Fallbacks
  const origin = req.headers?.origin;
  if (typeof origin === "string" && origin.startsWith("http")) return origin;

  const host = req.headers?.host;
  if (typeof host === "string" && host.length) return `https://${host}`;

  return "http://localhost:4000";
}

function adminApprovalEmail() {
  return String(process.env.ADMIN_APPROVAL_EMAIL || "harrison@chuckl.co.uk").trim();
}

function accountActivationTtlHours() {
  return Number(process.env.ACCOUNT_ACTIVATION_TTL_HOURS || "72");
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "email already in use" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);

    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash },
      select: { id: true, email: true, name: true, role: true }
    });

    const token = sign(user);
    // Set a cookie for web flows; also return token in JSON for API use
   res.cookie("auth", token, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: Number(process.env.AUTH_SESSION_MS || 60 * 60 * 1000),
  path: "/",
});


    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("register failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// POST /auth/request-access
router.post("/request-access", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const companyName = String(req.body?.companyName || "").trim();

    if (!name || !email || !companyName) {
      return res.status(400).json({ error: "name, email, and company name are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const existingRequest = await prisma.accessRequest.findUnique({ where: { email } });
    if (existingRequest) {
      await prisma.accessRequest.update({
        where: { email },
        data: {
          name,
          companyName,
          tokenHash,
          approvedAt: null,
          approvedBy: null,
        },
      });
    } else {
      await prisma.accessRequest.create({
        data: {
          name,
          email,
          companyName,
          tokenHash,
        },
      });
    }

    const origin = appOriginFromRequest(req);
    const approveLink = `${origin}/auth/approve-request?token=${encodeURIComponent(token)}`;

    sendMail({
      to: adminApprovalEmail(),
      subject: "New organiser access request",
      text:
        `A new organiser has requested access.\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Company: ${companyName}\n\n` +
        `Approve: ${approveLink}\n`,
      html:
        `<p>A new organiser has requested access.</p>` +
        `<ul>` +
        `<li><strong>Name:</strong> ${name}</li>` +
        `<li><strong>Email:</strong> ${email}</li>` +
        `<li><strong>Company:</strong> ${companyName}</li>` +
        `</ul>` +
        `<p><a href="${approveLink}">Approve this request</a></p>`,
    }).catch((e) => console.error("[mailer] send failed", e));

    return res.json({ ok: true });
  } catch (err) {
    console.error("request-access failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// GET /auth/approve-request?token=...
router.get("/approve-request", async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).send("Missing approval token.");

    const tokenHash = sha256(token);
    const request = await prisma.accessRequest.findUnique({ where: { tokenHash } });
    if (!request) return res.status(404).send("Request not found.");

    if (request.approvedAt) {
      return res.type("html").send("<p>This request has already been approved.</p>");
    }

    let user = await prisma.user.findUnique({ where: { email: request.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: request.email,
          name: request.name ?? null,
          companyName: request.companyName ?? null,
          role: "ORGANISER",
        },
      });
    } else if (!user.role) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ORGANISER" },
      });
    }

    const activationToken = crypto.randomBytes(32).toString("hex");
    const activationTokenHash = sha256(activationToken);
    const expiresAt = new Date(Date.now() + accountActivationTtlHours() * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: activationTokenHash,
        resetTokenExpiresAt: expiresAt,
        resetTokenRequestedAt: new Date(),
        resetTokenUsedAt: null,
      },
    });

    await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        approvedAt: new Date(),
        approvedBy: adminApprovalEmail(),
      },
    });

    const origin = appOriginFromRequest(req);
    const activateLink = `${origin}/auth/activate?token=${encodeURIComponent(
      activationToken
    )}`;

    await sendMail({
      to: request.email,
      subject: "Your organiser account is approved",
      text:
        `Your organiser account has been approved.\n\n` +
        `Set your password here: ${activateLink}\n`,
      html:
        `<p>Your organiser account has been approved.</p>` +
        `<p><a href="${activateLink}">Set your password and open your account</a></p>`,
    });

    return res.type("html").send("<p>Approved. The organiser has been emailed.</p>");
  } catch (err) {
    console.error("approve-request failed", err);
    return res.status(500).send("Something went wrong.");
  }
});

// GET /auth/activate?token=...
router.get("/activate", (req, res) => {
  const token = String(req.query?.token || "");
  res.type("html").send(`<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Activate account</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f7f8fb}
.card{max-width:440px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
label{display:block;font-size:12px;font-weight:700;margin:10px 0 6px;color:#334155}
input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
.muted{color:#64748b;font-size:13px;line-height:1.4}
.err{color:#b91c1c;font-size:13px;margin-top:10px}
.ok{color:#166534;font-size:13px;margin-top:10px}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 6px">Create your password</h2>
    <div class="muted">Set a password to access the organiser console.</div>

    <label>Password</label>
    <input id="pw" type="password" autocomplete="new-password" />

    <button id="btn">Create password</button>
    <div id="msg" class="muted" style="margin-top:10px"></div>
  </div>

<script>
const token = ${JSON.stringify(token)};
document.getElementById('btn').addEventListener('click', async () => {
  const password = document.getElementById('pw').value;
  const msg = document.getElementById('msg');
  msg.textContent = 'Saving…';
  try{
    const res = await fetch('/auth/activate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body: JSON.stringify({ token, password })
    });
    const txt = await res.text();
    if(!res.ok){
      let e = 'Activation failed';
      try{ e = (JSON.parse(txt).error) || e; }catch{}
      msg.textContent = e;
      msg.className = 'err';
      return;
    }
    msg.textContent = 'Password created. Redirecting…';
    msg.className = 'ok';
    setTimeout(() => location.href = '/admin/ui/account', 800);
  }catch(e){
    msg.textContent = 'Something went wrong. Please try again.';
    msg.className = 'err';
  }
});
</script>
</body></html>`);
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    let role = user.role ?? null;

    if (!role) {
      const approvedRequest = await prisma.accessRequest.findUnique({
        where: { email: user.email },
        select: { approvedAt: true },
      });

      if (approvedRequest?.approvedAt) {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { role: "ORGANISER" },
          select: { role: true },
        });
        role = updated.role;
      }
    }

    const token = sign({ id: user.id, email: user.email, role });

    res.cookie("auth", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Number(process.env.AUTH_SESSION_MS || 60 * 60 * 1000),
      path: "/",
    });

    return res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("login failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.json({ ok: true });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true });

    const last = (user as any).resetTokenRequestedAt as Date | null;
    if (last && Date.now() - last.getTime() < 60_000) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const ttlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES || "30");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt,
        resetTokenRequestedAt: new Date(),
        resetTokenUsedAt: null,
      },
    });

    const origin = appOriginFromRequest(req);
    const resetLink = `${origin}/auth/reset?token=${encodeURIComponent(token)}`;

    sendMail({
  to: email,
  subject: "Reset your TicketIn password",
  text: `Use this link to reset your password (expires in ${ttlMinutes} minutes):\n\n${resetLink}`,
  html:
    `<p>Use this link to reset your password (expires in ${ttlMinutes} minutes):</p>` +
    `<p><a href="${resetLink}">${resetLink}</a></p>`,
}).catch((e) => console.error("[mailer] send failed", e));

return res.json({ ok: true });
  } catch (err) {
    console.error("forgot-password failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.password || "");

    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and password are required" });
    }
    if (newPassword.length < 10) {
      return res.status(400).json({ error: "password must be at least 10 characters" });
    }

    const tokenHash = sha256(token);

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenUsedAt: null,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return res.status(400).json({ error: "invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(newPassword), salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenUsedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("reset-password failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// POST /auth/activate
router.post("/activate", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.password || "");

    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and password are required" });
    }
    if (newPassword.length < 10) {
      return res.status(400).json({ error: "password must be at least 10 characters" });
    }

    const tokenHash = sha256(token);

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenUsedAt: null,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return res.status(400).json({ error: "invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(newPassword), salt);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenUsedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        role: user.role ?? "ORGANISER",
      },
      select: { id: true, email: true, role: true },
    });

    const authToken = sign(updated);
    res.cookie("auth", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Number(process.env.AUTH_SESSION_MS || 60 * 60 * 1000),
      path: "/",
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("activate failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// GET /auth/forgot (simple page)
router.get("/forgot", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Forgot password</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f7f8fb}
.card{max-width:440px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
label{display:block;font-size:12px;font-weight:700;margin:10px 0 6px;color:#334155}
input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
a{color:#0284c7;text-decoration:none}
.muted{color:#64748b;font-size:13px;line-height:1.4}
.err{color:#b91c1c;font-size:13px;margin-top:10px}
.ok{color:#166534;font-size:13px;margin-top:10px}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 6px">Reset your password</h2>
    <div class="muted">Enter your email and we’ll send you a reset link.</div>

    <label>Email</label>
    <input id="email" type="email" autocomplete="email" />

    <button id="btn">Send reset link</button>
    <div id="msg" class="muted" style="margin-top:10px"></div>

    <div class="muted" style="margin-top:12px">
      <a href="/admin/ui/login">Back to login</a>
    </div>
  </div>

<script>
document.getElementById('btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const msg = document.getElementById('msg');
  msg.textContent = 'Sending…';
  try{
    const res = await fetch('/auth/forgot-password', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body: JSON.stringify({ email })
    });
    await res.text();
    msg.textContent = 'If that email exists, a reset link has been sent.';
    msg.className = 'ok';
  }catch(e){
    msg.textContent = 'Something went wrong. Please try again.';
    msg.className = 'err';
  }
});
</script>
</body></html>`);
});

// GET /auth/reset?token=...
router.get("/reset", (req, res) => {
  const token = String(req.query?.token || "");
  res.type("html").send(`<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Set new password</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f7f8fb}
.card{max-width:440px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
label{display:block;font-size:12px;font-weight:700;margin:10px 0 6px;color:#334155}
input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
.muted{color:#64748b;font-size:13px;line-height:1.4}
.err{color:#b91c1c;font-size:13px;margin-top:10px}
.ok{color:#166534;font-size:13px;margin-top:10px}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 6px">Choose a new password</h2>
    <div class="muted">Your reset link expires automatically.</div>

    <label>New password</label>
    <input id="pw" type="password" autocomplete="new-password" />

    <button id="btn">Set password</button>
    <div id="msg" class="muted" style="margin-top:10px"></div>
  </div>

<script>
const token = ${JSON.stringify(token)};
document.getElementById('btn').addEventListener('click', async () => {
  const password = document.getElementById('pw').value;
  const msg = document.getElementById('msg');
  msg.textContent = 'Saving…';
  try{
    const res = await fetch('/auth/reset-password', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body: JSON.stringify({ token, password })
    });
    const txt = await res.text();
    if(!res.ok){
      let e = 'Reset failed';
      try{ e = (JSON.parse(txt).error) || e; }catch{}
      msg.textContent = e;
      msg.className = 'err';
      return;
    }
    msg.textContent = 'Password updated. You can now log in.';
    msg.className = 'ok';
    setTimeout(() => location.href = '/admin/ui/login', 800);
  }catch(e){
    msg.textContent = 'Something went wrong. Please try again.';
    msg.className = 'err';
  }
});
</script>
</body></html>`);
});



// GET /auth/logout  (fixes your 404)
router.get("/logout", (req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  // If called from the browser/UI, redirect to the login page
  const redirectTo = typeof req.query.redirect === "string" ? req.query.redirect : "/admin/ui/login";
  return res.redirect(redirectTo);
});


// GET /auth/me - returns the real user record (safe fields)
router.get("/me", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,

      // Business & Storefront
      storefrontSlug: true,
      companyName: true,
      tradingName: true,
      companyNumber: true,
      vatNumber: true,
      phone: true,
      brandLogoUrl: true,
      brandColorRgb: true,
      brandColorHex: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      county: true,
      postcode: true,
      country: true,
    },
  });

  if (!user) return res.status(404).json({ error: "user not found" });
  return res.json({ ok: true, user });
});

// PUT /auth/me - update profile + business/storefront fields
router.put("/me", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const storefrontSlug =
    req.body?.storefrontSlug === undefined
      ? undefined
      : normaliseStorefrontSlug(req.body.storefrontSlug);

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: typeof req.body?.name === "string" ? req.body.name.trim() : undefined,
        email: typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined,

        companyName: req.body?.companyName ?? null,
        tradingName: req.body?.tradingName ?? null,
        companyNumber: req.body?.companyNumber ?? null,
        vatNumber: req.body?.vatNumber ?? null,
        phone: req.body?.phone ?? null,
        brandLogoUrl: req.body?.brandLogoUrl ?? null,
        brandColorRgb: req.body?.brandColorRgb ?? null,
        brandColorHex: req.body?.brandColorHex ?? null,
        addressLine1: req.body?.addressLine1 ?? null,
        addressLine2: req.body?.addressLine2 ?? null,
        city: req.body?.city ?? null,
        county: req.body?.county ?? null,
        postcode: req.body?.postcode ?? null,
        country: req.body?.country ?? null,

        storefrontSlug: storefrontSlug || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,

        storefrontSlug: true,
        companyName: true,
        tradingName: true,
        companyNumber: true,
        vatNumber: true,
        phone: true,
        brandLogoUrl: true,
        brandColorRgb: true,
        brandColorHex: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        county: true,
        postcode: true,
        country: true,
      },
    });

    return res.json({ ok: true, user: updated });
  } catch (e: any) {
    // Prisma unique violation (storefrontSlug unique)
    if (e?.code === "P2002") {
      return res.status(409).json({
        ok: false,
        message: "That storefront name is already taken. Please choose another.",
      });
    }
    console.error("auth/me update failed", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
});

// POST /auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) return res.status(400).json({ error: "invalid user" });

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(newPassword), salt);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return res.json({ ok: true });
});

export default router;
