// backend/src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

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

// ---------- ESM-safe __dirname ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static assets for the seating builder (JS + CSS + any other static files)
// This makes /static/seating-builder.js and /static/seating-builder.css work.
app.use(
  "/static",
  express.static(path.join(__dirname, "..", "public", "static"))
);

// NEW: serve public assets (icons, etc.) from /public/*
// e.g. /public/seatmap-icons/row-dark.png -> http://localhost:3000/seatmap-icons/row-dark.png
app.use(express.static(path.join(__dirname, "..", "public")));

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
