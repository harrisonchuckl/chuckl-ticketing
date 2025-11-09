// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

// Public & utility routes
import events from './routes/events.js';
import checkout from './routes/checkout.js';
import auth from './routes/auth.js';
import webhook from './routes/webhook.js';

// Admin JSON APIs
import admin from './routes/admin.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';
import adminOrders from './routes/admin-orders.js';
import adminAnalytics from './routes/admin-analytics.js';
import adminExports from './routes/admin-exports.js'; // 👈 NEW

// Admin UI (HTML)
import adminUI from './routes/admin-ui.js';

// Scanner
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// behind proxy (Railway/NGINX/etc.)
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));
app.use(cookieParser());

// Stripe webhooks must receive the raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else can be JSON
app.use(express.json({ limit: '1mb' }));

// Lightweight rate-limit for admin/scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// ---- Public customer routes ----
app.use('/events', events);
app.use('/checkout', checkout);

// ---- Auth (cookie-based) ----
app.use('/auth', auth);

// ---- Admin UI (HTML first so unauthenticated users see the login page) ----
app.use('/admin', adminUI);

// ---- Admin APIs (JSON) ----
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminOrders);
app.use('/admin', adminUploads);
app.use('/admin', adminAnalytics);
app.use('/admin', adminExports); // 👈 NEW

// Legacy/admin bootstrap (keep if still needed)
app.use('/admin', admin);

// ---- Scanner (door) ----
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// ---- Health ----
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
