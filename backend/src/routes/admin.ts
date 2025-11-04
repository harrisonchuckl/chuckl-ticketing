// backend/src/routes/admin.ts
import { Router } from 'express';
import { prisma } from '../db.js';

export const router = Router();

/**
 * Accept admin key from header or query string (for easier debugging in a browser).
 * - Header:   x-admin-key: <key>
 * - Query:    ?k=<key>
 */
function extractKey(req: any): string | null {
  const h = req.headers?.['x-admin-key'];
  const q = req.query?.k;
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

function requireAdmin(req: any): boolean {
  const key = extractKey(req);
  return !!key && String(key) === String(process.env.BOOTSTRAP_KEY);
}

function unauthorized(res: any) {
  return res.status(401).json({ error: true, message: 'Unauthorized' });
}

// ------------------------------------------------------------------
// Simple ping (no auth required so you can test routing quickly)
router.get('/bootstrap/ping', (_req, res) =>
  res.json({ ok: true, router: 'admin', path: '/admin/bootstrap/ping' })
);

// Debug helper: echoes what the server sees (auth required)
router.get('/debug/echo', (req, res) => {
  if (!requireAdmin(req)) return unauthorized(res);
  res.json({
    ok: true,
    keyMatches: true,
    received: {
      headerKey: (req.headers['x-admin-key'] as string) || null,
      queryKey: (req.query.k as string) || null,
      ua: req.headers['user-agent'] || null,
    },
  });
});

// ------------------------------------------------------------------
// Latest shows (auth required)
router.get('/shows/latest', async (req, res) => {
  if (!requireAdmin(req)) return unauthorized(res);

  // limit guard
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.max(1, Math.min(100, Number(limitRaw || 20)));

  try {
    const shows = await prisma.show.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        date: true,
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            postcode: true,
            capacity: true,
          },
        },
        ticketTypes: {
          select: {
            id: true,
            name: true,
            pricePence: true,
            available: true,
          },
        },
        _count: {
          select: { tickets: true, orders: true },
        },
      },
    });

    res.json({ ok: true, shows });
  } catch (err: any) {
    // Always JSON on error
    res.status(500).json({
      error: true,
      message: 'Failed to load shows',
      detail: err?.message || String(err),
    });
  }
});

export default router;
