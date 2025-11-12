import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import logoutRoutes from './routes/logout.js';
import eventsRoutes from './routes/events.js';
import adminVenuesRoutes from './routes/admin-venues.js';
import venuesRoutes from './routes/venues.js';

const app = express();

app.use(cors({
  origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mount routes
app.use('/auth', authRoutes);
app.use('/auth', logoutRoutes);           // GET /auth/logout
app.use('/events', eventsRoutes);
app.use('/admin', adminVenuesRoutes);
app.use('/venues', venuesRoutes);         // GET /venues/:venueId/seating-maps

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});