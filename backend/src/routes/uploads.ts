// backend/src/routes/uploads.ts
import { Router } from "express";
import Busboy from "busboy";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import crypto from "node:crypto";

const router = Router();

// ---- Env checks ----
const R2_ENDPOINT = process.env.R2_ENDPOINT;        // e.g. https://<accountid>.r2.cloudflarestorage.com
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;            // e.g. chuckl-posters
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;  // e.g. https://pub-xxxxxxxxxxx.r2.dev   (NO trailing slash)

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
        files: 1,            // allow a single poster file
        fields: 0,
        fileSize: 12 * 1024 * 1024, // 12MB
        // NOTE: 'parts' is NOT valid in the type, so we don't set it
      },
    });

    let fileHandled = false;

    // Optional: limit events (not in TS defs, so cast)
    (bb as any).on("filesLimit", () => {
      res.status(413).json({ ok: false, error: "Too many files" });
      req.unpipe(bb);
    });
    (bb as any).on("fieldsLimit", () => {
      res.status(400).json({ ok: false, error: "Too many fields" });
      req.unpipe(bb);
    });

    bb.on("file", async (_name, file, info) => {
      if (fileHandled) {
        // Drain any extra data if client sent >1 file
        file.resume();
        return;
      }
      fileHandled = true;

      const { filename, mimeType } = info;

      // Accept common image types
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
        // Convert to WebP, reasonable defaults
        const processed = await sharp()
          .webp({ quality: 90 })
          .toBuffer({ resolveWithObject: true });

        // Stream -> sharp pipeline -> buffer
        const bufPromise = new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const transform = sharp().webp({ quality: 90 });

          file.on("error", reject);
          transform.on("error", reject);

          transform.on("data", (c) => chunks.push(c as Buffer));
          transform.on("end", () => resolve(Buffer.concat(chunks)));

          file.pipe(transform);
        });

        const body = await bufPromise;

        const key = `posters/${todayPrefix()}/${crypto.randomUUID()}.webp`;

        await s3.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: "image/webp",
            // R2 ignores ACL for public; public access is via bucket setting + public URL
          })
        );

        const url = `${R2_PUBLIC_BASE}/${key}`;
        return res.json({ ok: true, key, url, name: filename });
      } catch (err: any) {
        console.error("[uploads] processing/upload error:", err);
        return res.status(500).json({ ok: false, error: "Image processing/upload failed" });
      }
    });

    bb.on("error", (err) => {
      console.error("[uploads] busboy error:", err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Upload error" });
    });

    bb.on("finish", () => {
      // If no file was sent
      if (!fileHandled && !res.headersSent) {
        res.status(400).json({ ok: false, error: "No file uploaded" });
      }
    });

    // IMPORTANT: pipe the request -> busboy (Readable -> Writable)
    req.pipe(bb);
  } catch (e: any) {
    console.error("[uploads] unexpected:", e);
    res.status(500).json({ ok: false, error: "Unexpected server error" });
  }
});

export default router;
