// backend/src/lib/storage.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.warn('[storage] Missing R2 env vars — uploads/proxy will fail until set.');
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

export function publicUrlForKey(key: string) {
  if (!R2_PUBLIC_BASE) return key; // fallback
  return `${R2_PUBLIC_BASE.replace(/\/+$/,'')}/${key.replace(/^\/+/, '')}`;
}

export async function putObjectStream(opts: {
  key: string;
  body: any;
  contentType?: string;
  cacheControl?: string;
}) {
  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET!,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl ?? 'public, max-age=31536000, immutable',
    },
  });
  await uploader.done();
  return { key: opts.key, url: publicUrlForKey(opts.key) };
}

export async function getObjectStream(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
  // @ts-ignore - R2/S3 stream type
  return res.Body as NodeJS.ReadableStream;
}
