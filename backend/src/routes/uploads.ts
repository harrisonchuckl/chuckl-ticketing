// backend/src/routes/uploads.ts
import { Router } from 'express';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const router = Router();

function assertAdmin(req: any) {
  const key = req.headers['x-admin-key'];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
}

// Configure S3 client from env
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: String(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY)
  } : undefined
});

const BUCKET = String(process.env.S3_BUCKET || '');

router.post('/uploads/presign', async (req, res) => {
  try {
    assertAdmin(req);
    if (!BUCKET) return res.status(500).json({ error: true, message: 'S3_BUCKET not set' });

    const ext = (req.query.ext as string) || 'jpg';
    const key = `posters/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 0, 5 * 1024 * 1024], // 5MB
      ],
      Expires: 60, // seconds
    });

    // If your bucket is public, final URL is usually: https://{bucket}.s3.{region}.amazonaws.com/{key}
    const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${key}`;

    res.json({ ok: true, url, fields, key, publicUrl });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: true, message: e.message });
  }
});

export default router;
