import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = String(process.env.JWT_SECRET || "dev-secret");
const COOKIE_NAME = "session";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true, // on Railway it's HTTPS
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days (seconds)
};

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "email already in use" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);

    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        name: name ?? null,
        passwordHash,
        role: "admin", // you can change this default later
      },
      select: { id: true, email: true, name: true, role: true }
    });

    // auto-login after register
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role ?? "user" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.status(201).json({ ok: true, user, token });
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

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role ?? "user" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // set cookie for browser usage AND return token for API tooling if you want it
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ ok: true, token });
  } catch (err) {
    console.error("login failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// GET /auth/logout
router.get("/logout", async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
  // send JSON (your admin UI reads JSON) – or change to redirect if you prefer
  return res.json({ ok: true });
});

export default router;