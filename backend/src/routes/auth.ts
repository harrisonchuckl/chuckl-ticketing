import { Router } from 'express';
import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';

export const router = Router();

/**
 * POST /auth/signup
 * body: { email, password, name? }
 * creates a user with a hashed password
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email_and_password_required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'email_taken' });

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name: name || null,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // You can return a JWT later; for now, return user
    res.json({ user });
  } catch (e: any) {
    res.status(500).json({ error: 'signup_failed', detail: String(e?.message || e) });
  }
});

/**
 * POST /auth/login
 * body: { email, password }
 * verifies credentials and returns a minimal session payload
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email_and_password_required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    // TODO: issue JWT. For now return user basics.
    res.json({
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'login_failed', detail: String(e?.message || e) });
  }
});

export default router;
