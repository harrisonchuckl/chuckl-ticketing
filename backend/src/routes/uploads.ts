import { Router } from 'express';
import Busboy from 'busboy';
import crypto from 'crypto';
import sharp from 'sharp';
import { PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * ENV you need:
 * - R2_ACCOUNT_ID           (optional if you supply R2_ENDPOINT directly)
 * - R2_BUCKET               (required)
 * - R2_ACCESS_KEY_ID        (required)
 * - R2_SECRET_ACCESS_KEY    (required)
 * - R2_ENDPOINT             (recommended, e.g. https://<accountid>.r2.cloudflarestorage.com)
 * - R2_PUBLIC_BASE          (recommended for public URL, e.g. https://cdn.yourdomain.com OR https://pub-<subdomain>.r2.dev/<bucket>)
 *
 * If R2_PUBLIC_BASE isn’t set, we fall back to a generic R2-style URL.
 */
const {
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_ACCOUNT_ID,
  R2_PUBLIC_BASE,
} = process.env;

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !(R2_ENDPOINT || R2_ACCOUNT_ID)) {
  // Don’t throw at import time in production containers; instead log once.
  // eslint-disable-next-line no-console
  console.warn('[uploads] Missing R2 configuration. Set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT or R2_ACCOUNT_ID.');
}

const endpoint =
  R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

const s3 = new S3Client({
  region: 'auto', // Cloudflare R2 accepts "auto"
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? '',
  },
});

// Build public URL for the stored key
function publicUrlForKey(key: string): string {
  if (R2_PUBLIC_BASE) {
    // If you set R2_PUBLIC_BASE to a bucket-scoped origin (e.g. https://cdn.example.com or https://pub-xxx.r2.dev/bucket)
    // just join it with the key.
    return `${R2_PUBLIC_BASE.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
  }
  // Fallback: generic R2 S3 URL (not great for public, but works)
  // https://<accountid>.r2.cloudflarestorage.com/<bucket>/<key>
  const base = endpoint ?? 'https://r2.cloudflarestorage.com';
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(R2_BUCKET ?? '')}/${key}`;
}

router.post('/', requireAdminOrOrganiser, async (req, res) => {
  try {
    // Basic guard
    if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !endpoint) {
      return res.status(500).json({ ok: false, error: 'Uploads not configured on server' });
    }

    if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
      return res.status(400).json({ ok: false, error: 'Content-Type must be multipart/form-data' });
    }

    // We’ll wrap Busboy usage in a promise to await completion
    const out = await new Promise<{ key: string; url: string }>((resolve, reject) => {
      const bb = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: 20 * 1024 * 1024, // 20 MB
        },
      });

      let settled = false;
      let handledAFile = false;

      function fail(err: Error | string, httpCode = 400) {
        if (settled) return;
        settled = true;
        reject(Object.assign(new Error(typeof err === 'string' ? err : err.message), { httpCode }));
      }

      bb.on('file', (_fieldname, fileStream, info) => {
        handledAFile = true;

        const { filename, mimeType } = info;
        // We always output webp
        const key = `posters/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;

        // Transform stream: -> sharp(webp)
        const toWebp = sharp().webp({ quality: 82 });
        const bodyStream = new PassThrough();
        // Node streams only:
        fileStream.pipe(toWebp).pipe(bodyStream);

        // Managed multipart upload
        const uploader = new Upload({
          client: s3,
          params: new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: bodyStream,
            ContentType: 'image/webp',
            // R2 ignores ACL for private buckets; leave public access to your CDN/public binding
          }) as any, // lib-storage accepts either plain params or command; cast for TS peace
          queueSize: 3,
          partSize: 5 * 1024 * 1024, // 5MB parts
          leavePartsOnError: false,
        });

        uploader.done().then(
          () => {
            if (settled) return;
            settled = true;
            resolve({ key, url: publicUrlForKey(key) });
          },
          (err) => fail(err instanceof Error ? err : new Error(String(err)), 500)
        );
      });

      bb.on('error', (err) => fail(err instanceof Error ? err : new Error(String(err)), 400));
      bb.on('partsLimit', () => fail('Too many parts', 413));
      bb.on('filesLimit', () => fail('Too many files', 413));
      bb.on('fieldsLimit', () => fail('Too many fields', 413));

      bb.on('close', () => {
        if (!handledAFile && !settled) {
          fail('No file received', 400);
        }
      });

      // IMPORTANT: classic Node piping – do NOT use Web Streams here.
      // This avoids the TS error ("BusboyInstance is not assignable to WritableStream").
      req.pipe(bb);
    });

    return res.json({ ok: true, ...out });
  } catch (e: any) {
    const httpCode = e?.httpCode && Number.isInteger(e.httpCode) ? Number(e.httpCode) : 500;
    return res.status(httpCode).json({ ok: false, error: e?.message || 'Upload failed' });
  }
});

export default router;
