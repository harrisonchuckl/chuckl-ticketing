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

// NEW
import authRoutes from './routes/auth.js';
import { attachUser, requireAuth } from './middleware/requireAuth.js';

// Your other admin feature routes
import adminUI from './routes/admin-ui.js';
import adminVenues from './routes/admin-venues.js';
import adminShows from './routes/admin-shows.js';
import adminOrders from './routes/admin-orders.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();
app.set('trust proxy', 'loopback');

app.use(cors({ credentials: true, origin: true }));
app.use(morgan('tiny'));

// Stripe webhooks need raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else as JSON + cookies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// attach req.user if cookie exists
app.use(attachUser);

// rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin', '/auth'], limiter);

// AUTH
app.use(authRoutes);

// Admin UI stays public so you can reach the login page
app.use('/admin', adminUI);

// Protect admin JSON APIs after UI is set
app.use('/admin', requireAuth, adminVenues);
app.use('/admin', requireAuth, adminShows);
app.use('/admin', requireAuth, adminOrders);
app.use('/admin', requireAuth, admin); // legacy

// Scan endpoints (you can choose to protect with requireAuth later if needed)
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Checkout flow
app.use('/checkout', checkout);

// Health
app.get('/health', (_req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'dev' }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
