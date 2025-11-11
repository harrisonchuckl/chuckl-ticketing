import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

// Public & misc routes
import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import events from './routes/events.js';
import publicUI from './routes/public-ui.js';
import imageProxy from './routes/image-proxy.js';

// Uploads (new)
import uploadRoute from './routes/uploads.js';

// Auth
import auth from './routes/auth.js';
import authLogout from './routes/logout.js';
import loginUI from './routes/login-ui.js';

// 🔐 TEMP: one-time bootstrap to create first organiser user (remove after use)
import bootstrap from './routes/bootstrap.js';

// Admin UI + APIs
import admin from './routes/admin.js';
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';
import adminOrders from './routes/admin-orders.js';
import adminAnalytics from './routes/admin-analytics.js';
import adminExports from './routes/admin-exports.js';

const app = express();

// Behind Railway/Proxy
app.set('trust proxy', 'loopback');

// CORS (allow cookies for admin)
app.use(cors({ origin: true, credentials: true }));

app.use(morgan('tiny'));
app.use(cookieParser());

// Stripe webhooks need raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else as JSON
app.use(express.json({ limit: '2mb' })); // bump to 2MB for admin payloads

// --- File upload API (multipart) ---
app.use('/api/upload', uploadRoute);

// --- Public / customer JSON routes ---
app.use('/events', events);
app.use('/checkout', checkout);

// --- Public HTML UI ---
app.use('/public', publicUI);

// --- Image proxy (resizes & caches to R2) ---
app.use('/', imageProxy);

// --- Auth routes (UI + JSON) ---
app.use('/auth', loginUI);     // GET /auth/login (HTML)
app.use('/auth', auth);        // POST /auth/login etc (JSON)
app.use('/auth', authLogout);  // GET /auth/logout -> redirect to /auth/login

// ⚠️ TEMP: bootstrap first user (remove after successful login)
app.use('/auth', bootstrap);

// Light rate limit for admin
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin'], limiter);

// --- Admin UI first so unauth users see HTML not JSON ---
app.use('/admin', adminUI);

// --- Admin JSON APIs ---
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminOrders);
app.use('/admin', adminUploads);
app.use('/admin', adminAnalytics);
app.use('/admin', adminExports);

// Legacy / bootstrap admin endpoints (if still used)
app.use('/admin', admin);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
