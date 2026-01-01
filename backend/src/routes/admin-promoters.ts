import { Router } from "express";
import Busboy from "busboy";
import crypto from "node:crypto";
import { Prisma, PromoterDocumentType } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { uploadToR2 } from "../lib/upload-r2.js";

const router = Router();

const DOC_TYPES = new Set<PromoterDocumentType>([
  PromoterDocumentType.PRS_CERTIFICATE,
  PromoterDocumentType.PPL_MUSIC_LICENSING,
  PromoterDocumentType.PUBLIC_LIABILITY_INSURANCE,
  PromoterDocumentType.RISK_ASSESSMENT,
  PromoterDocumentType.TECH_SPEC,
  PromoterDocumentType.MARKETING_SPEC,
  PromoterDocumentType.ACCESSIBILITY_INFO,
  PromoterDocumentType.BRANDING_GUIDELINES,
  PromoterDocumentType.OTHER,
]);
const STATUS_VALUES = new Set(["PROSPECT", "ACTIVE", "DORMANT", "BLOCKED"]);
const MULTIPART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "com.nz",
  "co.nz",
  "org.nz",
  "com.br",
  "com.mx",
  "co.jp",
  "co.kr",
  "co.in",
]);

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

function normaliseHostname(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function mainDomain(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  const tail = parts.slice(-2).join(".");
  const tail3 = parts.slice(-3).join(".");
  if (MULTIPART_TLDS.has(tail) && parts.length >= 3) {
    return tail3;
  }
  if (MULTIPART_TLDS.has(tail3) && parts.length >= 4) {
    return parts.slice(-4).join(".");
  }
  return tail;
}

function parseWebsite(value: unknown): { website: string; domain: string } | null {
  const input = toNullableString(value);
  if (!input) return null;
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    const hostname = normaliseHostname(url.hostname);
    if (!hostname.includes(".")) return null;
    const domain = mainDomain(hostname);
    return { website: url.origin, domain };
  } catch {
    return null;
  }
}

function parseDocType(value: unknown): PromoterDocumentType | null {
  const type = String(value || PromoterDocumentType.OTHER).toUpperCase();
  if (DOC_TYPES.has(type as PromoterDocumentType)) {
    return type as PromoterDocumentType;
  }
  return null;
}

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function requireUserId(req: any): string {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function promoterScope(req: any) {
  if (!isOrganiser(req)) return {};
  const userId = requireUserId(req);
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  };
}

function promoterWhere(req: any, promoterId: string) {
  return { id: promoterId, ...promoterScope(req) };
}

async function ensurePromoterOwner(req: any, promoterId: string) {
  if (!isOrganiser(req)) {
    return prisma.promoter.findUnique({
      where: { id: promoterId },
      select: { id: true },
    });
  }
  return prisma.promoter.findFirst({
    where: { id: promoterId, ownerId: requireUserId(req) },
    select: { id: true },
  });
}

async function getPromoterAccess(req: any, promoterId: string) {
  const promoter = await prisma.promoter.findUnique({
    where: { id: promoterId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      tradingName: true,
      email: true,
      phone: true,
      logoUrl: true,
      website: true,
      status: true,
      notes: true,
    },
  });
  if (!promoter) return null;
  if (!isOrganiser(req)) {
    return { promoter, accessLevel: "owner" as const };
  }
  const userId = requireUserId(req);
  if (promoter.ownerId === userId) {
    return { promoter, accessLevel: "owner" as const };
  }
  const membership = await prisma.promoterMember.findUnique({
    where: { promoterId_userId: { promoterId, userId } },
    select: { id: true },
  });
  if (membership) {
    return { promoter, accessLevel: "member" as const };
  }
  return null;
}

function sanitizePromoter(promoter: any, accessLevel: "owner" | "member") {
  if (accessLevel === "owner") {
    return {
      id: promoter.id,
      name: promoter.name,
      tradingName: promoter.tradingName,
      email: promoter.email,
      phone: promoter.phone,
      logoUrl: promoter.logoUrl,
      status: promoter.status,
      website: promoter.website,
      notes: promoter.notes,
      accessLevel,
    };
  }
  return {
    id: promoter.id,
    name: promoter.name,
    logoUrl: promoter.logoUrl,
    website: promoter.website,
    accessLevel,
  };
}

function showWhereForRead(req: any, showId: string) {
  if (isOrganiser(req)) {
    return { id: showId, organiserId: String(req.user?.id || "") };
  }
  return { id: showId };
}

