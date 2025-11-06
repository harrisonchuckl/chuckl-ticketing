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
import adminOrders from './routes/admin-orders.js';
import adminUploads from './routes/admin-uploads.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';

import authRoutes from './routes/auth.js';
import { attachSession } from './lib/auth.js';

const app = express();

// Railway proxy
app.set('trust proxy', 'loopback');

app.use(cors({ credentials: true, origin: true }));
app.use(morgan('tiny'));
app.use(cookieParser());

// Stripe webhook uses raw body
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhook);

// Everything else JSON
app.use(express.json({ limit: '2mb' }));

// Light rate limit for admin/scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/scan', '/admin', '/auth'], limiter);

// Attach session early so UI can reflect login state
app.use(attachSession);

// ===== Routes (order matters) =====
app.use('/admin', adminUI);          // GET /admin/ui (HTML shell)
app.use('/auth', authRoutes);        // /auth/login, /auth/register, /auth/logout, /auth/me

app.use('/checkout', checkout);

app.use('/admin', adminVenues);      // /admin/venues (now session-protected in-file)
app.use('/admin', adminShows);       // /admin/shows
app.use('/admin', adminTicketTypes); // /admin/shows/:id/tickets
app.use('/admin', adminOrders);      // /admin/orders
app.use('/admin', adminUploads);     // /admin/uploads/presign

app.use('/admin', admin);            // legacy endpoints if any

app.use('/scan', scanApi);           // JSON
app.use('/scan', scanUI);            // HTML

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log('API running on port ' + PORT);
});

export default app;
