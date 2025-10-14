// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Routers (ensure these compile to .js in dist)
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';

const app = express();

// --- Security headers
app.use(helmet());

// --- CORS (comma-separated list in CORS_ORIGINS; allow all if unset)
const corsOrigins =
  process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.trim().length
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : true;
app.use(cors({ origin: corsOrigins }));

/**
 * --- Stripe webhook must receive the raw body ---
 * Your routes/webhook.ts should verify the Stripe signature from req.body (Buffer)
 * Do NOT add express.json() before this path.
 */
app.use('/webhooks', express.raw({ type: 'application/json' }), webhook);

// --- JSON parser for the rest of the app
app.use(express.json({ limit: '1mb' }));

// --- Basic rate limiting
app.use(
  rateLimit({
    windowMs: 60_000,   // 1 minute
    max: 120,           // 120 req/min per IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Healthcheck (set this in Railway Settings → Healthcheck Path)
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Simple success/cancel pages for Stripe redirect
app.get('/success', (req, res) => {
  const orderId = (req.query.orderId ?? '').toString();
  res.type('html').send(`
    <!doctype html><html><head>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Chuckl – Order Success</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:2rem;line-height:1.5;background:#fff}
        .card{max-width:720px;margin:0 auto;border:1px solid #eee;border-radius:12px;padding:2rem;box-shadow:0 2px 10px rgba(0,0,0,.05)}
        h1{margin-top:0}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
        a.button{display:inline-block;margin-top:1rem;padding:.6rem 1rem;border-radius:8px;border:1px solid #ddd;text-decoration:none}
      </style>
    </head><body>
      <div class="card">
        <h1>✅ Payment successful</h1>
        <p>Thanks for your purchase. Your order is being processed.</p>
        <p>Order ID: <span class="mono">${orderId}</span></p>
        <p>You can close this window.</p>
        <a class="button" href="/">Back to Chuckl</a>
      </div>
    </body></html>
  `);
});

app.get('/cancel', (_req, res) => {
  res.type('html').send(`
    <!doctype html><html><head>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Chuckl – Payment Canceled</title>
    </head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:2rem">
      <h1>Payment canceled</h1>
      <p>No charge was made. You can safely close this page and try again later.</p>
      <p><a href="/">Back to Chuckl</a></p>
    </body></html>
  `);
});

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
