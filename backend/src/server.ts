import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Existing routers
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';
import { router as scan } from './routes/scan.js';        // your working check/mark API
import { router as scanUi } from './routes/scan-ui.js';    // NEW: the UI we just created

const app = express();

// Trust Railway/Proxy (fixes rate-limit warning re X-Forwarded-For)
app.set('trust proxy', true);

// Security + JSON
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS (allow list via env or allow all for now)
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

// Rate limiting
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Feature routes
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/webhooks', webhook);
app.use('/me', me);
app.use('/admin', admin);

// Scanner API already here
app.use('/scan', scan);

// Scanner UI (GET /scan)
app.use('/', scanUi);

// Minimal success page (keeps Stripe redirect happy)
app.get('/success', (req, res) => {
  const orderId = String(req.query.orderId || '');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Thanks – Chuckl. Tickets</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:40px;background:#0b0b10;color:#f6f7fb}
.card{max-width:680px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:28px}
h1{margin:0 0 8px;font-weight:700;font-size:28px}
p{margin:8px 0 0;color:#c6c8d1;line-height:1.55}
code{background:#0f1320;padding:.2em .45em;border-radius:6px;border:1px solid #20253a}
a.btn{display:inline-block;margin-top:16px;padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none}
</style></head>
<body><div class="card">
<h1>Payment complete 🎉</h1>
<p>Thanks! Your order has been received.</p>
<p>Order ID: <code>${orderId || 'unknown'}</code></p>
<p>You’ll receive your tickets by email shortly.</p>
<a class="btn" href="/">Back to site</a>
</div></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Start server
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log('API running on port ' + port));
