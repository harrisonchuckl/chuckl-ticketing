// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Routes (ESM: use .js extensions)
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';

const app = express();

// Railway is behind a proxy; this keeps rate-limit IPs correct
app.set('trust proxy', 'loopback');

// --- UI routes that must be PUBLIC (no auth header required) ---
// Mount BEFORE the protected /admin API router:
app.use(adminUI);   // serves GET /admin/ui
app.use('/scan', scanUI); // serves scanner UI at GET /scan

// --- Core middleware for APIs ---
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must receive raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can parse JSON
app.use(express.json({ limit: '1mb' }));

// Light rate-limit for sensitive API paths
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// --- API routes ---
app.use('/checkout', checkout);
app.use('/scan', scanApi);   // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/admin', admin);    // PROTECTED admin API (requires x-admin-key)

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
