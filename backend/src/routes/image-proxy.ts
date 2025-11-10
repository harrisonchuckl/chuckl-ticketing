// backend/src/routes/image-proxy.ts
import { Router } from 'express';
import Sharp from 'sharp';
import { s3, putObjectStream } from '../lib/storage.js';

const router = Router();

/**
 * GET /img/fetch?src=<encoded public URL>&w=600
 * Only allows fetching from your R2 public base.
 * Caches the resized result back to R2 under /cache/.
 */
router.get('/img/fetch', async (req, res) => {
  try {
    const src = String(req.query.src || '');
    const w = req.query.w ? Math.max(50, Math.min(2400, Number(req.query.w))) : 800;

    const base = (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/,'');
    if (!src.startsWith(base + '/')) {
      return res.status(400).send('Invalid source');
    }

    // derive a cache key
    const after = src.slice(base.length + 1); // path after base
    const cacheKey = `cache/w${w}/${after.replace(/\.+\//g,'')}.webp`;

    // Try to serve cached (R2) by redirect (cheapest)
    const cachedUrl = `${base}/${cacheKey}`;
    // We'll optimistically check with a HEAD via fetch:
    try {
      const head = await fetch(cachedUrl, { method: 'HEAD' });
      if (head.ok) {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
        return res.redirect(302, cachedUrl);
      }
    } catch {}

    // Otherwise fetch original and resize
    const orig = await fetch(src);
    if (!orig.ok || !orig.body) return res.status(404).send('Not found');

    const transformer = Sharp()
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 82 });

    // Upload the transformed stream to R2 (and tee to client)
    // We can't easily tee sharp output twice, so first buffer small images; otherwise stream and also upload.
    // Simpler path: stream into R2, then redirect client to cachedUrl.

    const uploadPromise = putObjectStream({
      key: cacheKey,
      body: orig.body.pipe(transformer),
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await uploadPromise;

    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
    return res.redirect(302, cachedUrl);
  } catch (e) {
    console.error('img/fetch error', e);
    res.status(500).send('Image proxy error');
  }
});

export default router;
