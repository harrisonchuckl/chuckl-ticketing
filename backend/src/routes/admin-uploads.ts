// backend/src/routes/admin-uploads.ts
import { Router } from 'express';

const router = Router();
function assertAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
}

/**
 * GET /admin/uploads/presign
 * Returns 501 when uploads aren’t configured yet.
 * If you later add S3, replace this with a real presign implementation.
 */
router.get('/uploads/presign', (req, res) => {
  try {
    assertAdmin(req);
    res.status(501).json({ ok: false, message: 'Uploads not configured' });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
