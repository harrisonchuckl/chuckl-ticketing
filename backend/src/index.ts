// backend/src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import logoutRoutes from "./routes/logout.js";
import eventsRoutes from "./routes/events.js";
import adminVenuesRoutes from "./routes/admin-venues.js";
import venuesRoutes from "./routes/venues.js";

// NEW: same admin + seatmap routes as server.ts
import adminTicketTypesRoutes from "./routes/admin-tickettypes.js";
import adminSeatMapsRoutes from "./routes/admin-seatmaps.js";
import seatMapsRoutes from "./routes/seatmaps.js";

const app = express();

app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ---------- Public APIs ----------
app.use("/auth", authRoutes);
app.use("/auth", logoutRoutes); // GET /auth/logout
app.use("/events", eventsRoutes);

// Existing venues APIs
app.use("/admin", adminVenuesRoutes);
app.use("/venues", venuesRoutes); // GET /venues/:venueId/seating-maps

// ---------- NEW: ticketing + seatmaps APIs ----------
app.use("/admin", adminTicketTypesRoutes);       // /admin/shows/:showId/ticket-types
app.use("/admin/seatmaps", adminSeatMapsRoutes); // /admin/seatmaps?showId=...
app.use("/seatmaps", seatMapsRoutes);            // /seatmaps/:seatMapId/...

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
