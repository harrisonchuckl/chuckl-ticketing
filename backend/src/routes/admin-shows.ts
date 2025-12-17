import { Router } from "express";
import { ShowStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

function requireUserId(req: any): string {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}


function showWhereForRead(req: any, showId: string) {
  if (isOrganiser(req)) {
return { id: showId, organiserId: requireUserId(req) };
  }
  return { id: showId };
}

function showWhereForList(req: any) {
  if (isOrganiser(req)) {
    return { organiserId: requireUserId(req) };
  }
  return {};
}



function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function isNonEmptyString(val: string | null | undefined): val is string {
  return typeof val === "string" && val.length > 0;
}

/** Utility: find existing venue (by exact name+city) or create one from text */
async function ensureVenue(venueId?: string | null, venueText?: string | null): Promise<string | null> {
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
router.get("/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
const items = await prisma.show.findMany({
  where: showWhereForList(req),
  orderBy: [{ date: "asc" }],
  select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        date: true,
        eventType: true,
        eventCategory: true,
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
    if (!title || !date || !(venueId || venueText) || !descriptionHtml) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

     
    const finalVenueId = (await ensureVenue(venueId, venueText)) || undefined;
    const parsedTags = Array.isArray(tags)
      ? tags.map((t: unknown) => asNullableString(t)).filter(isNonEmptyString)
      : [];
    const parsedAdditionalImages = Array.isArray(additionalImages)
      ? additionalImages.map((u: unknown) => asNullableString(u)).filter(isNonEmptyString)
      : [];
    const parsedAccessibility =
      accessibility && typeof accessibility === "object" ? accessibility : null;

    const created = await prisma.show.create({
      data: {
  title: String(title),
  date: new Date(date),

  // If organiser is creating, force ownership to them.
  // Admin can still create without organiserId (or you can allow passing organiserId later if you want).
organiserId: isOrganiser(req) ? requireUserId(req) : null,
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        imageUrl: imageUrl ?? null,
        description: descriptionHtml ?? null,
        venueId: finalVenueId,
        status: ShowStatus.DRAFT,
        eventType: asNullableString(eventType),
        eventCategory: asNullableString(eventCategory),
        doorsOpenTime: asNullableString(doorsOpenTime),
        ageGuidance: asNullableString(ageGuidance),
        endTimeNote: asNullableString(endTimeNote),
        accessibility: parsedAccessibility,
        tags: parsedTags,
        additionalImages: parsedAdditionalImages,
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
    const s = await prisma.show.findFirst({
  where: showWhereForRead(req, String(req.params.id)),
  select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        date: true,
        endDate: true,
        eventType: true,
        eventCategory: true,
        doorsOpenTime: true,
        ageGuidance: true,
        endTimeNote: true,
        accessibility: true,
        tags: true,
        additionalImages: true,
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
    const {
      title,
      date,
      endDate,
      imageUrl,
      descriptionHtml,
      venueId,
      venueText,
      status,
      eventType,
      eventCategory,
      doorsOpenTime,
      ageGuidance,
      endTimeNote,
      accessibility,
      tags,
      additionalImages,
    } = req.body || {};

        // Ownership check: organisers can only edit their own shows
    const where = showWhereForRead(req, String(req.params.id));
    const existing = await prisma.show.findFirst({ where, select: { id: true } });
    if (!existing) return res.status(404).json({ ok: false, error: "Not found" });

    
    const finalVenueId = (await ensureVenue(venueId, venueText)) || undefined;
    const parsedTags = Array.isArray(tags)
      ? tags.map((t: unknown) => asNullableString(t)).filter(isNonEmptyString)
      : undefined;
    const parsedAdditionalImages = Array.isArray(additionalImages)
      ? additionalImages.map((u: unknown) => asNullableString(u)).filter(isNonEmptyString)
      : undefined;
    const parsedAccessibility =
      accessibility && typeof accessibility === "object" ? accessibility : undefined;

    const updated = await prisma.show.update({
  where: { id: existing.id },
      data: {
        ...(title != null ? { title: String(title) } : {}),
        ...(date != null ? { date: new Date(date) } : {}),
        ...(endDate != null ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
        ...(descriptionHtml !== undefined ? { description: descriptionHtml ?? null } : {}),
...(venueId !== undefined || venueText !== undefined ? { venueId: finalVenueId ?? null } : {}),
        ...(eventType !== undefined ? { eventType: asNullableString(eventType) } : {}),
        ...(eventCategory !== undefined ? { eventCategory: asNullableString(eventCategory) } : {}),
        ...(doorsOpenTime !== undefined ? { doorsOpenTime: asNullableString(doorsOpenTime) } : {}),
        ...(ageGuidance !== undefined ? { ageGuidance: asNullableString(ageGuidance) } : {}),
        ...(endTimeNote !== undefined ? { endTimeNote: asNullableString(endTimeNote) } : {}),
        ...(parsedAccessibility !== undefined ? { accessibility: parsedAccessibility ?? null } : {}),
        ...(parsedTags !== undefined ? { tags: parsedTags } : {}),
        ...(parsedAdditionalImages !== undefined ? { additionalImages: parsedAdditionalImages } : {}),
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
   const src = await prisma.show.findFirst({
  where: showWhereForRead(req, String(req.params.id)),
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

organiserId: isOrganiser(req) ? requireUserId(req) : (req.body.organiserId ?? null),
    status: ShowStatus.DRAFT,
    publishedAt: null,
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
