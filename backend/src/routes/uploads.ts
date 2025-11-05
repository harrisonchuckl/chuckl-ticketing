// backend/src/routes/uploads.ts
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
 * Temporary stub: returns a fake upload URL instead of real S3 presign.
 * Allows backend to build and UI to continue working without AWS deps.
 */
router.post('/uploads/presign', (req, res) => {
  try {
    assertAdmin(req);
    const ext = (req.query.ext as string) || 'jpg';
    const fakeUrl = `https://example.com/fake-upload.${ext}`;
    res.json({
      ok: true,
      url: fakeUrl,
      fields: {},
      key: `uploads/fake-${Date.now()}.${ext}`,
      publicUrl: fakeUrl
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
