// backend/src/routes/bootstrap.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * ONE-TIME bootstrap route to create (or update) the first organiser user.
 * Protects with ?key=... that must match process.env.BOOTSTRAP_KEY.
 *
 * Usage (once you've set BOOTSTRAP_KEY):
 *   GET /auth/bootstrap?key=YOUR_KEY&email=harrison@chuckl.co.uk&name=Harrison%20Paul%20Salter&password=YourStrongPass123
 *
 * ⚠️ Delete this file and its server import after you’ve created your first account.
 */
router.get('/bootstrap', async (req, res) => {
  try {
    const key = String(req.query.key ?? '');
    const required = process.env.BOOTSTRAP_KEY ?? '';
    if (!required || key !== required) {
      return res.status(401).json({ ok: false, error: 'Invalid bootstrap key' });
    }

    const email = String(req.query.email ?? '').trim().toLowerCase();
    const name = String(req.query.name ?? '').trim() || null;
    const password = String(req.query.password ?? '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password are required' });
    }

    // bcrypt hash (works with typical auth handlers that use bcrypt.compare)
    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hash,
        // If you want a default organiser fee split, set it here (bps = basis points)
        // organiserSplitBps: 5000, // 50%
      },
      create: {
        email,
        name,
        password: hash,
        // organiserSplitBps: 5000, // optional default
      },
      select: { id: true, email: true, name: true, organiserSplitBps: true, createdAt: true },
    });

    return res.json({ ok: true, user });
  } catch (err) {
    console.error('bootstrap error', err);
    return res.status(500).json({ ok: false, error: 'bootstrap failed' });
  }
});

export default router;
