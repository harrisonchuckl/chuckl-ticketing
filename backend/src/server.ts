// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Routers (ensure these files compile to .js in dist and paths end with .js)
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';

const app = express();

// --- Security headers
app.use(helmet());

// --- CORS (CORS_ORIGINS can be comma-separated list; otherwise allow all)
const corsOrigins =
  process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.trim().length
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : true; // allow all if not set (tighten later)
app.use(cors({ origin: corsOrigins }));

/**
 * --- Stripe webhook must receive the raw body ---
 * If your webhook route expects raw (typical for Stripe signature verification),
 * mount it BEFORE json() and WITH express.raw on that path.
 * Your routes/webhook.ts should export { router } that reads req.body as Buffer.
 */
app.use('/webhooks', express.raw({ type: 'application/json' }), webhook);

// --- JSON body parser for the rest of the app (keep AFTER the webhook mount)
app.use(express.json({ limit: '1mb' }));

// --- Basic rate limiting
app.use(
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 120,         // 120 requests/min per IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Healthcheck (also set this path as your Railway healthcheck)
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Feature routers
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/me', me);
app.use('/admin', admin);

// --- Last-resort error handler (helps debug 500s)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err?.stack || err);
  res.status(500).json({ error: 'internal_error' });
});

// --- Start server
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
