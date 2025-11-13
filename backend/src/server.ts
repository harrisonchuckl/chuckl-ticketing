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

// ---- Admin / organiser routers ----
import adminUploadsRouter from "./routes/admin-uploads.js";
import adminUiRouter from "./routes/admin-ui.js";
import adminVenuesRouter from "./routes/admin-venues.js";
import adminShowsRouter from "./routes/admin-shows.js";

// ---- NEW: ticket types + seat maps ----
import adminTicketTypesRouter from "./routes/admin-tickettypes.js";
import adminSeatMapsRouter from "./routes/admin-seatmaps.js";
import seatMapsRouter from "./routes/seatmaps.js";

const app = express();

// Behind a proxy/load balancer (Railway / Cloud Run / etc.)
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

// ---------- Public / core APIs ----------
app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);

// Legacy / miscellaneous
app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// ---------- Admin / organiser APIs ----------

// Uploads (new): accept POST /admin/uploads (and /admin/uploads/poster)
app.use("/admin/uploads", adminUploadsRouter);

// Back-compat alias some older UI used (/api/upload → same handler)
app.use("/api/upload", adminUploadsRouter);

// Admin data APIs
app.use("/admin", adminVenuesRouter);
app.use("/admin", adminShowsRouter);

// NEW: ticket types for a show
// - GET  /admin/shows/:showId/ticket-types
// - POST /admin/shows/:showId/ticket-types
app.use("/admin", adminTicketTypesRouter);

// NEW: admin seatmap endpoints
// - GET /admin/seatmaps?showId=...
// - future POST/PUT for builder
app.use("/admin", adminSeatMapsRouter);

// NEW: public / low-level seatmap API (used by builder + frontend)
// e.g. GET /seatmaps/:seatMapId/seats
app.use("/seatmaps", seatMapsRouter);

// ---------- Admin Console SPA at /admin/ui/* ----------
app.use("/admin", adminUiRouter);

// ---------- 404 handler (JSON) ----------
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
