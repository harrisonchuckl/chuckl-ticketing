import { Router } from "express";
import Busboy from "busboy";
import { Upload } from "@aws-sdk/lib-storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import { r2 } from "../lib/r2.js";

const router = Router();

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE || ""; // optional CDN

function jsonError(res: any, code: number, message: string, extra: any = {}) {
  return res.status(code).json({ ok: false, error: message, ...extra });
}

/**
 * POST /api/upload
 * multipart/form-data with one file field named "file"
 * Returns: { ok:true, key, url }
 */
router.post("/", (req, res) => {
  try {
    const bb = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: 20 * 1024 * 1024 }, // 20MB
    });

    let done = false;

    const finish = (fn: () => void) => {
      if (!done) {
        done = true;
        fn();
      }
    };

    bb.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      if (fieldname !== "file") {
        file.resume();
        return finish(() =>
          jsonError(res, 400, `Expected field "file", got "${fieldname}"`)
        );
      }

      const ext = (path.extname(filename) || ".bin").toLowerCase();
      // normalise poster keys into a folder
      const key = `posters/${randomUUID()}${ext}`;

      const uploader = new Upload({
        client: r2,
        params: {
          Bucket: BUCKET,
          Key: key,
          Body: file,
          ContentType: mimeType,
        },
      });

      uploader.done()
        .then(() => {
          const url = PUBLIC_BASE
            ? `${PUBLIC_BASE}/${key}`
            : // fallback to direct R2 URL
              `${process.env.R2_ENDPOINT!.replace("https://", "https://")}/${BUCKET}/${key}`;

          finish(() =>
            res.status(200).json({ ok: true, key, url })
          );
        })
        .catch((err) => {
          console.error("R2 upload error:", err);
          finish(() => jsonError(res, 502, "Upload failed", { detail: String(err) }));
        });
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      finish(() => jsonError(res, 400, "Malformed form-data"));
    });

    bb.on("finish", () => {
      // If no file event fired:
      finish(() => jsonError(res, 400, "No file received"));
    });

    req.pipe(bb);
  } catch (e: any) {
    console.error("Upload route crash:", e);
    return jsonError(res, 500, "Server error", { detail: String(e) });
  }
});

export default router;
