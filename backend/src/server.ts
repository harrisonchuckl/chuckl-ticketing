// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';

// Route modules
import checkout from './routes/checkout.js';
import admin from './routes/admin.js';
import scanApi from './routes/scan.js';
import scanUI from './routes/scan-ui.js';
import adminUI from './routes/admin-ui.js';
import adminCreateShow from './routes/admin-create-show.js';
import adminEditShow from './routes/admin-edit-show.js';
import webhooks from './routes/webhook.js';

const app = express();

// Trust proxy (needed for rate limiter behind Railway)
app.set('trust proxy', 'loopback');

app.use(cors());
app.use(morgan('tiny'));

// Stripe webhooks (raw body)
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), webhooks);

// JSON for everything else
app.use(express.json({ limit: '1mb' }));

// Basic rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/scan', '/admin'], limiter);

// === ROUTE ORDER FIX ===
// Admin UI must come BEFORE /admin JSON routes
app.use('/admin/ui', adminUI);
app.use('/admin/create', adminCreateShow);
app.use('/admin/edit', adminEditShow);
app.use('/admin', admin); // this must be last among admin routes

// Other routes
app.use('/checkout', checkout);
app.use('/scan', scanApi);
app.use('/scan', scanUI);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});

export default app;
