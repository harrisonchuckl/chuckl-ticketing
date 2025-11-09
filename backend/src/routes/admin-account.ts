// backend/src/routes/admin-account.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/account
 * Returns the current user's organiser settings
 */
router.get('/account', requireAdminOrOrganiser, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Unauthorised' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, organiserSplitBps: true },
    });
    res.json({ ok: true, user });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to load account' });
  }
});

/**
 * PATCH /admin/account
 * { organiserSplitBps: number }
 */
router.patch('/account', requireAdminOrOrganiser, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Unauthorised' });

    const { organiserSplitBps } = req.body || {};
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        organiserSplitBps: organiserSplitBps == null ? null : Number(organiserSplitBps),
      },
      select: { id: true, email: true, organiserSplitBps: true },
    });
    res.json({ ok: true, user: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Failed to save account' });
  }
});

export default router;
