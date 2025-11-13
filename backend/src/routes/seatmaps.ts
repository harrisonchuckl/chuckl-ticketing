// backend/src/routes/seatmaps.ts
import { Router } from "express";
import { PrismaClient, SeatStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /seatmaps/:seatMapId/seats
 * Returns seats with useful labels the UI expects.
 */
router.get("/:seatMapId/seats", async (req, res) => {
  try {
    const { seatMapId } = req.params;
    const seats = await prisma.seat.findMany({
      where: { seatMapId },
      orderBy: [{ row: "asc" }, { number: "asc" }],
      select: {
        id: true,
        row: true,
        number: true,
        status: true,
        rowLabel: true,
        seatNumber: true,
        label: true,
        kind: true,
        level: true,
        zoneId: true,
      },
    });

    res.json(seats);
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to load seats", message: e?.message ?? "" });
  }
});

/**
 * POST /seatmaps/:seatMapId/seats/bulk
 * Body: { seats: { row: string, number: number, label?: string, kind?: string, level?: string, zoneId?: string, rowLabel?: string, seatNumber?: number }[] }
 */
router.post("/:seatMapId/seats/bulk", async (req, res) => {
  try {
    const { seatMapId } = req.params;
    const { seats } = req.body ?? {};
    if (!Array.isArray(seats)) {
      return res.status(400).json({ error: "seats[] required" });
    }

    const data = seats.map((s: any) => ({
      seatMapId,
      row: String(s.row),
      number: Number(s.number),
      label: s.label ?? undefined,
      kind: s.kind ?? undefined,
      level: s.level ?? undefined,
      zoneId: s.zoneId ?? undefined,
      rowLabel: s.rowLabel ?? undefined,
      seatNumber:
        typeof s.seatNumber === "number" ? s.seatNumber : undefined,
    }));

    await prisma.seat.createMany({ data, skipDuplicates: true });
    res.status(201).json({ created: data.length });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to create seats", message: e?.message ?? "" });
  }
});

/**
 * PATCH /seatmaps/seat/:seatId/status
 * Body: { status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" }
 */
router.patch("/seat/:seatId/status", async (req, res) => {
  try {
    const { seatId } = req.params;
    const { status } = req.body ?? {};
    if (!Object.values(SeatStatus).includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }

    const seat = await prisma.seat.update({
      where: { id: seatId },
      data: { status },
    });

    res.json(seat);
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to update seat", message: e?.message ?? "" });
  }
});

/**
 * PATCH /seatmaps/seat/:seatId/meta
 * Edit per-seat metadata (kind/type, level, labels, zone).
 *
 * Body (all optional):
 *  {
 *    kind?: string | null,
 *    level?: string | null,
 *    rowLabel?: string | null,
 *    seatNumber?: number | null,
 *    label?: string | null,
 *    zoneId?: string | null
 *  }
 */
router.patch("/seat/:seatId/meta", async (req, res) => {
  try {
    const { seatId } = req.params;
    const { kind, level, rowLabel, seatNumber, label, zoneId } = req.body ?? {};

    const data: any = {};

    if (kind !== undefined) {
      data.kind = kind === null || kind === "" ? null : String(kind);
    }
    if (level !== undefined) {
      data.level = level === null || level === "" ? null : String(level);
    }
    if (rowLabel !== undefined) {
      data.rowLabel =
        rowLabel === null || rowLabel === "" ? null : String(rowLabel);
    }
    if (seatNumber !== undefined) {
      if (seatNumber === null || seatNumber === "") {
        data.seatNumber = null;
      } else {
        const sn = Number(seatNumber);
        if (!Number.isFinite(sn) || sn < 0) {
          return res
            .status(400)
            .json({ error: "seatNumber must be a non-negative number" });
        }
        data.seatNumber = sn;
      }
    }
    if (label !== undefined) {
      data.label = label === null || label === "" ? null : String(label);
    }
    if (zoneId !== undefined) {
      data.zoneId = zoneId === null || zoneId === "" ? null : String(zoneId);
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ error: "No fields provided to update seat meta" });
    }

    const updated = await prisma.seat.update({
      where: { id: seatId },
      data,
    });

    res.json(updated);
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to update seat meta", message: e?.message ?? "" });
  }
});

/**
 * GET /seatmaps/allocations/:allocationId
 * Returns allocation with denormalised seat info expected by CSV/exports
 */
router.get("/allocations/:allocationId", async (req, res) => {
  try {
    const { allocationId } = req.params;
    const allocation = await prisma.externalAllocation.findUnique({
      where: { id: allocationId },
      include: {
        seats: {
          include: {
            seat: {
              select: {
                rowLabel: true,
                seatNumber: true,
                level: true,
              },
            },
          },
        },
      },
    });

    if (!allocation) return res.status(404).json({ error: "Not found" });

    const rows = allocation.seats.map((s) => ({
      allocationId: s.allocationId,
      seatId: s.seatId,
      rowLabel: (s as any).seat?.rowLabel ?? null,
      seatNumber: (s as any).seat?.seatNumber ?? null,
      level: (s as any).seat?.level ?? null,
    }));

    res.json({ ...allocation, seats: rows });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to load allocation", message: e?.message ?? "" });
  }
});

export default router;