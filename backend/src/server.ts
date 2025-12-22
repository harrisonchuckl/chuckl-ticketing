import "./env.js"; 
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { attachUser } from "./middleware/requireAuth.js";

// ---- Existing routers ----
import authRouter from "./routes/auth.js";
import bootstrapRouter from "./routes/bootstrap.js";
import checkoutRouter from "./routes/checkout.js";
import webhookRouter from "./routes/webhook.js";
import publicOrdersRouter from "./routes/public-orders.js";
import uploadsRouter from "./routes/uploads.js";
import imageProxyRouter from "./routes/image-proxy.js";

// --- THE NEW ROUTER ---
import publicEventRouter from "./routes/public-event-ssr.js";

// ---- Admin routers ----
import adminUploadsRouter from "./routes/admin-uploads.js";
import adminUiRouter from "./routes/admin-ui.js";
import adminVenuesRouter from "./routes/admin-venues.js";
import adminShowsRouter from "./routes/admin-shows.js";
import adminTicketTypesRouter from "./routes/admin-tickettypes.js";
import adminSeatMapsRouter from "./routes/admin-seatmaps.js";
import seatMapsRouter from "./routes/seatmaps.js";
import seatingChoiceRouter from "./routes/seating-choice.js";
import adminSeatingBuilderRouter from "./routes/admin-seating-builder.js";

const app = express();

app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Core middleware ----------
app.use(cors({ origin: "*", credentials: true }));
app.use(morgan("dev"));

// IMPORTANT: Stripe webhooks require the raw request body for signature verification.
// Apply raw ONLY for the Stripe webhook endpoint BEFORE express.json().

app.use(
  express.json({
    limit: "25mb",
   verify: (req: any, _res, buf) => {
  // Stripe needs the raw body for signature verification.
  // NOTE: This route is mounted under /webhook, so originalUrl includes that prefix.
  if (
    req.originalUrl === "/webhook/webhooks/stripe" ||
    req.originalUrl === "/webhooks/stripe" ||
    req.originalUrl.endsWith("/webhooks/stripe")
  ) {
    req.rawBody = buf;
  }
},
  })
);
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cookieParser());
app.use(attachUser);



// ---------- Static assets ----------
app.use("/static", express.static(path.join(__dirname, "..", "public", "static")));
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------- Rate limit ----------
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Health checks ----------
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));

// ---------- Routes ----------
app.use("/auth", authRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/public/orders", publicOrdersRouter);

// *** MOUNT THE NEW ROUTER HERE ***
app.use("/public", publicEventRouter);

app.use("/uploads", uploadsRouter);
app.use("/image-proxy", imageProxyRouter);

// Admin
app.use("/admin/uploads", adminUploadsRouter);
app.use("/api/upload", adminUploadsRouter);
app.use("/admin", adminVenuesRouter);
app.use("/admin", adminShowsRouter);
app.use("/admin", adminTicketTypesRouter);
app.use("/admin/seatmaps", adminSeatMapsRouter);
app.use("/seatmaps", seatMapsRouter);
app.use("/admin/seating", adminSeatingBuilderRouter);
app.use("/admin", seatingChoiceRouter);
app.use("/admin", adminUiRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
