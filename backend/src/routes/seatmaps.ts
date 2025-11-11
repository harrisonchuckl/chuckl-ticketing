// backend/src/routes/seatmaps.ts
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { prisma } from "../lib/prisma.js"; // adjust if your prisma import differs

const router = Router();

// --------- Templates ----------

// List templates for a venue
router.get("/admin/venues/:venueId/seatmaps", requireAdminOrOrganiser, async (req, res) => {
  const { venueId } = req.params;
  const items = await prisma.seatMapTemplate.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    include: { sections: { include: { seats: true }, orderBy: { sortIndex: "asc" } } },
  });
  res.json({ ok: true, items });
});

// Create a template (expects sections + seats geometry)
router.post("/admin/seatmaps", requireAdminOrOrganiser, async (req, res) => {
  const { venueId, name, sections } = req.body as {
    venueId: string; name: string;
    sections: Array<{
      name: string; level?: string; sortIndex?: number; originX?: number; originY?: number;
      seats: Array<{ rowLabel: string; seatNumber: number; label: string; x: number; y: number; w?: number; h?: number; tags?: string[]; }>;
    }>;
  };

  if (!venueId || !name || !Array.isArray(sections) || !sections.length) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }

  const data = await prisma.seatMapTemplate.create({
    data: {
      venueId, name,
      sections: {
        create: sections.map(s => ({
          name: s.name,
          level: s.level ?? null,
          sortIndex: s.sortIndex ?? 0,
          originX: s.originX ?? 0,
          originY: s.originY ?? 0,
          seats: { create: s.seats.map(seat => ({
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            label: seat.label,
            x: Math.round(seat.x), y: Math.round(seat.y),
            w: seat.w ?? 18, h: seat.h ?? 18,
            tags: seat.tags ?? [],
          })) }
        }))
      }
    },
    include: { sections: { include: { seats: true }, orderBy: { sortIndex: "asc" } } }
  });

  res.json({ ok: true, template: data });
});

// Get template detail
router.get("/admin/seatmaps/:id", requireAdminOrOrganiser, async (req, res) => {
  const { id } = req.params;
  const t = await prisma.seatMapTemplate.findUnique({
    where: { id },
    include: { sections: { include: { seats: true }, orderBy: { sortIndex: "asc" } } }
  });
  if (!t) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, template: t });
});

// --------- Attach template to a show (snapshot) ----------

router.post("/admin/shows/:showId/seatmap/attach", requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const { templateId } = req.body as { templateId: string };

  const template = await prisma.seatMapTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { include: { seats: true }, orderBy: { sortIndex: "asc" } } }
  });
  if (!template) return res.status(404).json({ ok: false, error: "Template not found" });

  // Remove existing map if any
  await prisma.showSeatMap.deleteMany({ where: { showId } });

  const snapshot = {
    templateId: template.id,
    name: template.name,
    sections: template.sections.map(s => ({
      id: s.id, name: s.name, level: s.level, sortIndex: s.sortIndex, originX: s.originX, originY: s.originY,
      seats: s.seats.map(seat => ({
        id: seat.id, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber,
        label: seat.label, x: seat.x, y: seat.y, w: seat.w, h: seat.h, tags: seat.tags
      }))
    }))
  };

  // Create map + seats
  const created = await prisma.showSeatMap.create({
    data: {
      showId,
      seatMapTemplateId: template.id,
      snapshotJson: snapshot as any,
      seats: {
        create: snapshot.sections.flatMap(s =>
          s.seats.map(seat => ({
            templateSeatId: seat.id,
            label: seat.label,
            section: s.name,
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            x: seat.x, y: seat.y, w: seat.w, h: seat.h,
            tags: seat.tags ?? [],
          }))
        )
      }
    }
  });

  res.json({ ok: true, seatMapId: created.id });
});

