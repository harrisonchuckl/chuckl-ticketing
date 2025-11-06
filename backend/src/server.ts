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
import adminOrders from './routes/admin-orders.js';
import adminTicketTypes from './routes/admin-tickettypes.js';
import adminUploads from './routes/admin-uploads.js';

import auth from './routes/auth.js';
import passwordReset from './routes/password-reset.js';

import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

const app = express();

// proxies
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));
app.use(cookieParser());

// Stripe webhooks need raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else as JSON
app.use(express.json({ limit: '1mb' }));

// lightweight rate-limit for admin/scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin', '/auth'], limiter);

// AUTH
app.use('/', auth);
app.use('/', passwordReset);

// Admin UI first so failed auth doesn’t block the HTML
app.use('/admin', adminUI);

// Admin APIs
app.use('/admin', adminVenues);
app.use('/admin', adminShows);
app.use('/admin', adminOrders);
app.use('/admin', adminTicketTypes);
app.use('/admin', adminUploads);

// checkout
app.use('/checkout', checkout);

// scanner
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
