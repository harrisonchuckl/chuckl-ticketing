import { Router } from "express";
import Busboy from "busboy";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { IncomingMessage } from "http";
import path from "path";

// ---- Env (Cloudflare R2 via S3-compatible API) ----
const {
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BASE, // e.g. https://cdn.example.com or leave blank to use R2 URL
} = process.env;

if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  // Don't throw here; allow app to boot, but uploads will fail with clear message
  console.warn("[upload] Missing R2 env vars (uploads will fail until set).");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined,
  credentials: R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    : undefined,
  // R2 needs path-style
  forcePathStyle: true,
});

const router = Router();

// Helpers
function makeKey(originalName = "upload.bin") {
  const ext = path.extname(originalName || "").toLowerCase() || ".bin";
  return `posters/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
}

function publicUrl(key: string) {
  if (R2_PUBLIC_BASE) {
    return `${R2_PUBLIC_BASE.replace(/\/+$/, "")}/${encodeURI(key)}`;
  }
  // default R2 URL (not public unless you've set a public domain / signed url scheme)
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeURI(
    key
  )}`;
}

// POST /api/upload
router.post("/", async (req, res) => {
  // Guard env
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    res
      .status(500)
      .json({ ok: false, error: "R2 storage is not configured on the server." });
    return;
  }

  // Only multipart/form-data
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    res.status(400).json({ ok: false, error: "Expected multipart/form-data" });
    return;
  }

  try {
    const bb = Busboy({ headers: req.headers });
    let done = false;

    // We accept a single file field called "file"
    bb.on("file", async (_fieldname, file, info) => {
      const { filename, mimeType } = info;

      // Collect to Buffer (safe for posters; if you want streaming later, we can add it)
      const chunks: Buffer[] = [];
      let total = 0;
      const MAX = 30 * 1024 * 1024; // 30MB safeguard

      file.on("data", (c: Buffer) => {
        total += c.length;
        if (total > MAX) {
          file.unpipe();
          file.resume();
          bb.emit("error", new Error("File too large"));
          return;
        }
        chunks.push(c);
      });

      file.on("limit", () => {
        bb.emit("error", new Error("File too large"));
      });

      file.on("end", async () => {
        try {
          const body = Buffer.concat(chunks);
          const key = makeKey(filename);
          await s3.send(
            new PutObjectCommand({
              Bucket: R2_BUCKET,
              Key: key,
              Body: body, // Node Buffer (correct type for AWS SDK v3)
              ContentType: mimeType || "application/octet-stream",
              ACL: undefined, // R2 ignores; use public domain if needed
            })
          );

          if (done) return; // ignore if response already sent
          done = true;
          res.json({ ok: true, key, url: publicUrl(key) });
        } catch (e: any) {
          if (done) return;
          done = true;
          res.status(500).json({ ok: false, error: e?.message || "Upload failed" });
        }
      });
    });

    bb.on("error", (e) => {
      if (done) return;
      done = true;
      res.status(400).json({ ok: false, error: e?.message || "Bad upload" });
    });

    bb.on("finish", () => {
      // If client sent no file, Busboy may finish without 'file'
      if (!done) {
        done = true;
        res.status(400).json({ ok: false, error: "No file received" });
      }
    });

    // Explicit pipe with Node type to avoid DOM WritableStream confusion
    (req as IncomingMessage).pipe(bb as unknown as NodeJS.WritableStream);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Upload error" });
  }
});

export default router;
