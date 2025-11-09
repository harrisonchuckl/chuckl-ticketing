import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

// Existing routes
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';
import adminOrders from './routes/admin-orders.js';
import adminCoupons from './routes/admin-coupons.js';
import events from './routes/events.js';
import auth from './routes/auth.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

// NEW: Analytics API
import adminAnalytics from './routes/admin-analytics.js';

const app = express();

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
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// --- Public / customer routes ---
app.use('/events', events);
app.use('/checkout', checkout);

// --- Auth routes (cookie-based) ---
app.use('/auth', auth);

// --- Admin UI first so unauth view can render HTML instead of JSON errors ---
app.use('/admin', adminUI);

// --- Admin JSON APIs ---
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminOrders);
app.use('/admin', adminUploads);
app.use('/admin', adminCoupons);
app.use('/admin', adminAnalytics);

// Legacy / bootstrap admin endpoints (if you still need them)
app.use('/admin', admin);

// --- Scanner (door) ---
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
