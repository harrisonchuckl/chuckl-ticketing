import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
// (optional) if you use it: import helmet from "helmet";

// ---- Routers ----
// NOTE: With TS `moduleResolution: "node16"/"nodenext"` you must use `.js` in imports.
import authRouter from "./routes/auth.js";
import bootstrapRouter from "./routes/bootstrap.js";
import checkoutRouter from "./routes/checkout.js";
import webhookRouter from "./routes/webhook.js";
import publicOrdersRouter from "./routes/public-orders.js";
import adminUploadsRouter from "./routes/admin-uploads.js";
import uploadsRouter from "./routes/uploads.js";
import imageProxyRouter from "./routes/image-proxy.js";

const app = express();

// Trust upstream proxy (Railway / Cloud Run / ALB)
app.set("trust proxy", 1);

// Core middleware
// If you need cookie auth from a specific origin, swap "*" for your domain and set credentials: true
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// app.use(helmet()); // uncomment if you’ve added it to deps
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic rate limit (tune to taste)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health checks / simple root
app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));

// ---- Routes ----
app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);   // <= the one you needed
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);
app.use("/admin/uploads", adminUploadsRouter);
app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Error handler (so stack traces don’t leak as HTML)
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
);

export default app;
