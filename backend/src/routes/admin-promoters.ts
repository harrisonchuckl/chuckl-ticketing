import { Router } from "express";
import Busboy from "busboy";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { uploadToR2 } from "../lib/upload-r2.js";

const router = Router();

const DOC_TYPES = new Set([
  "PRS_CERTIFICATE",
  "PPL_MUSIC_LICENSING",
  "PUBLIC_LIABILITY_INSURANCE",
  "RISK_ASSESSMENT",
  "TECH_SPEC",
  "MARKETING_SPEC",
  "ACCESSIBILITY_INFO",
  "BRANDING_GUIDELINES",
  "OTHER",
]);
const STATUS_VALUES = new Set(["PROSPECT", "ACTIVE", "DORMANT", "BLOCKED"]);

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function normaliseStatus(value: unknown): "PROSPECT" | "ACTIVE" | "DORMANT" | "BLOCKED" {
  const status = String(value || "").toUpperCase();
  if (STATUS_VALUES.has(status)) {
    return status as "PROSPECT" | "ACTIVE" | "DORMANT" | "BLOCKED";
  }
  return "PROSPECT";
}

async function logActivity(
  promoterId: string,
  type: "CREATED" | "UPDATED" | "CONTACT_ADDED" | "CONTACT_UPDATED" | "CONTACT_REMOVED" | "DOCUMENT_UPLOADED" | "DOCUMENT_UPDATED" | "DOCUMENT_REMOVED",
  metadata: Record<string, unknown> | null,
  actorId: string | null
) {
  await prisma.promoterActivity.create({
    data: {
      promoterId,
      type,
      metadata: metadata || undefined,
      createdByUserId: actorId,
    },
  });
}

/** GET /admin/promoters?q= — search by name/trading name/email */
router.get("/promoters", requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = toNullableString(req.query.q);
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { tradingName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const items = await prisma.promoter.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        tradingName: true,
        email: true,
        phone: true,
        status: true,
        updatedAt: true,
      },
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error("GET /admin/promoters failed", e);
    res.status(500).json({ ok: false, error: "Failed to load promoters" });
  }
});

/** POST /admin/promoters — create a promoter */
router.post("/promoters", requireAdminOrOrganiser, async (req, res) => {
  try {
    const name = toNullableString(req.body?.name);
    if (!name) {
      return res.status(400).json({ ok: false, error: "Name is required" });
    }

    const existing = await prisma.promoter.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Promoter name already exists." });
    }

    const created = await prisma.promoter.create({
      data: {
        name,
        tradingName: toNullableString(req.body?.tradingName),
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        status: normaliseStatus(req.body?.status),
        notes: toNullableString(req.body?.notes),
      },
    });

    await logActivity(created.id, "CREATED", { name: created.name }, req.user?.id || null);

    res.json({ ok: true, promoter: created });
  } catch (e) {
    console.error("POST /admin/promoters failed", e);
    res.status(500).json({ ok: false, error: "Failed to create promoter" });
  }
});

/** GET /admin/promoters/:promoterId — profile */
router.get("/promoters/:promoterId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    res.json({ ok: true, promoter });
  } catch (e) {
    console.error("GET /admin/promoters/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to load promoter" });
  }
});

/** POST /admin/promoters/:promoterId — update overview */
router.post("/promoters/:promoterId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const name = toNullableString(req.body?.name);
    if (!name) {
      return res.status(400).json({ ok: false, error: "Name is required" });
    }

    const existing = await prisma.promoter.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        NOT: { id: promoterId },
      },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Promoter name already exists." });
    }

    const updated = await prisma.promoter.update({
      where: { id: promoterId },
      data: {
        name,
        tradingName: toNullableString(req.body?.tradingName),
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        status: normaliseStatus(req.body?.status),
        notes: toNullableString(req.body?.notes),
      },
    });

    await logActivity(updated.id, "UPDATED", { name: updated.name }, req.user?.id || null);

    res.json({ ok: true, promoter: updated });
  } catch (e) {
    console.error("POST /admin/promoters/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to update promoter" });
  }
});

/** POST /admin/promoters/:promoterId/contacts — add contact */
router.post("/promoters/:promoterId/contacts", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const name = toNullableString(req.body?.name);
    if (!name) {
      return res.status(400).json({ ok: false, error: "Contact name is required" });
    }

    const contact = await prisma.promoterContact.create({
      data: {
        promoterId,
        name,
        role: toNullableString(req.body?.role),
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
        isPrimaryFinance: Boolean(req.body?.isPrimaryFinance),
        isPrimaryMarketing: Boolean(req.body?.isPrimaryMarketing),
      },
    });

    await logActivity(promoterId, "CONTACT_ADDED", { name: contact.name }, req.user?.id || null);

    res.json({ ok: true, contact });
  } catch (e) {
    console.error("POST /admin/promoters/:id/contacts failed", e);
    res.status(500).json({ ok: false, error: "Failed to add contact" });
  }
});

