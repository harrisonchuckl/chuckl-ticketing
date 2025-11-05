// backend/src/routes/admin-uploads.ts
import { Router, Request, Response } from 'express';

const router = Router();

function isAdmin(req: Request): boolean {
  const headerKey = (req.headers['x-admin-key'] ?? '') as string;
  const queryKey = (req.query.k ?? '') as string;
  const key = headerKey || queryKey;
  return !!key && String(key) === String(process.env.BOOTSTRAP_KEY);
}
function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * For now we just accept a filename and return a fake "upload URL".
 * Later we’ll switch this to S3 presigned POST.
 */
router.post('/uploads/presign', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ error: true, message: 'filename required' });

  // Pretend we have a CDN; store URL in your DB later if needed
  const fakeUrl = `https://files.example.invalid/uploads/${encodeURIComponent(filename)}`;
  res.json({
    ok: true,
    provider: 'noop',
    uploadUrl: fakeUrl,
    publicUrl: fakeUrl
  });
});

export default router;
