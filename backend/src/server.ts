// backend/src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";

// Routes
import checkout from "./routes/checkout.js";
import webhook from "./routes/webhook.js";          // ✅ file is webhook.ts
import admin from "./routes/admin.js";
import scanApi from "./routes/scan.js";
import scanUI from "./routes/scan-ui.js";
import adminUI from "./routes/admin-ui.js";         // ✅ new Admin UI
import adminVenues from "./routes/admin-venues.js"; // ✅ venues CRUD/list
import adminCreateShow from "./routes/admin-create-show.js"; // ✅ show create/list

const app = express();

// Express behind proxy: safe value for express-rate-limit
app.set("trust proxy", "loopback");

app.use(cors());
app.use(morgan("tiny"));

// Stripe webhook: raw body
app.post("/webhooks/stripe", bodyParser.raw({ type: "application/json" }), webhook);

// JSON for everything else
app.use(express.json({ limit: "1mb" }));

// Mild rate limit for admin/scan
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/scan", "/admin"], limiter);

// Routers
app.use("/checkout", checkout);
app.use("/admin", admin);                // existing endpoints (test email, etc.)
app.use("/admin", adminVenues);          // /admin/venues/*
app.use("/admin", adminCreateShow);      // /admin/shows/*
app.use("/admin", adminUI);              // /admin/ui

app.use("/scan", scanApi);               // JSON: /scan/check, /scan/mark, /scan/stats
app.use("/scan", scanUI);                // UI: GET /scan

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
