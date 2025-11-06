// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// Railway is behind a trusted proxy; keep rate-limit correct
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));
app.use(cookieParser());

// Stripe webhooks need raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else as JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate-limit for admin/scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// ROUTES (order matters so the admin UI isn’t blocked by auth JSON errors)
app.use('/admin', adminUI);         // GET /admin/ui (HTML)
app.use('/checkout', checkout);
app.use('/admin', adminVenues);     // GET/POST /admin/venues
app.use('/admin', adminShows);      // /admin/shows (CRUD)
app.use('/admin', adminTicketTypes);// /shows/:showId/ticket-types
app.use('/admin', adminUploads);    // /admin/uploads/presign (stub or real)
app.use('/admin', admin);           // legacy admin endpoints you already had
app.use('/scan', scanApi);          // JSON endpoints
app.use('/scan', scanUI);           // GET /scan (HTML)

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
