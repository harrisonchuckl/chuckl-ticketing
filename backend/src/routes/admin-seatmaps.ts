import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /admin/seatmaps?showId=...&venueId=...
 */
router.get("/", async (req, res) => {
  const showId = toUndef(req.query.showId);
  const venueId = toUndef(req.query.venueId);

  const where: any = {};
  if (showId) where.showId = showId;
  if (venueId) where.venueId = venueId;

  const maps = await prisma.seatMap.findMany({
    where,
    include: {
      seats: true,
      zones: true,
      allocations: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(maps);
});

/**
 * POST /admin/seatmaps
 * Body: { showId: string, name: string, venueId?: string | null, isDefault?: boolean, version?: number, layout?: any }
 */
router.post("/", async (req, res) => {
  const { showId, name, venueId, isDefault, version, layout } = req.body ?? {};
  if (!showId || !name) {
    return res.status(400).json({ error: "showId and name are required" });
    }
  const data = {
    showId: String(showId),
    name: String(name),
    venueId: venueId ?? undefined,
    isDefault: typeof isDefault === "boolean" ? isDefault : undefined,
    version: typeof version === "number" ? version : undefined,
    layout: layout ?? undefined
  };

  const created = await prisma.seatMap.create({ data });
  res.status(201).json(created);
});

/**
 * PATCH /admin/seatmaps/:id/default
 * Body: { isDefault: boolean }
 */
router.patch("/:id/default", async (req, res) => {
  const { id } = req.params;
  const { isDefault } = req.body ?? {};

  if (typeof isDefault !== "boolean") {
    return res.status(400).json({ error: "isDefault boolean is required" });
  }

  const updated = await prisma.seatMap.update({
    where: { id },
    data: { isDefault }
  });

  res.json(updated);
});

/**
 * POST /admin/seatmaps/:id/allocations
 * Body: { source: string, quantity: number, label?: string, externalPlatform?: string, contactEmail?: string }
 */
router.post("/:id/allocations", async (req, res) => {
  const { id } = req.params;
  const { source, quantity, label, externalPlatform, contactEmail } = req.body ?? {};
  if (!source || typeof quantity !== "number") {
    return res.status(400).json({ error: "source and quantity are required" });
  }

  // Find a showId from the seatmap
  const seatMap = await prisma.seatMap.findUnique({ where: { id } });
  if (!seatMap) return res.status(404).json({ error: "SeatMap not found" });

  const allocation = await prisma.externalAllocation.create({
    data: {
      showId: seatMap.showId,
      seatMapId: id,
      source: String(source),
      quantity,
      label: label ?? null,
      externalPlatform: externalPlatform ?? null,
      contactEmail: contactEmail ?? null
    }
  });

  res.status(201).json(allocation);
});

function toUndef(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

export default router;