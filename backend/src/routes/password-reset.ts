// backend/src/routes/password-reset.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/db.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { signUserJwt } from '../lib/jwt.js';

const router = Router();

/** Request a reset link (always 200 to avoid user enumeration) */
router.post('/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: true, message: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpiresAt: expires }
    });

    const base = process.env.FRONTEND_URL || process.env.PUBLIC_URL || '';
    const origin = base || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
    const ui = origin ? `${origin}/admin/ui` : '/admin/ui';
    const resetUrl = `${ui}#reset=${token}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Request failed' });
  }
});

/** Complete a reset using the token + new password */
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: true, message: 'Missing token or password' });

    const user = await prisma.user.findFirst({
      where: {
        resetToken: String(token),
        resetExpiresAt: { gt: new Date() }
      }
    });

    if (!user) return res.status(400).json({ error: true, message: 'Invalid or expired token' });

    const hash = await bcrypt.hash(String(password), 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, resetToken: null, resetExpiresAt: null }
    });

    // Auto sign-in post reset
    const jwt = await signUserJwt({ id: user.id, email: user.email, name: user.name });
    res
      .cookie('auth', jwt, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      .json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e?.message ?? 'Reset failed' });
  }
});

export default router;
