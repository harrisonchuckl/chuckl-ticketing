// backend/src/routes/uploads.ts
import { Router } from 'express';
import Busboy from 'busboy';
import crypto from 'crypto';
import sharp from 'sharp';
import { PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
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

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !(R2_ENDPOINT || R2_ACCOUNT_ID)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[uploads] Missing R2 configuration. Set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT or R2_ACCOUNT_ID.'
  );
}

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

    const result = await new Promise<{ key: string; url: string }>((resolve, reject) => {
      const bb = Busboy({
        headers: req.headers as any,
        limits: { files: 1, fileSize: 20 * 1024 * 1024 },
      });

      let settled = false;
      let sawFile = false;

      const fail = (err: unknown, httpCode = 400) => {
        if (settled) return;
        settled = true;
        const msg = err instanceof Error ? err.message : String(err);
        const e = new Error(msg) as Error & { httpCode?: number };
        e.httpCode = httpCode;
        reject(e);
      };

      bb.on('file', (_fieldname, fileStream, info) => {
        sawFile = true;

        const key = `posters/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;

        const toWebp = sharp().webp({ quality: 82 });
        const bodyStream = new PassThrough();

        // Node streams only (no web streams)
        fileStream.pipe(toWebp).pipe(bodyStream);

        const uploader = new Upload({
          client: s3,
          params: new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: bodyStream,
            ContentType: 'image/webp',
          }) as any,
          queueSize: 3,
          partSize: 5 * 1024 * 1024,
          leavePartsOnError: false,
        });

        uploader.done().then(
          () => {
            if (settled) return;
            settled = true;
            resolve({ key, url: publicUrlForKey(key) });
          },
          (err) => fail(err, 500)
        );
      });

      bb.on('error', (err) => fail(err, 400));

      // These events exist at runtime but aren’t in older @types — cast to any to wire them.
      (bb as any).on('partsLimit', () => fail('Too many parts', 413));
      (bb as any).on('filesLimit', () => fail('Too many files', 413));
      (bb as any).on('fieldsLimit', () => fail('Too many fields', 413));

      // Use 'finish' (declared in types) instead of 'close'
      bb.once('finish', () => {
        if (!sawFile && !settled) fail('No file received', 400);
      });

      // Avoid the TS clash with Web WritableStream by casting to any.
      (req as any).pipe(bb as any);
    });

    return res.json({ ok: true, ...result });
  } catch (e: any) {
    const code = Number.isInteger(e?.httpCode) ? e.httpCode : 500;
    return res.status(code).json({ ok: false, error: e?.message || 'Upload failed' });
  }
});

export default router;
