import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';
import { router as scanUi } from './routes/scan-ui.js'; // <-- new UI route

const app = express();

// Trust Railway/edge proxy so rate-limit sees real IPs
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) || true }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public API
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/webhooks', webhook);
app.use('/me', me);

// Admin/API tools
app.use('/admin', admin);

// Door staff UI (HTML)
app.use('/scan', scanUi);

// Fallback 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(Number(process.env.PORT || 4000), () =>
  console.log('API running on port ' + (process.env.PORT || 4000))
);
