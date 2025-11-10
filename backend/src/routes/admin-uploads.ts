// backend/src/routes/admin-uploads.ts
import { Router, type Request, type Response } from 'express';
import Busboy from 'busboy';
import sharp from 'sharp';
import { uploadToR2 } from '../lib/upload-r2.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**
 * POST /admin/uploads/poster
 * Multipart form-data:
 *   - file: image file (jpg/png/webp)
 *   - showId: string (optional; if passed we’ll use it in the key)
 *
 * Returns:
 *   { ok: true, url: "https://..." }
 */
router.post('/uploads/poster', requireAdminOrOrganiser, async (req: Request, res: Response) => {
  try {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        // ~15MB raw; we will downscale with sharp (server-side)
        fileSize: 15 * 1024 * 1024,
        files: 1
      }
    });

    let rawBuffer: Buffer | null = null;
    let filename = 'poster';
    let showId: string | null = null;
    let mimeType = 'image/jpeg';

    const done = new Promise<void>((resolve, reject) => {
      bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        filename = info?.filename || filename;
        mimeType = info?.mimeType || mimeType;

        const chunks: Buffer[] = [];
        file.on('data', (d: Buffer) => chunks.push(d));
        file.on('limit', () => reject(new Error('File too large')));
        file.on('end', () => {
          rawBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('field', (field: string, val: string) => {
        if (field === 'showId') showId = val;
      });

      bb.on('error', (e: unknown) => reject(e as Error));
      bb.on('finish', () => resolve());
    });

    req.pipe(bb);
    await done;

    if (!rawBuffer) {
      return res.status(400).json({ ok: false, error: 'No file received' });
    }

    // Normalise + compress: limit width to 1600px, convert to webp (small, modern)
    const processed = await sharp(rawBuffer)
      .rotate() // auto-orient
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const ext = 'webp';
    const ts = Date.now();
    const safeFile = filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
    const baseName = safeFile.replace(/\.[a-z0-9]+$/i, '') || 'poster';
    const key = showId
      ? `posters/${showId}/${baseName}-${ts}.${ext}`
      : `posters/${baseName}-${ts}.${ext}`;

    const put = await uploadToR2(key, processed, {
      contentType: `image/${ext}`,
      cacheControl: 'public, max-age=31536000, immutable'
    });

    if (!put.ok) {
      return res.status(500).json({ ok: false, error: 'Upload failed' });
    }

    // Public URL (from your R2_PUBLIC_BASE)
    const url = `${put.publicBase}/${key}`;

    return res.json({ ok: true, url });
  } catch (err) {
    console.error('poster upload failed', err);
    return res.status(500).json({ ok: false, error: 'Upload error' });
  }
});

export default router;
