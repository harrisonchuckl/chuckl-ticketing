// backend/src/routes/uploads.ts
import { Router } from 'express';
import Busboy from 'busboy';
import crypto from 'crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

const {
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_ACCOUNT_ID,
  R2_PUBLIC_BASE,
} = process.env;

// Resolve endpoint (either full R2 endpoint or from account id)
const endpoint =
  R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? '',
  },
});

function publicUrlForKey(key: string): string {
  if (R2_PUBLIC_BASE) {
    return `${R2_PUBLIC_BASE.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
  }
  const base = endpoint ?? 'https://r2.cloudflarestorage.com';
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(R2_BUCKET ?? '')}/${key}`;
}

router.post('/', requireAdminOrOrganiser, async (req, res) => {
  try {
    if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !endpoint) {
      return res.status(500).json({ ok: false, error: 'Uploads not configured on server' });
    }

    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) {
      return res.status(400).json({ ok: false, error: 'Content-Type must be multipart/form-data' });
    }

    const MAX_BYTES = 20 * 1024 * 1024; // 20MB

    const { key, url } = await new Promise<{ key: string; url: string }>((resolve, reject) => {
      const bb = Busboy({
        headers: req.headers as any,
        limits: { files: 1, fileSize: MAX_BYTES },
      });

      let sawFile = false;
      let total = 0;
      const chunks: Buffer[] = [];

      const fail = (msg: string, http = 400) => {
        const err = new Error(msg) as Error & { httpCode?: number };
        err.httpCode = http;
        reject(err);
      };

      bb.on('file', (_name, file, info) => {
        sawFile = true;
        // info: { filename, encoding, mimeType }
        file.on('data', (d: Buffer) => {
          total += d.length;
          if (total > MAX_BYTES) {
            // Busboy should stop earlier, but double-guard.
            file.removeAllListeners();
            fail('File too large', 413);
            return;
          }
          chunks.push(d);
        });

        file.on('limit', () => fail('File too large', 413));
        file.on('error', (e) => fail(e instanceof Error ? e.message : String(e), 400));

        file.on('end', async () => {
          try {
            const buf = Buffer.concat(chunks);

            // Convert to WebP
            const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();

            const key = `posters/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;

            await s3.send(
              new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
                Body: webp,
                ContentType: 'image/webp',
              })
            );

            resolve({ key, url: publicUrlForKey(key) });
          } catch (e: any) {
            reject(e);
          }
        });
      });

      bb.on('filesLimit', () => fail('Too many files', 413));
      bb.on('fieldsLimit', () => fail('Too many fields', 413));
      bb.on('partsLimit', () => fail('Too many parts', 413));
      bb.on('error', (e) => fail(e instanceof Error ? e.message : String(e), 400));

      bb.on('finish', () => {
        if (!sawFile) fail('No file received', 400);
      });

      // Cast to any to avoid Node/Web stream typing mismatch in TS
      (req as any).pipe(bb as any);
    });

    return res.json({ ok: true, key, url });
  } catch (e: any) {
    // Temporary: log full details to help if anything else crops up
    console.error('[upload] error:', e?.stack || e);
    const code = Number.isInteger(e?.httpCode) ? e.httpCode : 500;
    return res.status(code).json({ ok: false, error: e?.message || 'Upload failed' });
  }
});

export default router;
