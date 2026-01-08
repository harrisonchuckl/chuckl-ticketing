import { Router, type Request, type Response } from "express";
import Busboy from "busboy";
import sharp from "sharp";
import { uploadToR2 } from "../lib/upload-r2.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

// Accept both POST /admin/uploads and POST /admin/uploads/poster
router.post(["/", "/poster"], requireAdminOrOrganiser, async (req: Request, res: Response) => {
  try {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    });

    let rawBuffer: Buffer | null = null;
    let filename = "poster";

    const done = new Promise<void>((resolve, reject) => {
      bb.on("file", (_field, file, info) => {
        filename = info?.filename || filename;
        const chunks: Buffer[] = [];
        file.on("data", (d: Buffer) => chunks.push(d));
        file.on("limit", () => reject(new Error("File too large")));
        file.on("end", () => { rawBuffer = Buffer.concat(chunks); });
      });
      bb.on("error", reject);
      bb.on("finish", resolve);
    });

    // @ts-ignore (Busboy stream)
    req.pipe(bb);
    await done;

    if (!rawBuffer) return res.status(400).json({ ok: false, error: "No file received" });

    const processed = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const ts = Date.now();
    const safeBase = (filename || "poster")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase() || "poster";

    const key = `posters/${safeBase}-${ts}.webp`;

    const put = await uploadToR2(key, processed, {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    if (!put.ok) return res.status(500).json({ ok: false, error: "Upload failed" });
    return res.json({ ok: true, url: `${put.publicBase}/${key}` });
  } catch (err) {
    console.error("poster upload failed", err);
    if (err instanceof Error && err.message === "File too large") {
      return res.status(413).json({ ok: false, error: "File too large" });
    }
    return res.status(500).json({ ok: false, error: "Upload error" });
  }
});

export default router;
