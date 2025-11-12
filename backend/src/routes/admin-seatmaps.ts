// backend/src/routes/admin-seatmaps.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { SeatStatus } from '@prisma/client';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();

// GET /admin/venues/:venueId/seatmaps
router.get('/venues/:venueId/seatmaps', requireAdminOrOrganiser, async (req, res) => {
  const { venueId } = req.params;
  const templates = await prisma.seatmapTemplate.findMany({
    where: { venueId },
    include: {
      sections: {
        include: { seats: true },
        orderBy: { sortIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const items = templates.map(t => ({
    id: t.id,
    name: t.name,
    sections: t.sections.map(s => ({
      id: s.id,
      name: s.name,
      level: s.level,
      originX: s.originX,
      originY: s.originY,
      sortIndex: s.sortIndex,
      seatCount: s.seats.length,
    })),
  }));

  res.json({ ok: true, items });
});

// POST /admin/seatmaps
// body: { venueId, name, sections: [{ name, level, sortIndex, originX, originY, seats:[{rowLabel, seatNumber, label, x,y,w,h, tags?}]}] }
router.post('/seatmaps', requireAdminOrOrganiser, async (req, res) => {
  const { venueId, name, sections } = req.body ?? {};
  if (!venueId || !name || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ ok: false, error: 'Missing venueId, name or sections' });
  }

  const template = await prisma.seatmapTemplate.create({
    data: {
      venueId,
      name,
      sections: {
        create: sections.map((sec: any, idx: number) => ({
          name: sec.name || `Section ${idx + 1}`,
          level: sec.level || null,
          sortIndex: typeof sec.sortIndex === 'number' ? sec.sortIndex : idx,
          originX: sec.originX ?? 0,
          originY: sec.originY ?? 0,
          seats: {
            createMany: {
              data: (sec.seats || []).map((st: any) => ({
                rowLabel: String(st.rowLabel ?? ''),
                seatNumber: Number(st.seatNumber ?? 0),
                label: String(st.label ?? `${st.rowLabel}-${st.seatNumber}`),
                x: Number(st.x ?? 0),
                y: Number(st.y ?? 0),
                w: Number(st.w ?? 18),
                h: Number(st.h ?? 18),
                tags: st.tags ?? undefined,
              })),
              skipDuplicates: true,
            },
          },
        })),
      },
    },
  });

  res.json({ ok: true, template: { id: template.id, name: template.name } });
});

// GET /admin/shows/:showId/seatmap
router.get('/shows/:showId/seatmap', requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { id: true, title: true, venueId: true, venue: { select: { id: true, name: true } } },
  });
  if (!show) return res.status(404).json({ ok: false, error: 'Show not found' });

  const seats = await prisma.showSeat.findMany({
    where: { showId },
    orderBy: [{ section: 'asc' }, { rowLabel: 'asc' }, { seatNumber: 'asc' }],
  });

  const map = seats.length ? { hasMap: true } : null;
  res.json({ ok: true, show, map, seats });
});

// POST /admin/shows/:showId/seatmap/attach
// body: { templateId }
router.post('/shows/:showId/seatmap/attach', requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const { templateId } = req.body ?? {};
  if (!templateId) return res.status(400).json({ ok: false, error: 'templateId required' });

  const template = await prisma.seatmapTemplate.findUnique({
    where: { id: templateId },
    include: {
      sections: { include: { seats: true }, orderBy: { sortIndex: 'asc' } },
    },
  });
  if (!template) return res.status(404).json({ ok: false, error: 'Template not found' });

  // Replace any existing seats for the show
  await prisma.$transaction(async (tx) => {
    await tx.showSeat.deleteMany({ where: { showId } });

    for (const section of template.sections) {
      for (const st of section.seats) {
        await tx.showSeat.create({
          data: {
            showId,
            section: section.name,
            rowLabel: st.rowLabel,
            seatNumber: st.seatNumber,
            label: st.label,
            x: st.x,
            y: st.y,
            w: st.w,
            h: st.h,
            status: SeatStatus.AVAILABLE,
          },
        });
      }
    }
  });

  res.json({ ok: true });
});

// POST /admin/shows/:showId/seats/bulk
// body: { seatIds: string[], action: 'AVAILABLE'|'UNAVAILABLE'|'EXTERNAL_ALLOCATE', allocationLabel?: string }
router.post('/shows/:showId/seats/bulk', requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const { seatIds, action, allocationLabel } = req.body ?? {};
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'seatIds required' });
  }

  if (action === 'AVAILABLE') {
    await prisma.showSeat.updateMany({
      where: { id: { in: seatIds }, showId },
      data: { status: SeatStatus.AVAILABLE, allocationRef: null },
    });
  } else if (action === 'UNAVAILABLE') {
    await prisma.showSeat.updateMany({
      where: { id: { in: seatIds }, showId },
      data: { status: SeatStatus.UNAVAILABLE },
    });
  } else if (action === 'EXTERNAL_ALLOCATE') {
    await prisma.showSeat.updateMany({
      where: { id: { in: seatIds }, showId },
      data: { status: SeatStatus.EXTERNAL_ALLOCATED, allocationRef: allocationLabel ?? 'External' },
    });
  } else {
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  }

  res.json({ ok: true });
});

// GET /admin/shows/:showId/allocations/export?format=text|csv
router.get('/shows/:showId/allocations/export', requireAdminOrOrganiser, async (req, res) => {
  const { showId } = req.params;
  const format = (req.query.format as string) || 'text';

  const seats = await prisma.showSeat.findMany({ where: { showId } });

  const summary = {
    total: seats.length,
    byStatus: {
      AVAILABLE: seats.filter(s => s.status === 'AVAILABLE').length,
      UNAVAILABLE: seats.filter(s => s.status === 'UNAVAILABLE').length,
      HELD: seats.filter(s => s.status === 'HELD').length,
      RESERVED: seats.filter(s => s.status === 'RESERVED').length,
      SOLD: seats.filter(s => s.status === 'SOLD').length,
      EXTERNAL_ALLOCATED: seats.filter(s => s.status === 'EXTERNAL_ALLOCATED').length,
    },
  };

  if (format === 'csv') {
    const lines = [
      'label,section,rowLabel,seatNumber,status,allocationRef',
      ...seats.map(s => [
        s.label, s.section ?? '', s.rowLabel, s.seatNumber, s.status, s.allocationRef ?? '',
      ].join(',')),
    ];
    const csv = lines.join('\n');
    res.type('text/csv').send(csv);
    return;
  }

  const txt =
`Allocation Report
Show: ${showId}

Totals
------
Total seats: ${summary.total}
Available: ${summary.byStatus.AVAILABLE}
Unavailable: ${summary.byStatus.UNAVAILABLE}
Held: ${summary.byStatus.HELD}
Reserved: ${summary.byStatus.RESERVED}
Sold: ${summary.byStatus.SOLD}
External Allocated: ${summary.byStatus.EXTERNAL_ALLOCATED}`;

  res.type('text/plain').send(txt);
});

export default router;
