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

    const token = sign({ id: user.id, email: user.email, role: user.role ?? null });

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

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function appOriginFromRequest(req: any) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;

  const origin = req.headers?.origin;
  if (typeof origin === "string" && origin.startsWith("http")) return origin;

  const host = req.headers?.host;
  if (typeof host === "string" && host.length) return `https://${host}`;

  return "http://localhost:4000";
}

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

    await sendMail({
      to: email,
      subject: "Reset your TicketIn password",
      text: `Use this link to reset your password (expires in ${ttlMinutes} minutes):\n\n${resetLink}`,
      html:
        `<p>Use this link to reset your password (expires in ${ttlMinutes} minutes):</p>` +
        `<p><a href="${resetLink}">${resetLink}</a></p>`,
    });

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
      // add more fields here later (phone/company/etc)
    },
  });

  if (!user) return res.status(404).json({ error: "user not found" });
  return res.json({ ok: true, user });
});

// PUT /auth/me - update profile fields
router.put("/me", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { name, email } = req.body ?? {};

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: typeof name === "string" ? name.trim() : undefined,
      email: typeof email === "string" ? email.trim().toLowerCase() : undefined,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return res.json({ ok: true, user: updated });
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
