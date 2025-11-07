import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { signUserJwt, verifyUserJwt } from '../lib/jwt.js';
import crypto from 'crypto';

const router = Router();

/** Helper to normalise emails */
function normEmail(e: unknown) {
  return String(e || '').trim().toLowerCase();
}

/** Create a cookie with JWT */
function setAuthCookie(res: any, token: string) {
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

/** /auth/signup */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email & password required' });
    }
    const em = normEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: em } });
    if (existing) return res.status(409).json({ error: true, message: 'User already exists' });

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { email: em, password: hash, name: name ? String(name) : null }
    });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    setAuthCookie(res, token);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Signup failed' });
  }
});

/** /auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email & password required' });
    }
    const em = normEmail(email);
    const user = await prisma.user.findUnique({ where: { email: em } });
    if (!user || !user.password) {
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const token = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    setAuthCookie(res, token);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Login failed' });
  }
});

/** /auth/logout */
router.post('/logout', async (_req, res) => {
  res.clearCookie('auth', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

/** /auth/me */
router.get('/me', async (req: any, res) => {
  try {
    const cookie = req.cookies?.auth;
    if (!cookie) return res.status(401).json({ error: true, message: 'Not signed in' });

    const payload = await verifyUserJwt(cookie);
    if (!payload?.id) return res.status(401).json({ error: true, message: 'Invalid token' });

    const user = await prisma.user.findUnique({ where: { id: String(payload.id) } });
    if (!user) return res.status(401).json({ error: true, message: 'User not found' });

    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    res.status(401).json({ error: true, message: 'Not signed in' });
  }
});

/** /auth/request-reset */
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: true, message: 'Email required' });

    const em = normEmail(email);
    const user = await prisma.user.findUnique({ where: { email: em } });
    // Respond success even if not found — avoids user enumeration leakage
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expiryMins = Number(process.env.RESET_TOKEN_MINS || 60);
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt }
    });

    const origin = process.env.PUBLIC_ORIGIN || '';
    const resetUrl = `${origin}/auth/reset/${token}`;

    // Email sending — simple console fallback to avoid blocking you
    // (You can plug in your real email provider here)
    // console.log('Password reset:', { to: em, resetUrl });

    res.json({ ok: true, resetUrl }); // return the link (handy while building)
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Request failed' });
  }
});

/** /auth/reset (apply new password) */
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: true, message: 'Token & password required' });
    }

    const pr = await prisma.passwordReset.findUnique({ where: { token: String(token) } });
    if (!pr) return res.status(400).json({ error: true, message: 'Invalid or expired token' });
    if (pr.usedAt) return res.status(400).json({ error: true, message: 'Token already used' });
    if (pr.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: true, message: 'Token expired' });

    const hash = await bcrypt.hash(String(password), 10);

    // update password + mark token used (transaction)
    await prisma.$transaction([
      prisma.user.update({ where: { id: pr.userId }, data: { password: hash } }),
      prisma.passwordReset.update({ where: { token: pr.token }, data: { usedAt: new Date() } })
    ]);

    res.json({ ok: true, message: 'Password updated' });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Reset failed' });
  }
});

export default router;
