// backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { signUserJwt } from '../lib/jwt.js';
import { sendPasswordResetEmail, buildPublicUrl } from '../lib/mail.js';
import crypto from 'crypto';

const router = Router();

// Helpers
function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase();
}

function setAuthCookie(res: any, token: string) {
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// GET /auth/me
router.get('/auth/me', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: true, message: 'Not signed in' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } });
    if (!user) return res.status(401).json({ error: true, message: 'Not signed in' });
    res.json({ ok: true, user });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Failed' });
  }
});

// POST /auth/signup
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });

    const emailNorm = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) return res.status(409).json({ error: true, message: 'User already exists' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email: emailNorm, password: hash, name: name ? String(name) : null }
    });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    setAuthCookie(res, token);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Signup failed' });
  }
});

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });

    const emailNorm = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user || !user.password) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name || null });
    setAuthCookie(res, token);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Login failed' });
  }
});

// POST /auth/logout
router.post('/auth/logout', async (_req, res) => {
  res.clearCookie('auth', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

// POST /auth/request-reset
router.post('/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: true, message: 'Email required' });
    const emailNorm = normalizeEmail(email);

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    // Always respond OK to avoid account enumeration
    if (!user) return res.json({ ok: true });

    // Create token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt }
    });

    const link = buildPublicUrl(`/auth/reset/${token}`);
    await sendPasswordResetEmail(user.email, link);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Request failed' });
  }
});

// POST /auth/reset
// body: { token: string, password: string }
router.post('/auth/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: true, message: 'Token & password required' });

    const row = await prisma.passwordReset.findUnique({ where: { token: String(token) } });
    if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: true, message: 'Invalid or expired reset link' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { password: hash } }),
      prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } })
    ]);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Reset failed' });
  }
});

export default router;
