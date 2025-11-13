// backend/src/routes/admin-seatmaps.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../db.js";

const router = Router();

/**
 * GET /admin/seatmaps?showId=...&venueId=...
 * Returns seat maps, including seats/zones/allocations for convenience.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const showId = toUndef(req.query.showId);
    const venueId = toUndef(req.query.venueId);

    const where: {
      showId?: string;
      venueId?: string;
    } = {};

    if (showId) where.showId = showId;
    if (venueId) where.venueId = venueId;

    const maps = await prisma.seatMap.findMany({
      where,
      include: {
        seats: true,
        zones: true,
        allocations: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(maps);
  } catch (e: any) {
    res
      .status(500)
      .json({ error: true, message: e?.message ?? "Failed to load seat maps" });
  }
});

/**
 * POST /admin/seatmaps
 * Body: { showId: string, name: string, venueId?: string | null, isDefault?: boolean, version?: number, layout?: any }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { showId, name, venueId, isDefault, version, layout } = req.body ?? {};

    if (!showId || !name) {
      return res
        .status(400)
        .json({ error: true, message: "showId and name are required" });
    }

    // Loosened typing here so Prisma's JSON type doesn't complain
    const data: any = {
      showId: String(showId),
      name: String(name),
    };

    if (venueId !== undefined) data.venueId = venueId ?? null;
    if (typeof isDefault === "boolean") data.isDefault = isDefault;
    if (typeof version === "number") data.version = version;
    if (layout !== undefined) data.layout = layout;

    const created = await prisma.seatMap.create({ data });
    res.status(201).json(created);
  } catch (e: any) {
    res
      .status(500)
      .json({ error: true, message: e?.message ?? "Failed to create seat map" });
  }
});

/**
 * PATCH /admin/seatmaps/:id/default
 * Body: { isDefault: boolean }
 *
 * Updated so that if you set one map as default, all other maps for that show
 * are automatically unset.
 */
router.patch("/:id/default", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isDefault } = req.body ?? {};

    if (typeof isDefault !== "boolean") {
      return res
        .status(400)
        .json({ error: true, message: "isDefault boolean is required" });
    }

    const map = await prisma.seatMap.findUnique({
      where: { id },
      select: { id: true, showId: true },
    });

    if (!map) {
      return res.status(404).json({ error: true, message: "SeatMap not found" });
    }

    // If we're setting this one as default, unset all others for the same show
    if (isDefault && map.showId) {
      await prisma.seatMap.updateMany({
        where: {
          showId: map.showId,
          NOT: { id: map.id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.seatMap.update({
      where: { id },
      data: { isDefault },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({
      error: true,
      message: e?.message ?? "Failed to update seat map",
    });
  }
});

/**
 * PATCH /admin/seatmaps/:id/layout
 * Body: { layout: any }
 *
 * This is the key endpoint for the future drag & drop editor.
 * The front-end will send a JSON blob describing seat positions and elements,
 * which we store in seatMap.layout.
 */
router.patch("/:id/layout", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { layout } = req.body ?? {};

    // No strict validation for now – we treat this as arbitrary JSON.
    const updated = await prisma.seatMap.update({
      where: { id },
      data: { layout },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({
      error: true,
      message: e?.message ?? "Failed to update seat map layout",
    });
  }
});

/**
 * POST /admin/seatmaps/:id/allocations
 * Body: { source: string, quantity: number, label?: string, externalPlatform?: string, contactEmail?: string }
 */
router.post("/:id/allocations", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { source, quantity, label, externalPlatform, contactEmail } =
      req.body ?? {};

    if (!source || typeof quantity !== "number") {
      return res.status(400).json({
        error: true,
        message: "source and quantity are required",
      });
    }

    // Find showId from the seat map
    const seatMap = await prisma.seatMap.findUnique({ where: { id } });
    if (!seatMap) {
      return res.status(404).json({ error: true, message: "SeatMap not found" });
    }

    const allocation = await prisma.externalAllocation.create({
      data: {
        showId: seatMap.showId,
        seatMapId: id,
        source: String(source),
        quantity,
        label: label ?? null,
        externalPlatform: externalPlatform ?? null,
        contactEmail: contactEmail ?? null,
      },
    });

    res.status(201).json(allocation);
  } catch (e: any) {
    res.status(500).json({
      error: true,
      message: e?.message ?? "Failed to create external allocation",
    });
  }
});

function toUndef(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

export default router;
