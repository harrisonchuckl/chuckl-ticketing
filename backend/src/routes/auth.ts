import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth.js";


const prisma = new PrismaClient();
const router = Router();

function sign(user: { id: string; email: string; role: string | null }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? "user" },
    String(process.env.JWT_SECRET || "dev-secret"),
{ expiresIn: Math.floor((Number(process.env.AUTH_SESSION_MS || 60*60*1000)) / 1000) }
   );
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

    const token = sign(user);
   res.cookie("auth", token, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: Number(process.env.AUTH_SESSION_MS || 60 * 60 * 1000),
  path: "/",
});

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("login failed", err);
    return res.status(500).json({ error: "internal error" });
  }
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
