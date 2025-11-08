// backend/src/server.ts

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

// --- Route imports ---
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';
import adminOrders from './routes/admin-orders.js';
import adminAnalytics from './routes/admin-analytics.js'; // ✅ NEW Analytics
import events from './routes/events.js';
import auth from './routes/auth.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

// --- Express setup ---
const app = express();
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));
app.use(cookieParser());

// --- Stripe Webhook (raw body required) ---
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// --- Standard JSON parsing ---
app.use(express.json({ limit: '1mb' }));

// --- Lightweight rate limiter for admin + scan ---
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120, // max 120 requests/minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// --- Public routes (customer-facing) ---
app.use('/events', events);
app.use('/checkout', checkout);

// --- Authentication routes ---
app.use('/auth', auth);

// --- Admin UI (renders HTML) ---
app.use('/admin', adminUI);

// --- Admin APIs ---
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminOrders);
app.use('/admin', adminUploads);
app.use('/admin', adminAnalytics); // ✅ New Analytics API mounted
app.use('/admin', admin); // legacy support

// --- Scanner (door staff interface) ---
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// --- Healthcheck ---
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Start server ---
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('✅ API running on port ' + PORT);
});

export default app;
