// backend/src/routes/email.ts
import { Router, type Request, type Response } from 'express';
import { requireAdmin } from '../lib/authz.js';
import { sendOrderEmail } from '../services/mailer.js';

const router = Router();

/**
 * POST /admin/orders/:id/resend
 * Resend order email (tickets)
 */
router.post('/orders/:id/resend', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const result = await sendOrderEmail(orderId);
    res.json({ ok: true, provider: result.provider });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message ?? 'Resend failed' });
  }
});

export default router;
