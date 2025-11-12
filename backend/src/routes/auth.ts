import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = Router();

function sign(user: { id: string; email: string; role: string | null }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? "user" },
    String(process.env.JWT_SECRET || "dev-secret"),
    { expiresIn: "7d" }
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
      secure: true, // Railway is HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("login failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// GET /auth/logout  (fixes your 404)
router.get("/logout", (req, res) => {
  res.clearCookie("auth", { httpOnly: true, sameSite: "lax", secure: true });
  return res.json({ ok: true });
});

// (Optional) GET /auth/me
router.get("/me", (req, res) => {
  const token = (req.cookies?.auth as string) || "";
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    const payload = jwt.verify(token, String(process.env.JWT_SECRET || "dev-secret"));
    return res.json({ ok: true, user: payload });
  } catch {
    return res.status(401).json({ error: "unauthenticated" });
  }
});

export default router;