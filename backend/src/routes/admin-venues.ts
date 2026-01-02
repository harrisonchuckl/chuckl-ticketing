import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { lookupPostcode } from "../lib/postcode.js";

const router = Router();

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function requireUserId(req: any): string {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function venueScope(req: any) {
  return isOrganiser(req) ? { ownerId: requireUserId(req) } : {};
}

/** GET /admin/venues?q= — search name/city/county/postcode */
router.get("/venues", requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = (String(req.query.q || "").trim()) || null;

    const scope = venueScope(req);
    const baseWhere = Object.keys(scope).length ? scope : undefined;
    const where = q
      ? {
          AND: [
            ...(baseWhere ? [baseWhere] : []),
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { city: { contains: q, mode: "insensitive" as const } },
                { county: { contains: q, mode: "insensitive" as const } },
                { postcode: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : baseWhere;

    const items = await prisma.venue.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, address: true, city: true, county: true, postcode: true, capacity: true },
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error("GET /admin/venues failed", e);
    res.status(500).json({ ok: false, error: "Failed to load venues" });
  }
});

/** GET /admin/venues/:venueId — fetch a single venue */
router.get("/venues/:venueId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, ...venueScope(req) },
      select: { id: true, name: true, address: true, city: true, county: true, postcode: true, capacity: true },
    });

    if (!venue) {
      return res.status(404).json({ ok: false, error: "Venue not found" });
    }

    res.json({ ok: true, venue });
  } catch (e) {
    console.error("GET /admin/venues/:venueId failed", e);
    res.status(500).json({ ok: false, error: "Failed to load venue" });
  }
});

/** POST /admin/venues — create a venue */
router.post("/venues", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { name, address, city, county, postcode, capacity } = req.body || {};
    if (!name || String(name).trim() === "") {
      return res.status(400).json({ ok: false, error: "Name is required" });
    }

    const normalizedPostcode = postcode ? String(postcode).trim() : "";
    const postcodeLookup = normalizedPostcode ? await lookupPostcode(normalizedPostcode) : null;
    const derivedCity = postcodeLookup?.city ?? null;
    const derivedCounty = postcodeLookup?.county ?? null;

    const created = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : derivedCity,
        county: county ? String(county).trim() : derivedCounty,
        postcode: normalizedPostcode || null,
        capacity: capacity != null ? Number(capacity) : null,
        ...(isOrganiser(req) ? { ownerId: requireUserId(req) } : {}),
      },
      select: { id: true, name: true, address: true, city: true, county: true, postcode: true, capacity: true },
    });

    res.json({ ok: true, venue: created });
  } catch (e) {
    console.error("POST /admin/venues failed", e);
    res.status(500).json({ ok: false, error: "Failed to create venue" });
  }
});

/** PATCH /admin/venues/:venueId — update booking fee */
router.patch("/venues/:venueId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const { bookingFeeBps } = req.body || {};
    const parsed = Number(bookingFeeBps);
    if (!Number.isFinite(parsed)) {
      return res.status(400).json({ ok: false, error: "bookingFeeBps must be a number" });
    }

    const nextBookingFeeBps = Math.max(1000, Math.round(parsed));
    const existing = await prisma.venue.findFirst({
      where: { id: venueId, ...venueScope(req) },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Venue not found" });
    }

    const updated = await prisma.venue.update({
      where: { id: venueId },
      data: { bookingFeeBps: nextBookingFeeBps },
      select: { id: true, bookingFeeBps: true },
    });

    res.json({ ok: true, venue: updated });
  } catch (e) {
    console.error("PATCH /admin/venues/:venueId failed", e);
    res.status(500).json({ ok: false, error: "Failed to update venue" });
  }
});

/** DELETE /admin/venues/:venueId — remove a venue */
router.delete("/venues/:venueId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const venueId = String(req.params.venueId);
    const existing = await prisma.venue.findFirst({
      where: { id: venueId, ...venueScope(req) },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Venue not found" });
    }
    await prisma.venue.delete({ where: { id: venueId } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(409).json({
        ok: false,
        error: "Venue cannot be deleted because it is linked to existing records.",
      });
    }
    console.error("DELETE /admin/venues/:venueId failed", e);
    res.status(500).json({ ok: false, error: "Failed to delete venue" });
  }
});

export default router;
