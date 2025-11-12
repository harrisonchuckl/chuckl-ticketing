import { Router } from "express";
import { prisma } from "../utils/prisma";
import { z } from "zod";

const router = Router();

/**
 * Create a new SeatMap for a show or a venue
 */
const CreateSeatMapBody = z.object({
  name: z.string().min(1),
  showId: z.string().optional(),
  venueId: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const data = CreateSeatMapBody.parse(req.body);
    const seatMap = await prisma.seatMap.create({
      data: {
        name: data.name,
        showId: data.showId ?? null,
        venueId: data.venueId ?? null,
        version: data.version ?? null,
        isDefault: data.isDefault ?? false,
      },
    });
    res.status(201).json({ ok: true, seatMap });
  } catch (err) {
    next(err);
  }
});

/**
 * List SeatMaps by show or venue
 */
router.get("/", async (req, res, next) => {
  try {
    const { showId, venueId } = req.query as { showId?: string; venueId?: string };
    const seatMaps = await prisma.seatMap.findMany({
      where: {
        showId: showId ?? undefined,
        venueId: venueId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        seats: true,
        allocations: true,
        zones: true,
      },
    });
    res.json({ ok: true, seatMaps });
  } catch (err) {
    next(err);
  }
});

/**
 * Create an external allocation record for a seatmap (e.g. Ticketsolve/SeeTickets)
 */
const CreateExternalAllocationBody = z.object({
  seatMapId: z.string().min(1),
  showId: z.string().optional(),
  label: z.string().min(1),
  externalPlatform: z.string().optional(), // NEW in schema
});

router.post("/allocations", async (req, res, next) => {
  try {
    const body = CreateExternalAllocationBody.parse(req.body);
    const alloc = await prisma.externalAllocation.create({
      data: {
        seatMapId: body.seatMapId,
        showId: body.showId ?? null,
        label: body.label,
        externalPlatform: body.externalPlatform ?? null,
      },
    });
    res.status(201).json({ ok: true, allocation: alloc });
  } catch (err) {
    next(err);
  }
});

/**
 * Bulk attach seats to an allocation (createMany)
 * NOTE: seatNumber is stored as STRING in the schema => cast any numbers to strings
 */
const BulkAllocationSeatsBody = z.object({
  allocationId: z.string().min(1),
  seats: z.array(
    z.object({
      seatId: z.string().min(1),
      rowLabel: z.string().nullable(),  // nullable is OK
      seatNumber: z.union([z.number(), z.string()]).nullable(), // accept number or string in body
      level: z.string().nullable(),
    })
  ).min(1),
});

router.post("/allocations/:allocationId/seats", async (req, res, next) => {
  try {
    const allocationId = req.params.allocationId;
    const parsed = BulkAllocationSeatsBody.parse({
      allocationId,
      seats: req.body?.seats,
    });

    const data = parsed.seats.map((s) => ({
      allocationId,
      seatId: s.seatId,
      rowLabel: s.rowLabel ?? null,
      seatNumber: s.seatNumber != null ? String(s.seatNumber) : null, // <- cast to string
      level: s.level ?? null,
    }));

    await prisma.allocationSeat.createMany({ data });

    res.status(201).json({ ok: true, count: data.length });
  } catch (err) {
    next(err);
  }
});

/**
 * Get a seatmap by id (with allocations & seats)
 */
router.get("/:id", async (req, res, next) => {
  try {
    const seatMap = await prisma.seatMap.findUnique({
      where: { id: req.params.id },
      include: {
        seats: true,
        allocations: {
          include: {
            seats: true,
          },
        },
        zones: true,
        show: true,
        venue: true,
      },
    });
    if (!seatMap) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, seatMap });
  } catch (err) {
    next(err);
  }
});

/**
 * Update isDefault, version, name
 */
const UpdateSeatMapBody = z.object({
  name: z.string().min(1).optional(),
  version: z.number().int().nonnegative().nullable().optional(),
  isDefault: z.boolean().optional(),
});

router.patch("/:id", async (req, res, next) => {
  try {
    const body = UpdateSeatMapBody.parse(req.body);
    const seatMap = await prisma.seatMap.update({
      where: { id: req.params.id },
      data: {
        name: body.name ?? undefined,
        version: body.version ?? undefined,
        isDefault: body.isDefault ?? undefined,
      },
    });
    res.json({ ok: true, seatMap });
  } catch (err) {
    next(err);
  }
});

export default router;
