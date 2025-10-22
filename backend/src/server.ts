import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';
import { router as scan } from './routes/scan.js';

const app = express();

// Security + perf
app.use(helmet());
app.set('trust proxy', 1); // we’re behind Railway’s proxy
app.use(cors({
  origin: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean).length
    ? (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    : true
}));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Stripe webhook must get the raw body BEFORE express.json()
import bodyParser from 'body-parser';
app.use('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }));

// Normal JSON elsewhere
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/webhooks', webhook);
app.use('/me', me);
app.use('/admin', admin);

// Scanning (protected with x-admin-key)
app.use('/admin/scan', scan);

// Success page (already present earlier, keep if you have it)
app.get('/success', (req, res) => {
  const orderId = (req.query.orderId || '').toString();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Thanks – Chuckl. Tickets</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:40px;background:#0b0b10;color:#f6f7fb}
.card{max-width:680px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
h1{margin:0 0 8px;font-weight:700;font-size:28px}
p{margin:8px 0 0;color:#c6c8d1;line-height:1.55}
code{background:#0f1320;padding:.2em .45em;border-radius:6px;border:1px solid #20253a}
a.btn{display:inline-block;margin-top:16px;padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none}
</style></head><body>
<div class="card">
  <h1>Payment complete 🎉</h1>
  <p>Thanks! Your order has been received.</p>
  <p>Order ID: <code>${orderId || 'unknown'}</code></p>
  <p>Show this email at the door. We’ll scan your QR/ticket on entry.</p>
  <a class="btn" href="/">Back to site</a>
</div>
</body></html>`);
});

// Start
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on port ${port}`));
