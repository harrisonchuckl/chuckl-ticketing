For routes auth can you check your file, this is what I have so far. Please make sure none of the functions we've already built are lost: import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = Router();

// POST /auth/register
router.post("/register", async (req, res) => {
try {
const { email, name, password } = req.body ?? {};
if (!email || !password) {
return res.status(400).json({ error: "email and password are required" });
}

```
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  return res.status(409).json({ error: "email already in use" });
}

const salt = await bcrypt.genSalt(10);
const passwordHash = await bcrypt.hash(String(password), salt);

const user = await prisma.user.create({
  data: {
    email,
    name: name ?? null,
    passwordHash
  },
  select: { id: true, email: true, name: true }
});

return res.status(201).json(user);
```

} catch (err) {
console.error(err);
return res.status(500).json({ error: "internal error" });
}
});

// POST /auth/login
router.post("/login", async (req, res) => {
try {
const { email, password } = req.body ?? {};
if (!email || !password) {
return res.status(400).json({ error: "email and password are required" });
}

```
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !user.passwordHash) {
  return res.status(401).json({ error: "invalid credentials" });
}

const ok = await bcrypt.compare(String(password), user.passwordHash);
if (!ok) {
  return res.status(401).json({ error: "invalid credentials" });
}

const token = jwt.sign(
  { sub: user.id, email: user.email, role: user.role ?? "user" },
  String(process.env.JWT_SECRET || "dev-secret"),
  { expiresIn: "7d" }
);

return res.json({ token });
```

} catch (err) {
console.error(err);
return res.status(500).json({ error: "internal error" });
}
});

export default router;
For admin uploads this is what I have so far: // backend/src/routes/admin-uploads.ts
import { Router, type Request, type Response } from 'express';
import Busboy from 'busboy';
import sharp from 'sharp';
import { uploadToR2 } from '../lib/upload-r2.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

/**

* POST /admin/uploads/poster
* Multipart form-data:
* * file: image file (jpg/png/webp)
* * showId: string (optional; used in the key path)
*
* Returns: { ok: true, url: "https://..." }
  */
  router.post('/uploads/poster', requireAdminOrOrganiser, async (req: Request, res: Response) => {
  try {
  const bb = Busboy({
  headers: req.headers,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }
  });

  let rawBuffer: Buffer | null = null;
  let filename = 'poster';
  let showId: string | null = null;
  let mimeType = 'image/jpeg';

  const done = new Promise<void>((resolve, reject) => {
  bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
  filename = info?.filename || filename;
  mimeType = info?.mimeType || mimeType;
  const chunks: Buffer[] = [];
  file.on('data', (d: Buffer) => chunks.push(d));
  file.on('limit', () => reject(new Error('File too large')));
  file.on('end', () => { rawBuffer = Buffer.concat(chunks); });
  });
  bb.on('field', (field: string, val: string) => {
  if (field === 'showId') showId = val;
  });
  bb.on('error', (e: unknown) => reject(e as Error));
  bb.on('finish', () => resolve());
  });

  // Busboy isn't typed as a Writable, so hush TS (runtime is fine)
  // @ts-ignore
  req.pipe(bb);
  await done;

  if (!rawBuffer) {
  return res.status(400).json({ ok: false, error: 'No file received' });
  }

  // Normalise & compress
  const processed = await sharp(rawBuffer)
  .rotate()
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toBuffer();

  const ts = Date.now();
  const ext = 'webp';
  const safe = (filename || 'poster').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-_]/g, '').toLowerCase();
  const base = safe.replace(/.[a-z0-9]+$/i, '') || 'poster';

  const key = showId
  ? `posters/${showId}/${base}-${ts}.${ext}`
  : `posters/${base}-${ts}.${ext}`;

  const put = await uploadToR2(key, processed, {
  contentType: `image/${ext}`,
  cacheControl: 'public, max-age=31536000, immutable'
  });

  if (!put.ok) {
  return res.status(500).json({ ok: false, error: 'Upload failed' });
  }
  const url = `${put.publicBase}/${key}`;
  return res.json({ ok: true, url });
  } catch (err) {
  console.error('poster upload failed', err);
  return res.status(500).json({ ok: false, error: 'Upload error' });
  }
  });

Server.ts: // backend/src/server.ts
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
import adminUploadsRouter from "./routes/admin-uploads.js";
import uploadsRouter from "./routes/uploads.js";
import imageProxyRouter from "./routes/image-proxy.js";

// ---- Our admin UI + venues API ----
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

// Uploads
app.use("/admin/uploads", adminUploadsRouter);
app.use("/uploads", uploadsRouter);

// Back-compat alias for older UI that used /api/upload
app.use("/api/upload", adminUploadsRouter);

// Image proxy
app.use("/image-proxy", imageProxyRouter);

// IMPORTANT: mount venues router at /admin so its '/venues' -> '/admin/venues'
app.use("/admin", adminVenuesRouter);

// Admin Console SPA shell at /admin/ui/*
app.use("/admin", adminUiRouter);

// 404 handler (JSON)
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;

Give me full files for everything I need from your last response to copy and paste

export default router;
This is my server.ts :
