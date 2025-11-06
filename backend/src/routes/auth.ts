// backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { signUserJwt, verifyUserJwt } from '../lib/jwt.js';

const router = Router();

// POST /auth/signup
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });

    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (existing) return res.status(409).json({ error: true, message: 'User already exists' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        password: hash,
        name: name ? String(name) : null
      }
    });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    res
      .cookie('auth', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      .json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Signup failed' });
  }
});

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.password) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    res
      .cookie('auth', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      .json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Login failed' });
  }
});

// POST /auth/logout
router.post('/auth/logout', async (_req, res) => {
  res.clearCookie('auth', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ ok: true });
});

// GET /auth/me
router.get('/auth/me', async (req, res) => {
  try {
    const cookie = req.cookies?.auth;
    if (!cookie) return res.status(401).json({ error: true, message: 'Not signed in' });
    const user = await verifyUserJwt(cookie);
    if (!user) return res.status(401).json({ error: true, message: 'Invalid token' });

    // Refresh minimal profile
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return res.status(401).json({ error: true, message: 'User not found' });

    res.json({ ok: true, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name } });
  } catch {
    res.status(401).json({ error: true, message: 'Not signed in' });
  }
});

export default router;
