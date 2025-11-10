// backend/src/routes/image-proxy.ts
import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { fetch as undiciFetch } from 'undici';

const router = Router();

/**
 * GET /img/fetch?src=<url>&w=600
 * - pulls an image from a public URL (e.g. R2 public URL)
 * - resizes to width (maintains aspect ratio)
 * - returns webp with long cache
 */
router.get('/img/fetch', async (req: Request, res: Response) => {
  try {
    const src = String(req.query.src || '');
    const w = Number(req.query.w || 0) || 600;

    if (!src || !/^https?:\/\//i.test(src)) {
      return res.status(400).send('Invalid src');
    }

    const upstream = await undiciFetch(src, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(404).send('Not found');
    }

    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Resize → webp (lossy, good balance)
    const out = await sharp(buf)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    return res.send(out);
  } catch (err) {
    console.error('image-proxy failed', err);
    res.status(500).send('Proxy error');
  }
});

export default router;
