import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// existing routers in your codebase
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as checkout } from './routes/checkout.js';
import { router as webhook } from './routes/webhook.js';
import { router as me } from './routes/me.js';
import { router as admin } from './routes/admin.js';

// NEW: scan endpoints + tiny admin lookup
import { router as scan } from './routes/scan.js';
import { router as adminLookup } from './routes/admin-lookup.js';

const app = express();

// Trust Railway/Proxy so rate-limit reads the client IP correctly
app.set('trust proxy', 1);

// Security & basics
app.use(helmet());
app.use(
  cors({
    origin:
      (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean).length > 0
        ? (process.env.CORS_ORIGINS as string).split(',').map(s => s.trim())
        : true
  })
);
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Important: the Stripe router handles its own raw body inside the route file,
// so we can safely put JSON here for the rest of the app.
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Mount business routes
app.use('/auth', auth);
app.use('/events', events);
app.use('/checkout', checkout);
app.use('/webhooks', webhook); // stripe webhook lives here
app.use('/me', me);
app.use('/admin', admin);

// NEW: scanners + admin lookup
app.use('/scan', scan);
app.use('/admin', adminLookup);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on port ${port}`));
