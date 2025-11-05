// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// ROUTES (keep paths with .js — we compile to ESM)
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';          // singular filename
import admin from './routes/admin.js';              // legacy admin JSON (keep)
import adminUI from './routes/admin-ui.js';         // HTML admin UI
import adminVenues from './routes/admin-venues.js'; // /admin/venues (list/create)
import adminShows from './routes/admin-shows.js';   // /admin/shows (CRUD)
import adminUploads from './routes/admin-uploads.js'; // /admin/uploads/presign (no-op for now)
import scanApi from './routes/scan.js';             // /scan JSON
import scanUI from './routes/scan-ui.js';           // /scan HTML

const app = express();

/**
 * Railway is behind a trusted proxy; this keeps rate-limit & IPs correct.
 * Setting to 'loopback' is safe (limits trust to 127.0.0.1/::1).
 */
app.set('trust proxy', 'loopback');

// Basic middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhook MUST receive the raw body
app.post(
  '/webhooks/stripe',
  bodyParser.raw({ type: 'application/json' }),
  webhook
);

// Everything else can parse JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate-limiting for admin & scanner endpoints
const limiter = rateLimit({
  windowMs: 60_000,          // 1 minute
  limit: 120,                // 120 req/min
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

/**
 * ROUTE ORDER MATTERS:
 * Serve the Admin UI HTML first so unauthenticated visits don’t get a JSON 401.
 * Then mount the admin JSON APIs, then checkout/scan/etc.
 */

// Admin UI (HTML)
app.use('/admin', adminUI);

// Admin JSON APIs
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminUploads);
app.use('/admin', admin); // keep legacy endpoints you already had

// Public/customer flows
app.use('/checkout', checkout);

// Scanner (JSON + HTML)
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start server
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