async function logActivity(
  promoterId: string,
  type: "CREATED" | "UPDATED" | "CONTACT_ADDED" | "CONTACT_UPDATED" | "CONTACT_REMOVED" | "DOCUMENT_UPLOADED" | "DOCUMENT_UPDATED" | "DOCUMENT_REMOVED",
  metadata: Prisma.InputJsonValue | null,
  actorId: string | null
) {
  await prisma.promoterActivity.create({
    data: {
      promoterId,
      type,
      metadata: metadata ?? undefined,
      createdByUserId: actorId,
    },
  });
}

/** GET /admin/promoters?q= — search by name/trading name/email */
router.get("/promoters", requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = toNullableString(req.query.q);
    const scope = promoterScope(req);
    const baseWhere = Object.keys(scope).length ? scope : undefined;
    const where = q
      ? {
          AND: [
            ...(baseWhere ? [baseWhere] : []),
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { tradingName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { website: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : baseWhere;

    const items = await prisma.promoter.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        tradingName: true,
        email: true,
        phone: true,
        logoUrl: true,
        status: true,
        updatedAt: true,
        website: true,
        ownerId: true,
      },
    });

    if (!isOrganiser(req)) {
      return res.json({
        ok: true,
        items: items.map((item) => sanitizePromoter(item, "owner")),
      });
    }

    const userId = requireUserId(req);
    const mapped = items.map((item) => {
      const accessLevel = item.ownerId === userId ? "owner" : "member";
      return sanitizePromoter(item, accessLevel);
    });

    res.json({ ok: true, items: mapped });
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
    const websiteInfo = parseWebsite(req.body?.website);
    if (!websiteInfo) {
      return res.status(400).json({ ok: false, error: "Website is required and must be valid." });
    }

    const tradingName = toNullableString(req.body?.tradingName);
    const matchers = [
      { websiteDomain: websiteInfo.domain },
      { name: { contains: name, mode: "insensitive" as const } },
      { tradingName: { contains: name, mode: "insensitive" as const } },
    ];
    if (tradingName) {
      matchers.push({ name: { contains: tradingName, mode: "insensitive" as const } });
      matchers.push({ tradingName: { contains: tradingName, mode: "insensitive" as const } });
    }
    const existing = await prisma.promoter.findFirst({
      where: { OR: matchers },
      select: {
        id: true,
        ownerId: true,
        name: true,
        tradingName: true,
        email: true,
        phone: true,
        logoUrl: true,
        website: true,
        status: true,
        notes: true,
      },
    });
    if (existing) {
      if (!isOrganiser(req)) {
        return res.json({
          ok: true,
          existing: true,
          promoter: sanitizePromoter(existing, "owner"),
          accessLevel: "owner",
          linkable: false,
        });
      }
      const userId = requireUserId(req);
      if (existing.ownerId === userId) {
        return res.json({
          ok: true,
          existing: true,
          promoter: sanitizePromoter(existing, "owner"),
          accessLevel: "owner",
          linkable: false,
        });
      }
      const membership = await prisma.promoterMember.findUnique({
        where: { promoterId_userId: { promoterId: existing.id, userId } },
        select: { id: true },
      });
      const accessLevel = membership ? "member" : "member";
      return res.json({
        ok: true,
        existing: true,
        promoter: sanitizePromoter(existing, accessLevel),
        accessLevel,
        linkable: !membership,
      });
    }

    const created = await prisma.promoter.create({
      data: {
        name,
        tradingName,
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        logoUrl: toNullableString(req.body?.logoUrl),
        status: normaliseStatus(req.body?.status),
        notes: toNullableString(req.body?.notes),
        website: websiteInfo.website,
        websiteDomain: websiteInfo.domain,
        ...(isOrganiser(req) ? { ownerId: requireUserId(req) } : {}),
      },
    });

    await logActivity(created.id, "CREATED", { name: created.name }, req.user?.id || null);

    res.json({ ok: true, promoter: created });
  } catch (e) {
    console.error("POST /admin/promoters failed", e);
    res.status(500).json({ ok: false, error: "Failed to create promoter" });
  }
});

