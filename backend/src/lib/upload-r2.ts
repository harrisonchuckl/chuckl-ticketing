// backend/src/lib/upload-r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID       = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY= process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET           = process.env.R2_BUCKET || '';
const R2_PUBLIC_BASE      = process.env.R2_PUBLIC_BASE || ''; // e.g. https://<accountid>.r2.cloudflarestorage.com/<bucket> or https://media.yourdomain.com
const R2_S3_ENDPOINT      = process.env.R2_S3_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

if (!R2_BUCKET) {
  console.warn('[upload-r2] R2_BUCKET is not set – uploads will fail.');
}
if (!R2_PUBLIC_BASE) {
  console.warn('[upload-r2] R2_PUBLIC_BASE is not set – returned URLs will be empty.');
}
if (!R2_S3_ENDPOINT) {
  console.warn('[upload-r2] R2_S3_ENDPOINT is not set – defaulting may fail without R2_ACCOUNT_ID.');
}

const s3 = new S3Client({
  region: 'auto',                   // Cloudflare R2 uses 'auto'
  endpoint: R2_S3_ENDPOINT,         // e.g. https://<accountid>.r2.cloudflarestorage.com
  forcePathStyle: true,             // required by R2
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

type PutOpts = {
  contentType?: string;
  cacheControl?: string;
};

export async function uploadToR2(key: string, body: Buffer | Uint8Array, opts: PutOpts = {}) {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: opts.contentType || 'application/octet-stream',
    CacheControl: opts.cacheControl || undefined,
    ACL: undefined, // R2 ignores ACL; public access is configured at bucket/domain level
  });

  try {
    await s3.send(cmd);
    return {
      ok: true as const,
      key,
      publicBase: R2_PUBLIC_BASE.replace(/\/+$/, ''), // trim trailing slash
    };
  } catch (err) {
    console.error('[upload-r2] put failed', err);
    return { ok: false as const, error: 'put_failed' };
  }
}
