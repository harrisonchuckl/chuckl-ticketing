// backend/src/routes/uploads.ts
import { Router } from "express";
import Busboy from "busboy";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import crypto from "node:crypto";

const router = Router();

// ---- Required env ----
const R2_ENDPOINT = process.env.R2_ENDPOINT;        // e.g. https://<accountid>.r2.cloudflarestorage.com
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;            // e.g. chuckl-posters
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;  // e.g. https://pub-xxxxxxxxxxxxxx.r2.dev (NO trailing slash)

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE) {
  console.warn("[uploads] Missing one or more R2 env vars.");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

function todayPrefix() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

router.post("/", async (req, res) => {
  try {
    if (!R2_BUCKET || !R2_PUBLIC_BASE) {
      return res.status(500).json({ ok: false, error: "Storage not configured" });
    }

    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 0,
        fileSize: 12 * 1024 * 1024, // 12MB
      },
    });

    let fileHandled = false;

    // These events exist at runtime but aren't in the TS defs; cast to any.
    (bb as any).on("filesLimit", () => {
      if (!res.headersSent) res.status(413).json({ ok: false, error: "Too many files" });
      (req as any).unpipe(bb as any);
    });
    (bb as any).on("fieldsLimit", () => {
      if (!res.headersSent) res.status(400).json({ ok: false, error: "Too many fields" });
      (req as any).unpipe(bb as any);
    });

    bb.on("file", async (_name, file, info) => {
      if (fileHandled) {
        file.resume(); // drain extras
        return;
      }
      fileHandled = true;

      const { filename, mimeType } = info;

      const allowed = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/heic",
        "image/heif",
      ]);
      if (!allowed.has(mimeType)) {
        file.resume();
        return res.status(400).json({ ok: false, error: `Unsupported type: ${mimeType}` });
      }

      try {
        // Pipe upload -> sharp(webp) -> buffer
        const body: Buffer = await new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          const t = sharp().webp({ quality: 90 });

          file.on("error", reject);
          t.on("error", reject);
          t.on("data", (c) => chunks.push(c as Buffer));
          t.on("end", () => resolve(Buffer.concat(chunks)));

          file.pipe(t);
        });

        const key = `posters/${todayPrefix()}/${crypto.randomUUID()}.webp`;

        await s3.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: "image/webp",
          })
        );

        const url = `${R2_PUBLIC_BASE}/${key}`;
        return res.json({ ok: true, key, url, name: filename });
      } catch (err) {
        console.error("[uploads] processing/upload error:", err);
        if (!res.headersSent) return res.status(500).json({ ok: false, error: "Image processing/upload failed" });
      }
    });

    bb.on("error", (err) => {
      console.error("[uploads] busboy error:", err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Upload error" });
    });

    bb.on("finish", () => {
      if (!fileHandled && !res.headersSent) {
        res.status(400).json({ ok: false, error: "No file uploaded" });
      }
    });

    // Cast Busboy to a WritableStream for TS; runtime is fine.
    (req as any).pipe(bb as any);
  } catch (e) {
    console.error("[uploads] unexpected:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Unexpected server error" });
  }
});

export default router;
