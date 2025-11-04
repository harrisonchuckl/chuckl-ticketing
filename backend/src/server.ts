// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

import checkout from './routes/checkout.js';
import webhook from './routes/webhook.js';
import admin from './routes/admin.js';
import adminCreateShow from './routes/admin-create-show.js';
import adminVenues from './routes/admin-venues.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';

const app = express();

// Keep express-rate-limit safe behind Railway's proxy
app.set('trust proxy', 'loopback');

// Core middleware
app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks must use raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else uses JSON
app.use(express.json({ limit: '1mb' }));

// Light rate limiting for sensitive paths
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// Routes
app.use('/checkout', checkout);
app.use('/admin', admin);
app.use('/admin', adminCreateShow);
app.use('/admin', adminVenues);
app.use('/scan', scanApi);
app.use('/scan', scanUI);
app.use('/admin', adminUI);

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
