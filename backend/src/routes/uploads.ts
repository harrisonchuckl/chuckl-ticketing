// backend/src/routes/uploads.ts
import { Router } from 'express';
import Busboy from 'busboy';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Optional: protect this route like your other admin routes.
// If you want it protected, uncomment the next line and the middleware usage.
// import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// ---- R2 / S3 client (self-contained) ----
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';        // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || '';            // e.g. chuckl-media
const R2_PUBLIC_BASE =
  process.env.R2_PUBLIC_BASE || '';                       // e.g. https://cdn.example.com OR https://pub-<id>.r2.dev/<bucket>

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  // Don’t throw at module load to avoid crashing the process if you hit the route by mistake.
  console.warn('[upload] Missing one or more R2 env vars: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
}

const s3 = new S3Client({
  region: 'auto',              // R2 uses 'auto'
  endpoint: R2_ENDPOINT,       // custom endpoint
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---- Helpers ----
function randomKey(ext = 'webp') {
  const id = crypto.randomBytes(8).toString('hex');
  const ts = Date.now();
  return `uploads/posters/${ts}-${id}.${ext}`;
}

function publicUrlForKey(key: string) {
  if (R2_PUBLIC_BASE) {
    // If you provided a clean base (custom domain or r2.dev path), just join
    return `${R2_PUBLIC_BASE.replace(/\/+$/, '')}/${key}`;
  }
  // Fallback (not ideal): path-style URL under the API endpoint
  // This is usually not publicly accessible unless you’ve got a proxy in front.
  return `${R2_ENDPOINT.replace(/\/+$/, '')}/${R2_BUCKET}/${key}`;
}

// ---- Route ----
// router.post('/', requireAdminOrOrganiser, (req, res) => {
router.post('/', (req, res) => {
  // Basic guard
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return res.status(500).json({ ok: false, error: 'R2 is not configured on the server.' });
  }

  // Ensure multipart
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return res.status(400).json({ ok: false, error: 'Expected multipart/form-data' });
  }

  const bb = Busboy({ headers: req.headers });
  let responded = false;
  let handledFile = false;

  function fail(status: number, message: string) {
    if (!responded) {
      responded = true;
      res.status(status).json({ ok: false, error: message });
    }
  }

  bb.on('file', (fieldname, file, info) => {
    if (handledFile) {
      // ignore additional files
      file.resume();
      return;
    }
    handledFile = true;

    const { filename, mimeType } = info;

    if (!mimeType || !mimeType.startsWith('image/')) {
      file.resume();
      return fail(400, 'Please upload an image file.');
    }

    // Collect into a buffer (simpler; safe for posters)
    const chunks: Buffer[] = [];
    file.on('data', (d: Buffer) => chunks.push(d));
    file.on('limit', () => {
      // Only triggered if you set limits in Busboy config; not set here.
      // Keeping for completeness.
      return fail(413, 'File too large');
    });

    file.on('error', (err: unknown) => {
      console.error('[upload] file stream error:', err);
      return fail(500, 'Read error');
    });

    file.on('end', async () => {
      if (responded) return;
      try {
        const input = Buffer.concat(chunks);

        // Convert to WebP (rotate based on EXIF)
        const webp = await sharp(input).rotate().webp({ quality: 88 }).toBuffer();

        const key = randomKey('webp');
        const put = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: webp,                     // Node Buffer (✅ accepted by AWS SDK)
          ContentType: 'image/webp',
          // ACL: 'public-read'           // R2 is usually made public via bucket/CF config; omit ACL unless you enabled it
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await s3.send(put);

        const url = publicUrlForKey(key);
        responded = true;
        return res.json({ ok: true, key, url, filename });
      } catch (err: any) {
        console.error('[upload] processing/upload error:', err);
        return fail(500, err?.message || 'Upload failed');
      }
    });
  });

  bb.on('field', () => {
    // ignore extra fields for now
  });

  bb.on('error', (err: unknown) => {
    console.error('[upload] busboy error:', err);
    return fail(500, 'Upload error');
  });

  bb.on('finish', () => {
    if (!responded && !handledFile) {
      return fail(400, 'No file received');
    }
    // If we already responded in 'end', do nothing.
  });

  // ✅ Node stream piping (no web streams involved)
  req.pipe(bb);
});

export default router;
