// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Existing routes
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';

// New/updated admin + scanner routes
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminUploads from './routes/uploads.js';

import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// Railway is behind a trusted proxy; keep express-rate-limit safe
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must use raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can use JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate limit for admin + scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

/**
 * ROUTES
 * Order matters so the Admin UI HTML is always served (not blocked by JSON auth).
 */
app.use('/admin', adminUI);        // GET /admin/ui (HTML dashboard)
app.use('/checkout', checkout);

// Admin JSON APIs
app.use('/admin', adminVenues);    // GET /admin/venues
app.use('/admin', adminShows);     // /admin/shows (CRUD + ticket types + stats)
app.use('/admin', adminUploads);   // /admin/uploads/presign (S3 presign)
app.use('/admin', admin);          // legacy endpoints you already had

// Scanner
app.use('/scan', scanApi);         // JSON endpoints: /scan/check, /scan/mark, /scan/stats
app.use('/scan', scanUI);          // UI at GET /scan

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