// Fetch the show seatmap seats
router.get("/admin/shows/:showId/seatmap", requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const map = await prisma.showSeatMap.findUnique({
    where: { showId },
    include: { seats: true }
  });
  if (!map) return res.json({ ok: true, map: null, seats: [] });
  res.json({ ok: true, map, seats: map.seats });
});

// Bulk seat updates: available/unavailable/external allocate/hold
router.post("/admin/shows/:showId/seats/bulk", requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const { seatIds, action, allocationLabel } = req.body as {
    seatIds: string[]; action: "AVAILABLE"|"UNAVAILABLE"|"EXTERNAL_ALLOCATE"|"HOLD";
    allocationLabel?: string;
  };

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ ok: false, error: "No seats specified" });
  }

  const map = await prisma.showSeatMap.findUnique({ where: { showId } });
  if (!map) return res.status(400).json({ ok: false, error: "Show has no seat map" });

  let status: any;
  switch (action) {
    case "AVAILABLE": status = "AVAILABLE"; break;
    case "UNAVAILABLE": status = "UNAVAILABLE"; break;
    case "EXTERNAL_ALLOCATE": status = "EXTERNAL_ALLOCATED"; break;
    case "HOLD": status = "HELD"; break;
    default: return res.status(400).json({ ok: false, error: "Invalid action" });
  }

  const updates = await prisma.showSeat.updateMany({
    where: { id: { in: seatIds }, showSeatMapId: map.id, NOT: { status: "SOLD" } },
    data: { status, allocationRef: (status === "EXTERNAL_ALLOCATED" ? allocationLabel ?? "External" : null) }
  });

  // if allocating externally, capture a batch
  let batchId: string|undefined;
  if (status === "EXTERNAL_ALLOCATED") {
    const created = await prisma.seatAllocationBatch.create({
      data: {
        showId,
        label: allocationLabel ?? "External",
        items: { create: seatIds.map(id => ({ showSeatId: id })) }
      }
    });
    batchId = created.id;
  }

  res.json({ ok: true, updated: updates.count, batchId });
});

// Allocation report (text or CSV)
router.get("/admin/shows/:showId/allocations/export", requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const format = (req.query.format as string) || "text";
  const label = (req.query.label as string) || undefined;

  const seats = await prisma.showSeat.findMany({
    where: {
      map: { showId },
      status: "EXTERNAL_ALLOCATED",
      ...(label ? { allocationRef: label } : {})
    },
    orderBy: [{ section: "asc" }, { rowLabel: "asc" }, { seatNumber: "asc" }]
  });

  if (format === "csv") {
    res.type("text/csv");
    res.send([
      "section,row,seat,label,allocation",
      ...seats.map(s => [s.section, s.rowLabel, s.seatNumber, s.label, s.allocationRef ?? ""].join(","))
    ].join("\n"));
    return;
  }

  // human text block grouped by section/row
  const group = new Map<string, Map<string, number[]>>();
  for (const s of seats) {
    if (!group.has(s.section)) group.set(s.section, new Map());
    const rows = group.get(s.section)!;
    if (!rows.has(s.rowLabel)) rows.set(s.rowLabel, []);
    rows.get(s.rowLabel)!.push(s.seatNumber);
  }
  const lines: string[] = [];
  group.forEach((rows, section) => {
    rows.forEach((nums, row) => {
      nums.sort((a,b)=>a-b);
      // compress contiguous runs
      const parts: string[] = [];
      let start = nums[0], prev = nums[0];
      for (let i=1;i<nums.length;i++){
        const n = nums[i];
        if (n === prev + 1) { prev = n; continue; }
        parts.push(start===prev ? `${start}` : `${start}–${prev}`);
        start = prev = n;
      }
      parts.push(start===prev ? `${start}` : `${start}–${prev}`);
      lines.push(`${section}  Row ${row}: ${parts.join(", ")}`);
    });
  });

  res.type("text/plain").send(lines.join("\n"));
});

export default router;