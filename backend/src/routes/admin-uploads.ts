import { Router, type Request, type Response } from 'express';
import Busboy from 'busboy';
import sharp from 'sharp';
import { uploadToR2 } from '../lib/upload-r2.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * POST /admin/uploads/poster
 * also works as /api/upload/poster (server mounts alias)
 *
 * Multipart form-data:
 *   - file: image file (jpg/png/webp)
 *   - showId: string (optional; used in the key path)
 *
 * Returns: { ok: true, url: "https://..." }
 */
router.post('/poster', requireAdminOrOrganiser, async (req: Request, res: Response) => {
  try {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 15 * 1024 * 1024, files: 1 }
    });

    let rawBuffer: Buffer | null = null;
    let filename = 'poster';
    let showId: string | null = null;

    const done = new Promise<void>((resolve, reject) => {
      bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        filename = info?.filename || filename;
        const chunks: Buffer[] = [];
        file.on('data', (d: Buffer) => chunks.push(d));
        file.on('limit', () => reject(new Error('File too large')));
        file.on('end', () => { rawBuffer = Buffer.concat(chunks); });
      });
      bb.on('field', (field: string, val: string) => {
        if (field === 'showId') showId = val;
      });
      bb.on('error', (e: unknown) => reject(e as Error));
      bb.on('finish', () => resolve());
    });

    // @ts-ignore Busboy is stream-writable at runtime
    req.pipe(bb);
    await done;

    if (!rawBuffer) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    // Normalise & compress
    const processed = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const ts = Date.now();
    const ext = 'webp';
    const safe = (filename || 'poster').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
    const base = safe.replace(/\.[a-z0-9]+$/i, '') || 'poster';

    const key = showId
      ? `posters/${showId}/${base}-${ts}.${ext}`
      : `posters/${base}-${ts}.${ext}`;

    const put = await uploadToR2(key, processed, {
      contentType: `image/${ext}`,
      cacheControl: 'public, max-age=31536000, immutable'
    });

    if (!put.ok) {
      return res.status(500).json({ ok: false, error: 'Upload failed' });
    }
    const url = `${put.publicBase}/${key}`;
    return res.json({ ok: true, url });
  } catch (err) {
    console.error('poster upload failed', err);
    return res.status(500).json({ ok: false, error: 'Upload error' });
  }
});

export default router;