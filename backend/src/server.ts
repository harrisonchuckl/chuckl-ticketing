// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Route modules (NodeNext / ESM requires .js extensions at runtime)
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';   // singular file: webhook.ts
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';   // <-- new UI route (public HTML)

const app = express();

// Railway is behind a trusted proxy; keep express-rate-limit safe by scoping trust:
app.set('trust proxy', 'loopback');

// Basic middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must use raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can parse JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate limit for admin + scan (polite but tidy)
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Mount order matters ---
// 1) Public Admin UI (no auth; UI sends x-admin-key in subsequent JSON calls)
app.use('/admin', adminUI);

// 2) Protected admin JSON routes
app.use('/admin', admin);

// 3) Checkout + scan
app.use('/checkout', checkout);
app.use('/scan', scanApi);   // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUI);    // UI at GET /scan

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
