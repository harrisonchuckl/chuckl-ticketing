// backend/src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { attachUser } from "./middleware/requireAuth.js";

import authRoutes from "./routes/auth.js";
import logoutRoutes from "./routes/logout.js";
import eventsRoutes from "./routes/events.js";
import adminVenuesRoutes from "./routes/admin-venues.js";
import adminPromotersRoutes from "./routes/admin-promoters.js";
import venuesRoutes from "./routes/venues.js";

// NEW: same admin + seatmap routes as server.ts
import adminTicketTypesRoutes from "./routes/admin-tickettypes.js";
import adminSeatMapsRoutes from "./routes/admin-seatmaps.js";
import seatMapsRoutes from "./routes/seatmaps.js";
import adminOrdersApiRoutes from "./routes/admin-orders-api.js";
import adminAiCrmRoutes from "./routes/admin-ai-crm.js";
import adminOwnerRoutes from "./routes/admin-owner.js";

const app = express();

app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// ---------- Public APIs ----------
app.use("/auth", authRoutes);
app.use("/auth", logoutRoutes); // GET /auth/logout
app.use("/events", eventsRoutes);

// Existing venues APIs
app.use("/admin", adminVenuesRoutes);
app.use("/admin", adminPromotersRoutes);
app.use("/venues", venuesRoutes); // GET /venues/:venueId/seating-maps

// ---------- NEW: ticketing + seatmaps APIs ----------
app.use("/admin", adminTicketTypesRoutes);       // /admin/shows/:showId/ticket-types
app.use("/admin/seatmaps", adminSeatMapsRoutes); // /admin/seatmaps?showId=...
app.use("/seatmaps", seatMapsRoutes);            // /seatmaps/:seatMapId/...
app.use("/admin/api", adminOrdersApiRoutes);
app.use("/admin/api", adminAiCrmRoutes);
app.use("/admin/api", adminOwnerRoutes);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
