// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Route modules (compiled to .js at build time)
import checkoutRouter from './routes/checkout.js';
import webhookRouter from './routes/webhook.js';
import adminRouter from './routes/admin.js';
import scanApiRouter from './routes/scan.js';
import scanUiRouter from './routes/scan-ui.js';
import adminUiRouter from './routes/admin-ui.js';

const app = express();

/**
 * IMPORTANT: We're behind Railway’s proxy.
 * Use a SAFE trust proxy so express-rate-limit can’t be bypassed.
 */
app.set('trust proxy', 'loopback'); // only loopback addresses are trusted

// Core middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe (and other) webhooks must use RAW body
app.post(
  '/webhooks/stripe',
  bodyParser.raw({ type: 'application/json' }),
  webhookRouter
);

// Everything else can use JSON
app.use(express.json({ limit: '1mb' }));

// Light rate limiter for admin & scanner endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120,          // 120 requests/minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// Routes
app.use('/checkout', checkoutRouter);
app.use('/admin', adminRouter);
app.use('/scan', scanApiRouter);   // JSON: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUiRouter);    // UI:   GET /scan
app.use('/admin/ui', adminUiRouter); // Admin Dashboard UI

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Boot
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
