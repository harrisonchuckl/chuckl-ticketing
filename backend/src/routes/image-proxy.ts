// backend/src/routes/image-proxy.ts
import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';

const router = Router();

/**
 * GET /img/fetch?src=<url>&w=600
 * Fetch a public image (e.g. from R2), resize, emit webp.
 */
router.get('/img/fetch', async (req: Request, res: Response) => {
  try {
    const src = String(req.query.src || '');
    const w = Number(req.query.w || 0) || 600;

    if (!src || !/^https?:\/\//i.test(src)) {
      return res.status(400).send('Invalid src');
    }

    // Use built-in fetch; don't reference DOM types.
    const upstream = await fetch(src, { redirect: 'follow' as any });
    if (!upstream.ok) return res.status(404).send('Not found');

    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

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
