import { Router } from "express";
import { ShowStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/** Utility: find existing venue (by exact name+city) or create one from text */
async function ensureVenue(venueId?: string | null, venueText?: string | null) {
  if (venueId) {
    const v = await prisma.venue.findUnique({ where: { id: venueId } });
    if (v) return v.id;
  }
  const name = (venueText || "").trim();
  if (!name) return null;

  // Try a soft match by name
  const existing = await prisma.venue.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.venue.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

/** GET /admin/shows — list */
router.get("/shows", requireAdminOrOrganiser, async (_req, res) => {
  try {
    const items = await prisma.show.findMany({
      orderBy: [{ date: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        date: true,
        status: true,
        publishedAt: true,
        venue: { select: { id: true, name: true, city: true } },
      },
    });

    const enriched = items.map((s) => ({
      ...s,
      _alloc: { total: 0, sold: 0, hold: 0 },
      _revenue: { grossFace: 0 },
    }));

    res.json({ ok: true, items: enriched });
  } catch (e) {
    console.error("GET /admin/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to load shows" });
  }
});

/** POST /admin/shows — create (auto-creates venue if needed) */
router.post("/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
  title,
  date,
  endDate,
  imageUrl,
  descriptionHtml,
  venueId,
  venueText,
  eventType,
  eventCategory,
  doorsOpenTime,
  ageGuidance,
  endTimeNote,
  accessibility,
  tags,
  additionalImages,
} = req.body || {};

// Keep your existing required rules, but align with Admin UI (type/category/image required)
if (!title || !date || !(venueId || venueText) || !descriptionHtml || !eventType || !eventCategory || !imageUrl) {
  return res.status(400).json({ ok: false, error: "Missing required fields" });
}

const finalVenueId = await ensureVenue(venueId, venueText);

// organiserId: requireAdminOrOrganiser should already have a user context.
// This keeps it safe even if the shape differs.
const organiserId =
  (req as any).user?.id ||
  (req as any).userId ||
  (req as any).auth?.userId ||
  null;

const created = await prisma.show.create({
  data: {
    title: String(title),
    date: new Date(date),
    endDate: endDate ? new Date(endDate) : null,
    imageUrl: String(imageUrl),
    description: String(descriptionHtml),
    venueId: finalVenueId,
    organiserId,

    eventType: String(eventType),
    eventCategory: String(eventCategory),

    doorsOpenTime: doorsOpenTime ? String(doorsOpenTime) : null,
    ageGuidance: ageGuidance ? String(ageGuidance) : null,
    endTimeNote: endTimeNote ? String(endTimeNote) : null,

    accessibility: accessibility ?? null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    additionalImages: Array.isArray(additionalImages) ? additionalImages.map(String) : [],

    status: ShowStatus.DRAFT,
  },
  select: { id: true },
});

    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /admin/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to create show" });
  }
});

/** GET /admin/shows/:id */
router.get("/shows/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const s = await prisma.show.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        date: true,
        status: true,
        publishedAt: true,
        venue: { select: { id: true, name: true, city: true } },
        ticketTypes: {
          select: { id: true, name: true, pricePence: true, available: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!s) return res.status(404).json({ ok: false, error: "Not found" });

    res.json({ ok: true, item: { ...s, venueText: s.venue?.name ?? "" } });
  } catch (e) {
    console.error("GET /admin/shows/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to load show" });
  }
});

/** PATCH /admin/shows/:id */
router.patch("/shows/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { title, date, imageUrl, descriptionHtml, venueId, venueText, status } = req.body || {};
    const finalVenueId = await ensureVenue(venueId, venueText);

    const updated = await prisma.show.update({
      where: { id: String(req.params.id) },
      data: {
        ...(title != null ? { title: String(title) } : {}),
        ...(date != null ? { date: new Date(date) } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
        ...(descriptionHtml !== undefined ? { description: descriptionHtml ?? null } : {}),
        ...(finalVenueId ? { venueId: finalVenueId } : {}),
        ...(status
          ? {
              status: status === "LIVE" ? ShowStatus.LIVE : ShowStatus.DRAFT,
              publishedAt: status === "LIVE" ? new Date() : null,
            }
          : {}),
      },
      select: { id: true },
    });

    res.json({ ok: true, id: updated.id });
  } catch (e) {
    console.error("PATCH /admin/shows/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to update show" });
  }
});

/** POST /admin/shows/:id/duplicate */
router.post("/shows/:id/duplicate", requireAdminOrOrganiser, async (req, res) => {
  try {
    const src = await prisma.show.findUnique({
      where: { id: String(req.params.id) },
      select: { title: true, description: true, imageUrl: true, date: true, venueId: true },
    });
    if (!src) return res.status(404).json({ ok: false, error: "Not found" });

    const newShow = await prisma.show.create({
      data: {
        title: (src.title || "") + " (Copy)",
        description: src.description,
        imageUrl: src.imageUrl,
        date: src.date, // you’ll likely change date in the editor
        venueId: src.venueId,
      },
      select: { id: true },
    });

    res.json({ ok: true, newId: newShow.id });
  } catch (e) {
    console.error("duplicate show failed", e);
    res.status(500).json({ ok: false, error: "Failed to duplicate" });
  }
});

export default router;
