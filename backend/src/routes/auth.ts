// backend/src/routes/auth.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signUserJwt, verifyUserJwt } from '../lib/jwt.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /auth/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email & password required' });
    }
    const lower = String(email).toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: lower } });
    if (existing) return res.status(409).json({ error: true, message: 'User already exists' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email: lower, password: hash, name: name ? String(name) : null }
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

/**
 * POST /auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email & password required' });
    }
    const lower = String(email).toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: lower } });
    if (!user || !user.password) {
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }
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

/**
 * POST /auth/logout
 */
router.post('/logout', async (_req, res) => {
  res.clearCookie('auth', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

/**
 * GET /auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const auth = req.cookies?.auth;
    if (!auth) return res.status(401).json({ error: true, message: 'Not signed in' });
    const payload = await verifyUserJwt(auth);
    if (!payload?.id) return res.status(401).json({ error: true, message: 'Invalid token' });
    const user = await prisma.user.findUnique({ where: { id: String(payload.id) } });
    if (!user) return res.status(401).json({ error: true, message: 'Invalid token' });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    res.status(401).json({ error: true, message: 'Not signed in' });
  }
});

/**
 * POST /auth/request-reset
 * body: { email }
 */
router.post('/request-reset', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // do not reveal user existence
      return res.json({ ok: true });
    }
    const token = cryptoRandom();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt }
    });
    // send email via your service/email.ts (optional hook)
    // await sendPasswordResetEmail(user.email, token);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to request reset' });
  }
});

/**
 * POST /auth/reset-password
 * body: { token, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ ok: false, message: 'token and newPassword required' });
    const pr = await prisma.passwordReset.findUnique({ where: { token: String(token) } });
    if (!pr) return res.status(400).json({ ok: false, message: 'Invalid token' });

    // ✅ handle nullable expiresAt
    if (pr.expiresAt && pr.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: 'Token expired' });
    }
    if (pr.usedAt) {
      return res.status(400).json({ ok: false, message: 'Token already used' });
    }

    const user = await prisma.user.findUnique({ where: { id: pr.userId } });
    if (!user) return res.status(400).json({ ok: false, message: 'Invalid token' });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hash } }),
      prisma.passwordReset.update({ where: { token: pr.token }, data: { usedAt: new Date() } })
    ]);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to reset password' });
  }
});

function cryptoRandom() {
  // simple URL-safe random token
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.charAt(b % 64))
    .join('');
}

export default router;
