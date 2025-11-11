// backend/src/routes/uploads.ts
import { Router } from 'express';
import Busboy from 'busboy';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Auth guard (re-use organiser/admin requirement if you like)
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// ---- Cloudflare R2 config via env ----
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET || 'posters';
const R2_PUBLIC_BASE =
  process.env.R2_PUBLIC_BASE || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  // Do not crash the process; we’ll return 500 on first request with message.
  // You can tighten this to throw in startup if you prefer.
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || ''
  }
});

router.post('/', requireAdminOrOrganiser, (req, res) => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return res.status(500).json({ ok: false, error: 'R2 not configured' });
  }

  const bb = Busboy({ headers: req.headers });
  let done = false;

  bb.on('file', async (_fieldname, file, info) => {
    const { filename, mimeType } = info;
    try {
      // Collect into memory (posters are typically a few MB)
      const chunks: Buffer[] = [];
      file.on('data', (c: Buffer) => chunks.push(c));
      file.on('limit', () => {
        done = true;
        return res.status(413).json({ ok: false, error: 'File too large' });
      });
      file.on('end', async () => {
        if (done) return;
        const input = Buffer.concat(chunks);

        // Convert to optimised WebP (keeps size low for frontend)
        const webp = await sharp(input).rotate().webp({ quality: 82 }).toBuffer();

        const ext = 'webp';
        const key = `posters/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;

        // Stream the buffer up using lib-storage (handles multipart uploads for big files)
        const uploader = new Upload({
          client: s3,
          params: {
            Bucket: R2_BUCKET,
            Key: key,
            Body: webp,
            ContentType: 'image/webp',
            ACL: undefined // R2 ignores; use public bucket or signed URLs if private
          }
        });

        await uploader.done();
        const url = `${R2_PUBLIC_BASE}/${key}`;
        done = true;
        return res.json({ ok: true, key, url, filename, mimeType });
      });
    } catch (e: any) {
      done = true;
      return res.status(500).json({ ok: false, error: e?.message || 'Upload failed' });
    }
  });

  bb.on('error', (err) => {
    if (!done) {
      done = true;
      res.status(500).json({ ok: false, error: err?.message || 'Busboy error' });
    }
  });

  bb.on('finish', () => {
    if (!done) {
      // No file field provided
      done = true;
      res.status(400).json({ ok: false, error: 'No file received' });
    }
  });

  req.pipe(bb);
});

export default router;
