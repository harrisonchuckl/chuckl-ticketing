import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

// Core feature routes you already have (adjust names if your filenames differ)
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminUploads from './routes/admin-uploads.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminOrders from './routes/admin-orders.js';
import events from './routes/events.js';
import me from './routes/me.js';

// Auth (new & updated)
import auth from './routes/auth.js';
import authResetUI from './routes/auth-reset-ui.js';

const app = express();

// Trust proxy (Railway)
app.set('trust proxy', 'loopback');

// Baseline middleware
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
app.use(['/scan', '/admin', '/auth'], limiter);

// ---- ROUTE ORDER (important) ----

// Auth first (cookies/JWT)
app.use('/auth', auth);
app.use('/auth', authResetUI);          // GET /auth/reset/:token (HTML page)

// Admin UI (HTML) early so it doesn't get blocked by JSON errors
app.use('/admin', adminUI);

// Admin JSON routes
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminUploads);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminOrders);
app.use('/admin', admin);               // legacy admin endpoints

// Public/event routes
app.use('/checkout', checkout);
app.use('/events', events);

// Scan routes (JSON + HTML)
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Health
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
