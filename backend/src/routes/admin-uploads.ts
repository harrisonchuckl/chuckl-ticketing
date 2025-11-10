// backend/src/routes/admin-uploads.ts
import { Router } from 'express';
import { randomUUID } from 'crypto';
import Busboy from 'busboy';
import { putObjectStream } from '../lib/storage.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

const PUBLIC_BASE = process.env.R2_PUBLIC_BASE || '';

function extFromFilename(name: string | undefined) {
  if (!name) return '';
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

router.post('/uploads', requireAdminOrOrganiser, async (req, res) => {
  try {
    const bb = Busboy({ headers: req.headers });

    let resolved = false;

    bb.on('file', async (_name, file, info) => {
      const mime = info.mimeType;
      const filename = info.filename;
      const ext = extFromFilename(filename) || (mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'bin');

      if (!mime.startsWith('image/')) {
        resolved = true;
        file.resume();
        return res.status(400).json({ ok: false, error: 'Only image uploads allowed' });
      }

      // posters/yyyy/mm/<uuid>.<ext>
      const now = new Date();
      const key = `posters/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${randomUUID()}.${ext}`;

      try {
        await putObjectStream({
          key,
          body: file,
          contentType: mime,
        });
        resolved = true;
        const url = PUBLIC_BASE
          ? `${PUBLIC_BASE.replace(/\/+$/,'')}/${key}`
          : key; // require PUBLIC_BASE for a full URL
        return res.json({ ok: true, key, url });
      } catch (e) {
        console.error('upload failed', e);
        resolved = true;
        return res.status(500).json({ ok: false, error: 'Upload failed' });
      }
    });

    bb.on('error', (e) => {
      if (!resolved) {
        console.error('busboy error', e);
        resolved = true;
        res.status(500).json({ ok: false, error: 'Upload error' });
      }
    });

    bb.on('finish', () => {
      if (!resolved) {
        // no file field
        res.status(400).json({ ok: false, error: 'No file sent' });
      }
    });

    req.pipe(bb);
  } catch (e) {
    console.error('POST /admin/uploads fatal', e);
    res.status(500).json({ ok: false, error: 'Upload failed' });
  }
});

export default router;
