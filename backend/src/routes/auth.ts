// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';
import { attachSession, createSessionCookie, clearSessionCookie, requireAuth } from '../lib/auth.js';

const router = Router();

// always attach session on auth routes
router.use(attachSession);

// POST /auth/register  (TEMP: for initial bootstrapping; keep behind an env flag if needed)
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });
    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        name: name ? String(name) : null,
        role: role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ORGANISER',
        password: hash,
      },
    });
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// POST /auth/login
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: true, message: 'Email & password required' });
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: true, message: 'Invalid credentials' });

    await createSessionCookie(res, { uid: user.id, email: user.email, role: user.role as any });
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    return res.status(500).json({ error: true, message: e?.message || 'Failed' });
  }
});

// POST /auth/logout
router.post('/auth/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

// GET /auth/me
router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  return res.json({ ok: true, user: req.session });
});

export default router;