/** POST /admin/promoters/:promoterId/link — link existing promoter to organiser */
router.post("/promoters/:promoterId/link", requireAdminOrOrganiser, async (req, res) => {
  try {
    if (!isOrganiser(req)) {
      return res.status(403).json({ ok: false, error: "Only organisers can link promoters." });
    }
    const promoterId = String(req.params.promoterId);
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
      select: {
        id: true,
        ownerId: true,
        name: true,
        tradingName: true,
        email: true,
        phone: true,
        logoUrl: true,
        website: true,
        status: true,
        notes: true,
      },
    });
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }
    const userId = requireUserId(req);
    if (promoter.ownerId === userId) {
      return res.json({ ok: true, promoter: sanitizePromoter(promoter, "owner"), accessLevel: "owner" });
    }
    await prisma.promoterMember.upsert({
      where: { promoterId_userId: { promoterId, userId } },
      update: {},
      create: { promoterId, userId },
    });
    res.json({ ok: true, promoter: sanitizePromoter(promoter, "member"), accessLevel: "member" });
  } catch (e) {
    console.error("POST /admin/promoters/:id/link failed", e);
    res.status(500).json({ ok: false, error: "Failed to link promoter" });
  }
});

/** GET /admin/promoters/:promoterId — profile */
router.get("/promoters/:promoterId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const access = await getPromoterAccess(req, promoterId);
    if (!access) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    if (access.accessLevel !== "owner") {
      return res.json({
        ok: true,
        promoter: sanitizePromoter(access.promoter, access.accessLevel),
        accessLevel: access.accessLevel,
      });
    }

    const promoter = await prisma.promoter.findFirst({
      where: promoterWhere(req, promoterId),
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    res.json({ ok: true, promoter, accessLevel: "owner" });
  } catch (e) {
    console.error("GET /admin/promoters/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to load promoter" });
  }
});

/** GET /admin/promoters/:promoterId/shows — linked shows */
router.get("/promoters/:promoterId/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    const showFilter = isOrganiser(req)
      ? { organiserId: String(req.user?.id || "") }
      : {};

    const links = await prisma.showPromoter.findMany({
      where: { promoterId, show: showFilter },
      include: {
        show: {
          select: {
            id: true,
            title: true,
            date: true,
            status: true,
            venue: { select: { name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const shows = links.map((link) => link.show);
    res.json({ ok: true, shows });
  } catch (e) {
    console.error("GET /admin/promoters/:id/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to load promoter shows" });
  }
});

/** POST /admin/promoters/:promoterId/shows — link a show */
router.post("/promoters/:promoterId/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const showId = String(req.body?.showId || "").trim();
    if (!showId) {
      return res.status(400).json({ ok: false, error: "showId is required" });
    }

    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    const show = await prisma.show.findFirst({
      where: showWhereForRead(req, showId),
      select: { id: true },
    });
    if (!show) {
      return res.status(404).json({ ok: false, error: "Show not found" });
    }

    await prisma.showPromoter.upsert({
      where: { showId_promoterId: { showId, promoterId } },
      update: {},
      create: { showId, promoterId },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /admin/promoters/:id/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to link show" });
  }
});

/** DELETE /admin/promoters/:promoterId/shows/:showId — unlink */
router.delete("/promoters/:promoterId/shows/:showId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const promoterId = String(req.params.promoterId);
    const showId = String(req.params.showId);
    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }
    await prisma.showPromoter.deleteMany({
      where: { promoterId, showId },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/promoters/:id/shows/:showId failed", e);
    res.status(500).json({ ok: false, error: "Failed to unlink show" });
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
    const websiteInfo = parseWebsite(req.body?.website);
    if (!websiteInfo) {
      return res.status(400).json({ ok: false, error: "Website is required and must be valid." });
    }

    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }

    const existing = await prisma.promoter.findFirst({
      where: {
        websiteDomain: websiteInfo.domain,
        NOT: { id: promoterId },
      },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Promoter website already exists." });
    }

    const updated = await prisma.promoter.update({
      where: { id: promoterId },
      data: {
        name,
        tradingName: toNullableString(req.body?.tradingName),
        email: toNullableString(req.body?.email),
        phone: toNullableString(req.body?.phone),
        logoUrl: toNullableString(req.body?.logoUrl),
        status: normaliseStatus(req.body?.status),
        notes: toNullableString(req.body?.notes),
        website: websiteInfo.website,
        websiteDomain: websiteInfo.domain,
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

    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
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
    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }
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
    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }
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
    const type = parseDocType(req.body?.type);
    if (!title) {
      return res.status(400).json({ ok: false, error: "Document title is required" });
    }
    if (!fileUrl) {
      return res.status(400).json({ ok: false, error: "File URL is required" });
    }
    if (!type) {
      return res.status(400).json({ ok: false, error: "Document type is invalid" });
    }

    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
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
    const promoter = await ensurePromoterOwner(req, promoterId);
    if (!promoter) {
      return res.status(404).json({ ok: false, error: "Promoter not found" });
    }
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

    const buffer: Buffer = rawBuffer ?? Buffer.alloc(0);
    const put = await uploadToR2(key, buffer, {
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
      size: buffer.length,
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
