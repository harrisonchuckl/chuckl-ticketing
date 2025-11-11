// backend/src/routes/uploads.ts
import { Router } from "express";
import Busboy from "busboy";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const router = Router();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,      // e.g. https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE || ""; // <-- new (https://pub-xxxx.r2.dev)

router.post("/", (req, res) => {
  try {
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 15 * 1024 * 1024 } });

    let resolved = false;
    const done = (status: number, body: any) => {
      if (resolved) return;
      resolved = true;
      res.status(status).json(body);
    };

    bb.on("file", (_name, file, info) => {
      const { filename, mimeType } = info;
      if (!mimeType.startsWith("image/")) {
        file.resume();
        return done(400, { ok: false, error: "Only images are allowed" });
      }

      const key = `posters/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.webp`;

      // optimise → webp
      const transformer = sharp().rotate().webp({ quality: 85 });

      const chunks: Buffer[] = [];
      transformer.on("data", (c) => chunks.push(c));
      transformer.on("error", (err) => done(500, { ok: false, error: err.message }));
      transformer.on("end", async () => {
        try {
          const Body = Buffer.concat(chunks);
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body,
            ContentType: "image/webp",
            // R2 ignores ACLs; public access is controlled at bucket level
          }));

          if (!PUBLIC_BASE) {
            // Safety net: if you forgot to set PUBLIC_BASE, still return API URL (will 403 in browser)
            return done(200, {
              ok: true,
              key,
              url: `${process.env.R2_ENDPOINT?.replace(/\/$/, "")}/${BUCKET}/${key}`,
              note: "Set R2_PUBLIC_BASE to a public URL to render in browser."
            });
          }

          // ✅ public browser URL
          const publicUrl = `${PUBLIC_BASE.replace(/\/$/, "")}/${key}`;
          return done(200, { ok: true, key, url: publicUrl });
        } catch (e: any) {
          return done(500, { ok: false, error: e?.message || "Upload failed" });
        }
      });

      file.pipe(transformer);
    });

    bb.on("error", (err) => done(500, { ok: false, error: err.message }));
    bb.on("finish", () => { /* no-op: we finish in transformer 'end' */ });

    req.pipe(bb);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Unexpected error" });
  }
});

export default router;
