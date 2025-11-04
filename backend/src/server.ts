// backend/src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";

import checkout from "./routes/checkout.js";
import webhook from "./routes/webhook.js";
import admin from "./routes/admin.js";
import adminUI from "./routes/admin-ui.js";
import adminVenues from "./routes/admin-venues.js";
import adminCreateShow from "./routes/admin-create-show.js";
import adminTicketTypes from "./routes/admin-ticket-types.js";
import scanApi from "./routes/scan.js";
import scanUI from "./routes/scan-ui.js";

const app = express();
app.set("trust proxy", "loopback");

app.use(cors());
app.use(morgan("tiny"));
app.post("/webhooks/stripe", bodyParser.raw({ type: "application/json" }), webhook);
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/scan", "/admin"], limiter);

app.use("/checkout", checkout);
app.use("/admin", admin);
app.use("/admin", adminVenues);
app.use("/admin", adminCreateShow);
app.use("/admin", adminTicketTypes);
app.use("/admin", adminUI);
app.use("/scan", scanApi);
app.use("/scan", scanUI);

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

export default app;
