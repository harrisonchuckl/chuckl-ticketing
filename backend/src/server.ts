// backend/src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ---- Existing routers in your repo ----
import authRouter from "./routes/auth.js";
import bootstrapRouter from "./routes/bootstrap.js";
import checkoutRouter from "./routes/checkout.js";
import webhookRouter from "./routes/webhook.js";
import publicOrdersRouter from "./routes/public-orders.js";
import uploadsRouter from "./routes/uploads.js";
import imageProxyRouter from "./routes/image-proxy.js";

// ---- Admin / new routers ----
import adminUploadsRouter from "./routes/admin-uploads.js";
import adminUiRouter from "./routes/admin-ui.js";
import adminVenuesRouter from "./routes/admin-venues.js";
import adminShowsRouter from "./routes/admin-shows.js";
import adminTicketTypesRouter from "./routes/admin-tickettypes.js";
import adminSeatMapsRouter from "./routes/admin-seatmaps.js";
import seatMapsRouter from "./routes/seatmaps.js";

// Seating choice + layout wizard (Steps 1–2)
import seatingChoiceRouter from "./routes/seating-choice.js";

// Full-screen builder (Step 3)
import adminSeatingBuilderRouter from "./routes/admin-seating-builder.js";

const app = express();

// behind a proxy/load balancer (Railway / Cloud Run / etc.)
app.set("trust proxy", 1);

// Core middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic global rate limit (tune as needed)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health checks
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));

// ---------- Public / core API ----------

app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);

// Legacy / miscellaneous
app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// ---------- Admin uploads ----------

// Uploads (new): accept POST /admin/uploads (and /admin/uploads/poster)
app.use("/admin/uploads", adminUploadsRouter);

// Back-compat alias some older UI used (/api/upload → same handler)
app.use("/api/upload", adminUploadsRouter);

// ---------- Admin domain APIs ----------

// Venues (search/create/update)
app.use("/admin", adminVenuesRouter);

// Shows (create/edit/list/duplicate etc.)
app.use("/admin", adminShowsRouter);

// Ticket types for shows
//  - GET  /admin/shows/:showId/ticket-types
//  - POST /admin/shows/:showId/ticket-types
//  - PUT  /admin/ticket-types/:id
//  - DELETE /admin/ticket-types/:id
app.use("/admin", adminTicketTypesRouter);

// Seat map CRUD + external allocations
//  - GET/POST /admin/seatmaps
//  - PATCH    /admin/seatmaps/:id/default
//  - POST     /admin/seatmaps/:id/allocations
app.use("/admin/seatmaps", adminSeatMapsRouter);

// Seat-level operations (used by the seating editor)
//  - GET  /seatmaps/:seatMapId/seats
//  - POST /seatmaps/:seatMapId/seats/bulk
//  - PATCH /seatmaps/seat/:seatId/status
//  - GET  /seatmaps/allocations/:allocationId
app.use("/seatmaps", seatMapsRouter);

// ---------- Seating wizard + full-screen builder ----------

// IMPORTANT: mount the full-screen builder BEFORE the seating-choice
// router so it doesn't get shadowed by the old stub route.
app.use("/admin/seating", adminSeatingBuilderRouter);

// Seating choice + layout wizard (Steps 1–2)
//  - GET /admin/seating-choice/:showId
//  - GET /admin/seating/unallocated/:showId
//  - GET /admin/seating/layout-wizard/:showId
app.use("/admin", seatingChoiceRouter);

// ---------- Admin SPA (Organiser Console) ----------

// Admin Console SPA at /admin/ui/*
app.use("/admin", adminUiRouter);

// 404 handler (JSON)
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
