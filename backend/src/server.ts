import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Routers
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';

const app = express();

// Trust Railway/Proxy so rate-limit & IPs work
app.set('trust proxy', 1);

// Security & basics
app.use(helmet());

// IMPORTANT: Stripe webhooks must receive the raw body.
// Our webhook router expects raw() on its own path, so mount that FIRST.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON body for the rest of the app
app.use(express.json({ limit: '1mb' }));

// CORS (tighten later)
const corsOrigins =
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

// Simple rate limiter
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Pretty success & cancel pages for Stripe redirects
app.get('/success', (req, res) => {
  const orderId = String(req.query.orderId || '');
  res
    .status(200)
    .type('html')
    .send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Thanks – Chuckl. Tickets</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:40px;background:#0b0b10;color:#f6f7fb}
    .card{max-width:680px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{margin:0 0 8px;font-weight:700;font-size:28px}
    p{margin:8px 0 0;color:#c6c8d1;line-height:1.55}
    code{background:#0f1320;padding:.2em .45em;border-radius:6px;border:1px solid #20253a}
    a.btn{display:inline-block;margin-top:16px;padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>Payment complete 🎉</h1>
    <p>Thanks! Your order has been received.</p>
    ${orderId ? `<p>Order ID: <code>${orderId}</code></p>` : ''}
    <p>You’ll receive your tickets by email shortly.</p>
    <a class="btn" href="/">Back to site</a>
  </div>
</body>
</html>
  `);
});

app.get('/cancel', (_req, res) => {
  res
    .status(200)
    .type('html')
    .send(`
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout cancelled</title></head>
<body style="font-family:system-ui,Inter,Arial,sans-serif;padding:32px">
  <h1>Checkout cancelled</h1>
  <p>No problem — your card wasn’t charged.</p>
  <p><a href="/">Back to site</a></p>
</body>
</html>
  `);
});

// Mount routers
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/webhooks', webhook); // '/webhooks/stripe' raw body is already handled above
app.use('/me', me);
app.use('/admin', admin);

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'Chuckl. Ticketing API',
    status: 'ok',
    health: '/health',
  });
});

// 404 fallback (keep LAST)
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Start
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on port ${port}`));
