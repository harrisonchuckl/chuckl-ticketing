import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Routers
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

// RAW body FIRST for Stripe webhooks
app.use('/webhooks', express.raw({ type: 'application/json' }), webhook);

// JSON for everything else
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) || true
}));

app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/me', me);
app.use('/admin', admin);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on port ${port}`));
