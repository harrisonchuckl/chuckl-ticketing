// backend/src/routes/admin-uploads.ts
import { Router } from 'express';
import { randomUUID } from 'crypto';
import Busboy from 'busboy';
import Sharp from 'sharp';
import { putObjectStream } from '../lib/storage.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

router.post('/uploads', requireAdminOrOrganiser, async (req, res) => {
  try {
    const bb = Busboy({ headers: req.headers });

    let responded = false;

    bb.on('file', async (_field, file, info) => {
      const mime = info.mimeType || 'application/octet-stream';
      if (!mime.startsWith('image/')) {
        responded = true;
        file.resume();
        return res.status(400).json({ ok: false, error: 'Only image uploads allowed' });
      }

      const now = new Date();
      const key = `posters/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${randomUUID()}.webp`;

      try {
        // Transform with Sharp (auto-rotate, max width 2000, webp compress)
        const transformer = Sharp()
          .rotate()
          .resize({ width: 2000, withoutEnlargement: true })
          .webp({ quality: 82 });

        file.pipe(transformer);

        const { url } = await putObjectStream({
          key,
          body: transformer,
          contentType: 'image/webp',
        });

        responded = true;
        return res.json({ ok: true, key, url, contentType: 'image/webp' });
      } catch (e) {
        console.error('upload-sharp failed', e);
        responded = true;
        return res.status(500).json({ ok: false, error: 'Upload failed' });
      }
    });

    bb.on('finish', () => {
      if (!responded) res.status(400).json({ ok: false, error: 'No file sent' });
    });

    bb.on('error', (e) => {
      console.error('busboy error', e);
      if (!responded) res.status(500).json({ ok: false, error: 'Upload error' });
    });

    req.pipe(bb);
  } catch (e) {
    console.error('POST /admin/uploads fatal', e);
    res.status(500).json({ ok: false, error: 'Upload failed' });
  }
});

export default router;
