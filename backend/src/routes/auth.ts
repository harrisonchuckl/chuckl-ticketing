// backend/src/routes/auth.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Cookie settings (httpOnly session cookie)
const COOKIE_NAME = 'sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setSessionCookie(res: any, userId: string) {
  // We’re keeping this simple: cookie just stores the userId.
  // (You can swap to JWT later if you like.)
  res.cookie(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE * 1000,
    path: '/',
  });
}

function clearSessionCookie(res: any) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/**
 * POST /auth/login
 * Body: { email, password }
 * Sets httpOnly cookie if OK.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing email or password' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    let ok = false;
    // Support both hashed and plaintext (during bootstrap)
    if (user.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password;
    }
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    setSessionCookie(res, user.id);
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, organiserSplitBps: user.organiserSplitBps, createdAt: user.createdAt } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

/**
 * GET /auth/me
 * Returns the current user if cookie present.
 */
router.get('/me', async (req: any, res) => {
  try {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) return res.json({ ok: true, user: null });

    const user = await prisma.user.findUnique({
      where: { id: String(sid) },
      select: { id: true, email: true, name: true, organiserSplitBps: true, createdAt: true },
    });
    return res.json({ ok: true, user: user || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Failed to fetch session' });
  }
});

/**
 * POST /auth/logout  (JSON variant; you also have GET /auth/logout in logout.ts)
 */
router.post('/logout', async (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

export default router;
