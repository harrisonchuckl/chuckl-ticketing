import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT;          // e.g. https://<accountid>.r2.cloudflarestorage.com
const R2_BUCKET   = process.env.R2_BUCKET;            // e.g. chuckl-ticketing
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;    // e.g. https://pub-cdn.example.com or https://<custom-domain>
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ENDPOINT || !R2_BUCKET || !R2_PUBLIC_BASE || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn("R2 env not fully set – uploads will fail until you configure: R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_BASE, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
}

const s3 = new S3Client({
  region: "auto", // Cloudflare R2 ignores region, but a value must be set
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: String(R2_ACCESS_KEY_ID || ""),
    secretAccessKey: String(R2_SECRET_ACCESS_KEY || "")
  }
});

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  opts?: { contentType?: string; cacheControl?: string }
): Promise<{ ok: true; publicBase: string } | { ok: false; error: string }> {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: String(R2_BUCKET),
      Key: key,
      Body: body,
      ContentType: opts?.contentType || "application/octet-stream",
      CacheControl: opts?.cacheControl || "public, max-age=31536000, immutable",
      ACL: undefined // R2 uses bucket policy; leave undefined
    }));
    return { ok: true, publicBase: String(R2_PUBLIC_BASE) };
  } catch (e:any) {
    console.error("uploadToR2 failed", e?.message || e);
    return { ok: false, error: "put failed" };
  }
}