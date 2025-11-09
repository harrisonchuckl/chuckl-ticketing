// backend/src/routes/admin-coupons.ts
// Minimal placeholder coupon routes so the server compiles.
// We’ll wire real Coupon CRUD once the schema is finalised.

import { Router } from 'express';
import { requireAdmin } from '../lib/authz.js';

const router = Router();

/**
 * GET /admin/coupons
 * Placeholder list endpoint
 */
router.get('/coupons', requireAdmin, async (_req, res) => {
  res.json({ ok: true, items: [] });
});

/**
 * POST /admin/coupons
 * Placeholder create endpoint
 */
router.post('/coupons', requireAdmin, async (_req, res) => {
  res.status(501).json({ ok: false, message: 'Coupons: not implemented yet' });
});

/**
 * PATCH /admin/coupons/:id
 * Placeholder update endpoint
 */
router.patch('/coupons/:id', requireAdmin, async (_req, res) => {
  res.status(501).json({ ok: false, message: 'Coupons: not implemented yet' });
});

/**
 * DELETE /admin/coupons/:id
 * Placeholder delete endpoint
 */
router.delete('/coupons/:id', requireAdmin, async (_req, res) => {
  res.status(501).json({ ok: false, message: 'Coupons: not implemented yet' });
});

export default router;
