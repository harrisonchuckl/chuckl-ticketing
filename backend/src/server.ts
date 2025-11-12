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

// ---- New/adjusted routers ----
import adminUploadsRouter from "./routes/admin-uploads.js";
import adminUiRouter from "./routes/admin-ui.js";
import adminVenuesRouter from "./routes/admin-venues.js";

const app = express();

// behind a proxy/load balancer (Railway / Cloud Run / etc.)
app.set("trust proxy", 1);

// Core middleware
app.use(
  cors({
    origin: "*", // tighten later if you switch to cookie auth from a specific origin
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

// Existing mounts
app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);

// Legacy / miscellaneous
app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// Uploads (new) – the route inside is `/poster`
app.use("/admin/uploads", adminUploadsRouter);
// Back-compat alias some older UI used
app.use("/api/upload", adminUploadsRouter);

// Admin API bits
app.use("/admin", adminVenuesRouter);

// Admin Console SPA shell at /admin/ui/*
app.use("/admin", adminUiRouter);

// 404 handler (JSON)
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;