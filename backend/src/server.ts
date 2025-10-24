import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Route modules
import checkout from './routes/checkout.js';
import webhooks from './routes/webhook.js';   // singular file: webhook.ts
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// Railway is behind a proxy; keep express-rate-limit safe by scoping trust:
app.set('trust proxy', 'loopback');

// Basic middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks: must use raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhooks);

// Everything else uses JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate limit for admin + scan
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
app.use('/scan', scanApi); // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUI);  // UI at GET /scan

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
