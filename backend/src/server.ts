import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ---- Routers (these files already exist in your repo) ----
import authRouter from "./routes/auth.js";
import bootstrapRouter from "./routes/bootstrap.js";
import checkoutRouter from "./routes/checkout.js";
import webhookRouter from "./routes/webhook.js";
import publicOrdersRouter from "./routes/public-orders.js";
import adminUploadsRouter from "./routes/admin-uploads.js";
import uploadsRouter from "./routes/uploads.js";
import imageProxyRouter from "./routes/image-proxy.js";

// You likely have many more admin/* routes; importing them here is fine,
// but not required for the compile to succeed.

const app = express();

// behind a proxy/load balancer (Cloud Run/ALB/etc.)
app.set("trust proxy", 1);

// Core middleware
app.use(
  cors({
    origin: "*", // adjust if you want cookie auth with specific origins
    credentials: true
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
    legacyHeaders: false
  })
);

// Health checks
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));

// Mount routers
app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);
app.use("/admin/uploads", adminUploadsRouter);
app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
