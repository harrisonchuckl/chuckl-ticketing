import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/** GET /admin/venues?q= — search name/city/postcode */
router.get("/venues", requireAdminOrOrganiser, async (req, res) => {
  try {
    const q = (String(req.query.q || "").trim()) || null;

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { postcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const items = await prisma.venue.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, address: true, city: true, postcode: true, capacity: true },
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error("GET /admin/venues failed", e);
    res.status(500).json({ ok: false, error: "Failed to load venues" });
  }
});

/** POST /admin/venues — create a venue */
router.post("/venues", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { name, address, city, postcode, capacity } = req.body || {};
    if (!name || String(name).trim() === "") {
      return res.status(400).json({ ok: false, error: "Name is required" });
    }

    const created = await prisma.venue.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        postcode: postcode ? String(postcode).trim() : null,
        capacity: capacity != null ? Number(capacity) : null,
      },
      select: { id: true, name: true, address: true, city: true, postcode: true, capacity: true },
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
