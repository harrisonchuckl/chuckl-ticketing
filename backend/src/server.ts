// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js'; // ✅ fixed: singular file name
import admin from './routes/admin.js';
import adminCreateShow from './routes/admin-create-show.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';

const app = express();

// Railway is behind a trusted proxy; set to 'loopback' so express-rate-limit is safe
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must use raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can use JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate limit for admin/scan actions
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// Routes
app.use('/checkout', checkout);
app.use('/admin', admin);
app.use('/admin', adminCreateShow);
app.use('/scan', scanApi);   // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUI);    // UI at GET /scan
app.use('/admin', adminUI);  // Admin dashboard UI

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});

export default app;
