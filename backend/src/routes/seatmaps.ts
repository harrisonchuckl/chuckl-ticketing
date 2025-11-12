import { Router } from "express";
import { PrismaClient, SeatStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /seatmaps/:seatMapId/seats
 * Returns seats with useful labels the UI expects.
 */
router.get("/:seatMapId/seats", async (req, res) => {
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
      zoneId: true
    }
  });

  res.json(seats);
});

/**
 * POST /seatmaps/:seatMapId/seats/bulk
 * Body: { seats: { row: string, number: number, label?: string, kind?: string, level?: string, zoneId?: string }[] }
 */
router.post("/:seatMapId/seats/bulk", async (req, res) => {
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
    seatNumber: typeof s.seatNumber === "number" ? s.seatNumber : undefined
  }));

  await prisma.seat.createMany({ data, skipDuplicates: true });
  res.status(201).json({ created: data.length });
});

/**
 * PATCH /seatmaps/seat/:seatId/status
 * Body: { status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" }
 */
router.patch("/seat/:seatId/status", async (req, res) => {
  const { seatId } = req.params;
  const { status } = req.body ?? {};
  if (!Object.values(SeatStatus).includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  const seat = await prisma.seat.update({
    where: { id: seatId },
    data: { status }
  });

  res.json(seat);
});

/**
 * GET /seatmaps/allocations/:allocationId
 * Returns allocation with denormalised seat info expected by CSV/exports
 */
router.get("/allocations/:allocationId", async (req, res) => {
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
              level: true
            }
          }
        }
      }
    }
  });

  if (!allocation) return res.status(404).json({ error: "Not found" });

  const rows = allocation.seats.map((s) => ({
    allocationId: s.allocationId,
    seatId: s.seatId,
    rowLabel: s.seat?.rowLabel ?? null,
    seatNumber: s.seat?.seatNumber ?? null,
    level: s.seat?.level ?? null
  }));

  res.json({ ...allocation, seats: rows });
});

export default router;