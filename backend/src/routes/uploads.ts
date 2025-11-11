// backend/src/routes/uploads.ts
import { Router, type Request, type Response } from "express";
import Busboy from "busboy";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

// ---- R2 client (Cloudflare R2 uses S3-compatible API) ----
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,               // e.g. https://<accountid>.r2.cloudflarestorage.com
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE || ""; // e.g. https://pub-xxxxxxxxxxxxxxxxxxxx.r2.dev  (or your custom domain)

// Small helper to send 400/500 nicely
function fail(res: Response, status: number, msg: string) {
  return res.status(status).json({ ok: false, error: msg });
}

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!BUCKET) return fail(res, 500, "R2_BUCKET not set");
    if (!PUBLIC_BASE) return fail(res, 500, "R2_PUBLIC_BASE not set");

    const bb = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: 20 * 1024 * 1024, parts: 3 }, // 20MB
    });

    let gotFile = false;
    let uploadedUrl: string | null = null;

    bb.on("file", (_fieldname, fileStream: NodeJS.ReadableStream, info) => {
      gotFile = true;
      const { filename } = info;

      // Collect the bytes -> Buffer (simple and safe for <= 20MB)
      const chunks: Buffer[] = [];
      fileStream.on("data", (c: Buffer) => chunks.push(c));
      fileStream.on("limit", () => {
        // fileSize limit hit
        fail(res, 400, "File too large");
        // Stop reading more data
        (fileStream as any).pause?.();
      });

      fileStream.once("end", async () => {
        try {
          const inputBuf = Buffer.concat(chunks);
          if (!inputBuf.length) return fail(res, 400, "Empty file");

          // Convert to WebP (quality ~80)
          const webp = await sharp(inputBuf)
            .rotate()        // auto-orient
            .webp({ quality: 80 })
            .toBuffer();

          const yyyy = new Date().toISOString().slice(0, 10);
          const key = `posters/${yyyy}/${randomUUID()}.webp`;

          // Upload to R2
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: webp,
              ContentType: "image/webp",
              ACL: "private", // object can be private—public access comes from PUBLIC_BASE
            })
          );

          // Build public URL using the public base (bucket public access or mapped domain)
          uploadedUrl = `${PUBLIC_BASE.replace(/\/+$/, "")}/${key}`;
        } catch (e: any) {
          console.error("Upload error:", e);
          if (!res.headersSent) fail(res, 500, "Image processing/upload failed");
        }
      });
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      if (!res.headersSent) fail(res, 400, "Malformed form-data");
    });

    bb.on("finish", () => {
      if (res.headersSent) return;
      if (!gotFile) return fail(res, 400, "No file provided");
      if (!uploadedUrl) return fail(res, 500, "Upload did not complete");
      return res.json({ ok: true, url: uploadedUrl });
    });

    // Pipe the request into busboy (cast keeps TS happy with current defs)
    (req as any).pipe(bb as any);
  } catch (e: any) {
    console.error(e);
    return fail(res, 500, "Unexpected error during upload");
  }
});

export default router;
