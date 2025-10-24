// backend/src/server.ts

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// NOTE: .js extensions are intentional for Node/ESM runtime.
// They point to the compiled files at runtime.
import checkout from './routes/checkout.js';
import webhooks from './routes/webhook.js';    // <— singular
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUi from './routes/scan-ui.js';

const app = express();

// Railway is behind a proxy — keep express-rate-limit safe:
app.set('trust proxy', 'loopback');

// Core middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must receive the raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhooks);

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
app.use('/scan', scanApi); // JSON: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUi);  // UI:   GET /scan

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
