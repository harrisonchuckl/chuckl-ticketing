// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// --- Route modules (make sure these files exist and compile to .js) ---
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';            // Stripe webhook (singular filename)
import admin from './routes/admin.js';                // legacy/utility admin endpoints
import adminUI from './routes/admin-ui.js';           // HTML admin interface
import adminVenues from './routes/admin-venues.js';   // /admin/venues (list/create)
import adminShows from './routes/admin-shows.js';     // /admin/shows (CRUD)
import adminTicketTypes from './routes/admin-tickettypes.js'; // /admin/shows/:id/tickets (CRUD)
import adminUploads from './routes/admin-uploads.js'; // /admin/uploads/presign (stub or S3)
import adminOrders from './routes/admin-orders.js';   // /admin/orders (listing/filtering)

import scanApi from './routes/scan.js';               // JSON scan endpoints
import scanUI from './routes/scan-ui.js';             // HTML scanner UI

const app = express();

// Railway is behind a trusted proxy; keep rate-limit and IPs correct
app.set('trust proxy', 'loopback');

// CORS + logging
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks require the *raw* body (before JSON parsing)
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can use JSON parser
app.use(express.json({ limit: '1mb' }));

// Lightweight rate-limit for potentially sensitive paths
const limiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute
  limit: 120,                    // 120 req/min per IP
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// -------------------------------
// ROUTE MOUNT ORDER (IMPORTANT)
// -------------------------------
// 1) Serve Admin UI first so GET /admin/ui always returns HTML (not JSON 401)
app.use('/admin', adminUI);

// 2) Public checkout (session/create etc.)
app.use('/checkout', checkout);

// 3) Admin JSON APIs
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminUploads);
app.use('/admin', adminOrders);
app.use('/admin', admin); // keep legacy/admin helpers last under /admin

// 4) Scanner APIs + UI
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
