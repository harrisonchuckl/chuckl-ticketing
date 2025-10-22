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
import { router as scanUI } from './routes/scan-ui.js';

const app = express();

// trust proxy so rate-limit uses correct client IPs (Railway / proxies)
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

// basic rate limit
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true }));

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// routes
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);

// Stripe webhook MUST receive raw body
app.use('/webhooks', webhook);

app.use('/me', me);
app.use('/admin', admin);

// Simple browser scanner UI (uses your /scan/check + /scan/mark APIs)
app.use('/scan', scanUI);

// success page already lives in /success (if you added it)
// …any other static/public mounts here

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log('API running on port', port));
