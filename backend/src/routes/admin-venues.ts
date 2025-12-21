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
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
        imageUrl: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        ticketContraBps: true,
        bookingFeeBps: true,
        spaces: true,
        seatingMaps: true,
      },
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
        imageUrl: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        ticketContraBps: null,
        bookingFeeBps: null,
        spaces: [],
        seatingMaps: [],
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
        imageUrl: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        ticketContraBps: true,
        bookingFeeBps: true,
        spaces: true,
        seatingMaps: true,
      },
    });

    res.json({ ok: true, venue: created });
  } catch (e) {
    console.error("POST /admin/venues failed", e);
    res.status(500).json({ ok: false, error: "Failed to create venue" });
  }
});

/** PUT /admin/venues/:id — update venue details */
router.put("/venues/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const id = String(req.params.id);

    const percentToBps = (value: unknown, minTen = false) => {
      if (value === undefined || value === null || value === "") return null;
      const num = Number(value);
      if (Number.isNaN(num)) return null;
      const pct = minTen ? Math.max(10, num) : Math.max(0, num);
      return Math.round(pct * 100);
    };

    const sanitiseList = (value: unknown) => {
      if (!Array.isArray(value)) return [] as string[];
      return value
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0)
        .slice(0, 50);
    };

    const spaces = sanitiseList(req.body?.spaces);
    const seatingMaps = sanitiseList(req.body?.seatingMaps);

    const data = {
      name: req.body?.name ? String(req.body.name).trim() : undefined,
      address:
        req.body?.address === undefined ? undefined : req.body.address ? String(req.body.address).trim() : null,
      city: req.body?.city === undefined ? undefined : req.body.city ? String(req.body.city).trim() : null,
      postcode:
        req.body?.postcode === undefined ? undefined : req.body.postcode ? String(req.body.postcode).trim() : null,
      capacity:
        req.body?.capacity === undefined
          ? undefined
          : req.body.capacity === null || req.body.capacity === ""
          ? null
          : Number(req.body.capacity),
      imageUrl:
        req.body?.imageUrl === undefined ? undefined : req.body.imageUrl ? String(req.body.imageUrl).trim() : null,
      contactName:
        req.body?.contactName === undefined
          ? undefined
          : req.body.contactName
          ? String(req.body.contactName).trim()
          : null,
      contactEmail:
        req.body?.contactEmail === undefined
          ? undefined
          : req.body.contactEmail
          ? String(req.body.contactEmail).trim()
          : null,
      contactPhone:
        req.body?.contactPhone === undefined
          ? undefined
          : req.body.contactPhone
          ? String(req.body.contactPhone).trim()
          : null,
      ticketContraBps: percentToBps(req.body?.ticketContraPercent || req.body?.ticketContraBps),
      bookingFeeBps: percentToBps(req.body?.bookingFeePercent || req.body?.bookingFeeBps, true),
      spaces,
      seatingMaps,
    } as const;

    const updated = await prisma.venue.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
        imageUrl: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        ticketContraBps: true,
        bookingFeeBps: true,
        spaces: true,
        seatingMaps: true,
      },
    });

    res.json({ ok: true, venue: updated });
  } catch (e) {
    console.error("PUT /admin/venues/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to update venue" });
  }
});

export default router;