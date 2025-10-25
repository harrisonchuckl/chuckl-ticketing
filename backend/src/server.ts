// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';   // singular file: webhook.ts
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';  // ⬅ NEW

const app = express();

// Keep express-rate-limit safe on Railway by scoping trust to loopback
app.set('trust proxy', 'loopback');

// Core middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must receive the raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can parse JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate-limiting for admin + scan
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// Routes
app.use('/checkout', checkout);
app.use('/admin', admin);
app.use('/admin', adminUI);  // ⬅ NEW: serves GET /admin/ui
app.use('/scan', scanApi);   // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUI);    // UI at GET /scan

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
