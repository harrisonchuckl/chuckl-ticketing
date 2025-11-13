import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const router = Router();

function toUndef(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

/**
 * GET /admin/seatmaps?showId=...&venueId=...
 * Returns an array of SeatMaps (with seats, zones, allocations).
 */
router.get("/", async (req, res) => {
  try {
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

    // Keep behaviour as raw array to avoid breaking existing callers
    res.json(maps);
  } catch (e: any) {
    console.error("GET /admin/seatmaps error", e);
    res.status(500).json({ error: true, message: e?.message ?? "Failed to load seat maps" });
  }
});

/**
 * POST /admin/seatmaps
 * Body: { showId: string, name: string, venueId?: string | null, isDefault?: boolean, version?: number, layout?: any }
 */
router.post("/", async (req, res) => {
  try {
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
  } catch (e: any) {
    console.error("POST /admin/seatmaps error", e);
    res.status(500).json({ error: true, message: e?.message ?? "Failed to create seat map" });
  }
});

/**
 * PATCH /admin/seatmaps/:id/default
 * Body: { isDefault: boolean }
 */
router.patch("/:id/default", async (req, res) => {
  try {
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
  } catch (e: any) {
    console.error("PATCH /admin/seatmaps/:id/default error", e);
    res.status(500).json({ error: true, message: e?.message ?? "Failed to update default seat map" });
  }
});

/**
 * POST /admin/seatmaps/:id/allocations
 * Body: { source: string, quantity: number, label?: string, externalPlatform?: string, contactEmail?: string }
 */
router.post("/:id/allocations", async (req, res) => {
  try {
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
  } catch (e: any) {
    console.error("POST /admin/seatmaps/:id/allocations error", e);
    res.status(500).json({ error: true, message: e?.message ?? "Failed to create allocation" });
  }
});

/**
 * POST /admin/seatmaps/simple-generate
 *
 * Body:
 *  - showId       (required)
 *  - venueId?     (optional)
 *  - name         (e.g. "Standard layout")
 *  - rows         (number, e.g. 10)
 *  - seatsPerRow  (number, e.g. 14)
 *  - levelLabel?  (e.g. "Stalls")
 *
 * Creates:
 *   - a SeatMap row
 *   - one Zone row
 *   - Seat rows for a simple grid layout
 */
router.post("/simple-generate", async (req, res) => {
  try {
    const {
      showId,
      venueId,
      name,
      rows,
      seatsPerRow,
      levelLabel
    } = req.body ?? {};

    if (!showId) {
      return res.status(400).json({ error: true, message: "showId is required" });
    }

    const rowCount = Number(rows ?? 0);
    const perRow = Number(seatsPerRow ?? 0);

    if (!rowCount || !perRow || rowCount < 1 || perRow < 1) {
      return res.status(400).json({
        error: true,
        message: "rows and seatsPerRow must be positive numbers"
      });
    }

    const mapName = name ? String(name) : "Standard layout";
    const level = levelLabel ? String(levelLabel) : "Stalls";

    const seatMapId = randomUUID();
    const zoneId = randomUUID();

    const layoutJson = {
      type: "simple-grid",
      rows: rowCount,
      seatsPerRow: perRow,
      level
    };

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const now = new Date();

    const seatsData = [];
    for (let r = 0; r < rowCount; r++) {
      const rowLetter = r < letters.length ? letters[r] : `R${r + 1}`;
      for (let c = 1; c <= perRow; c++) {
        const label = `${rowLetter}${c}`;
        seatsData.push({
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          seatMapId,
          row: rowLetter,
          number: c,
          rowLabel: rowLetter,
          seatNumber: c,
          label,
          kind: "STANDARD",
          level,
          zoneId
        });
      }
    }

    const seatMap = await prisma.$transaction(async (tx) => {
      await tx.seatMap.create({
        data: {
          id: seatMapId,
          showId: String(showId),
          name: mapName,
          venueId: venueId ?? null,
          isDefault: true,
          version: 1,
          layout: layoutJson as any
        }
      });

      await tx.zone.create({
        data: {
          id: zoneId,
          label: "Main area",
          level,
          seatMapId
        }
      });

      await tx.seat.createMany({
        data: seatsData
      });

      return tx.seatMap.findUnique({
        where: { id: seatMapId },
        include: { seats: true, zones: true }
      });
    });

    res.json({ ok: true, seatMap });
  } catch (e: any) {
    console.error("POST /admin/seatmaps/simple-generate error", e);
    res.status(500).json({ error: true, message: e?.message ?? "Failed to generate seat map" });
  }
});

export default router;