/** PATCH /admin/promoters/:promoterId/contacts/:contactId — update contact */
router.patch("/promoters/:promoterId/contacts/:contactId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const contactId = String(req.params.contactId);
    const existing = await prisma.promoterContact.findFirst({
      where: { id: contactId, promoterId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Contact not found" });
    }

    const updated = await prisma.promoterContact.update({
      where: { id: contactId },
      data: {
        name: toNullableString(req.body?.name) || existing.name,
        role: toNullableString(req.body?.role),
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
        isPrimaryFinance: Boolean(req.body?.isPrimaryFinance),
        isPrimaryMarketing: Boolean(req.body?.isPrimaryMarketing),
      },
    });

    await logActivity(promoterId, "CONTACT_UPDATED", { name: updated.name }, req.user?.id || null);

    res.json({ ok: true, contact: updated });
  } catch (e) {
    console.error("PATCH /admin/promoters/:id/contacts/:contactId failed", e);
    res.status(500).json({ ok: false, error: "Failed to update contact" });
  }
});

/** DELETE /admin/promoters/:promoterId/contacts/:contactId — delete contact */
router.delete("/promoters/:promoterId/contacts/:contactId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const contactId = String(req.params.contactId);
    const deleted = await prisma.promoterContact.deleteMany({
      where: { id: contactId, promoterId },
    });
    if (!deleted.count) {
      return res.status(404).json({ ok: false, error: "Contact not found" });
    }

    await logActivity(promoterId, "CONTACT_REMOVED", { contactId }, req.user?.id || null);

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/promoters/:id/contacts/:contactId failed", e);
    res.status(500).json({ ok: false, error: "Failed to delete contact" });
  }
});

/** POST /admin/promoters/:promoterId/documents — add document metadata */
router.post("/promoters/:promoterId/documents", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const title = toNullableString(req.body?.title);
    const fileUrl = toNullableString(req.body?.fileUrl);
    const type = String(req.body?.type || "OTHER");
    if (!title) {
      return res.status(400).json({ ok: false, error: "Document title is required" });
    }
    if (!fileUrl) {
      return res.status(400).json({ ok: false, error: "File URL is required" });
    }
    if (!DOC_TYPES.has(type)) {
      return res.status(400).json({ ok: false, error: "Document type is invalid" });
    }

    const expiresAt = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : null;
    const now = new Date();
    const status = expiresAt && expiresAt.getTime() < now.getTime() ? "EXPIRED" : "UPLOADED";

    const document = await prisma.promoterDocument.create({
      data: {
        promoterId,
        type,
        title,
        fileUrl,
        fileName: toNullableString(req.body?.fileName),
        mime: toNullableString(req.body?.mime),
        size: req.body?.size != null ? Number(req.body.size) : null,
        expiresAt,
        status,
        uploadedByUserId: req.user?.id || null,
      },
    });

    await logActivity(promoterId, "DOCUMENT_UPLOADED", { title }, req.user?.id || null);

    res.json({ ok: true, document });
  } catch (e) {
    console.error("POST /admin/promoters/:id/documents failed", e);
    res.status(500).json({ ok: false, error: "Failed to add document" });
  }
});

/** DELETE /admin/promoters/:promoterId/documents/:documentId — delete document */
router.delete("/promoters/:promoterId/documents/:documentId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const documentId = String(req.params.documentId);
    const deleted = await prisma.promoterDocument.deleteMany({
      where: { id: documentId, promoterId },
    });
    if (!deleted.count) {
      return res.status(404).json({ ok: false, error: "Document not found" });
    }

    await logActivity(promoterId, "DOCUMENT_REMOVED", { documentId }, req.user?.id || null);

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/promoters/:id/documents/:documentId failed", e);
    res.status(500).json({ ok: false, error: "Failed to delete document" });
  }
});

/** POST /admin/promoters/documents/upload — upload a document file */
router.post("/promoters/documents/upload", requireAdminOrOrganiser, async (req, res) => {
  try {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    });

    let rawBuffer: Buffer | null = null;
    let filename = "document";
    let mimeType = "application/octet-stream";

    const done = new Promise<void>((resolve, reject) => {
      bb.on("file", (_field, file, info) => {
        filename = info?.filename || filename;
        mimeType = info?.mimeType || mimeType;
        const chunks: Buffer[] = [];
        file.on("data", (d: Buffer) => chunks.push(d));
        file.on("limit", () => reject(new Error("File too large")));
        file.on("end", () => {
          rawBuffer = Buffer.concat(chunks);
        });
      });
      bb.on("error", reject);
      bb.on("finish", resolve);
    });

    // @ts-ignore (Busboy stream)
    req.pipe(bb);
    await done;

    if (!rawBuffer) {
      return res.status(400).json({ ok: false, error: "No file received" });
    }

    const safeBase =
      (filename || "document")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9.\-_]/g, "")
        .toLowerCase() || "document";

    const date = new Date();
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const key = `promoters/documents/${yyyy}-${mm}-${dd}/${crypto.randomUUID()}-${safeBase}`;

    const put = await uploadToR2(key, rawBuffer, {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    });

    if (!put.ok) {
      return res.status(500).json({ ok: false, error: "Upload failed" });
    }

    res.json({
      ok: true,
      url: `${put.publicBase}/${key}`,
      name: filename,
      mime: mimeType,
      size: rawBuffer.length,
    });
  } catch (err: any) {
    console.error("promoter document upload failed", err);
    const message = String(err?.message || "");
    if (message.toLowerCase().includes("too large")) {
      return res.status(413).json({ ok: false, error: "File too large" });
    }
    return res.status(500).json({ ok: false, error: "Upload error" });
  }
});

export default router;
