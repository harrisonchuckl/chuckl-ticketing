// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';

import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminUploads from './routes/admin-uploads.js';
import adminTicketTypes from './routes/admin-tickettypes.js';

import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// keep rate-limit correct behind proxy
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must use raw
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// JSON for everything else
app.use(express.json({ limit: '1mb' }));

// Admin/scanner limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// ORDER MATTERS: UI first so it can render without being blocked by JSON auth errors
app.use('/admin', adminUI);           // GET /admin/ui (HTML)
app.use('/admin', adminVenues);       // /admin/venues
app.use('/admin', adminShows);        // /admin/shows
app.use('/admin', adminTicketTypes);  // /admin/shows/:showId/ticket-types (CRUD)
app.use('/admin', adminUploads);      // /admin/uploads/presign (stub)
app.use('/admin', admin);             // legacy endpoints

app.use('/checkout', checkout);
app.use('/scan', scanApi);            // JSON
app.use('/scan', scanUI);             // HTML

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
