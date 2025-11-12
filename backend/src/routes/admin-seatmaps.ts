// backend/src/routes/admin-seatmaps.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';

const router = Router();
router.use(requireAdminOrOrganiser);

// ---- List seatmap templates for a venue
router.get('/venues/:venueId/seatmaps', async (req, res) => {
  const { venueId } = req.params;
  const items = await prisma.seatmapTemplate.findMany({
    where: { venueId },
    orderBy: { createdAt: 'desc' },
    include: {
      sections: {
        include: { seats: true },
        orderBy: { sortIndex: 'asc' },
      },
    },
  });

  // Slim down payload for UI list
  const out = items.map(t => ({
    id: t.id,
    name: t.name,
    sections: t.sections.map(s => ({
      id: s.id,
      name: s.name,
      level: s.level,
      sortIndex: s.sortIndex,
      originX: s.originX,
      originY: s.originY,
      count: s.seats.length,
    })),
    createdAt: t.createdAt,
  }));

  res.json({ ok: true, items: out });
});

// ---- Create a new seatmap template
// body: { venueId, name, sections: [{name,level,sortIndex,originX,originY,seats:[{rowLabel,seatNumber,label,x,y,w,h,tags?}]}] }
router.post('/seatmaps', async (req, res) => {
  const { venueId, name, sections } = req.body || {};
  if (!venueId || !name || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const created = await prisma.seatmapTemplate.create({
    data: {
      venueId,
      name,
      sections: {
        create: sections.map((sec: any, idx: number) => ({
          name: sec.name ?? `Section ${idx + 1}`,
          level: sec.level ?? null,
          sortIndex: Number(sec.sortIndex ?? idx),
          originX: Number(sec.originX ?? 0),
          originY: Number(sec.originY ?? 0),
          seats: {
            create: (sec.seats ?? []).map((st: any) => ({
              rowLabel: String(st.rowLabel ?? ''),
              seatNumber: Number(st.seatNumber ?? 0),
              label: String(st.label ?? ''),
              x: Number(st.x ?? 0),
              y: Number(st.y ?? 0),
              w: Number(st.w ?? 18),
              h: Number(st.h ?? 18),
              tags: st.tags ?? null,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { seats: true } } },
  });

  res.json({ ok: true, template: created });
});

// ---- Attach a template to a show (clone into ShowSeat)
// body: { templateId }
router.post('/shows/:showId/seatmap/attach', async (req, res) => {
  const { showId } = req.params;
  const { templateId } = req.body || {};
  if (!templateId) return res.status(400).json({ ok: false, error: 'templateId required' });

  const tpl = await prisma.seatmapTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { include: { seats: true }, orderBy: { sortIndex: 'asc' } } },
  });
  if (!tpl) return res.status(404).json({ ok: false, error: 'Template not found' });

  // Replace existing seats for the show
  await prisma.showSeat.deleteMany({ where: { showId } });

  // Flatten seats and create
  const toCreate = tpl.sections.flatMap(sec =>
    sec.seats.map(st => ({
      showId,
      section: sec.name,
      rowLabel: st.rowLabel,
      seatNumber: st.seatNumber,
      label: st.label,
      x: st.x, y: st.y, w: st.w, h: st.h,
      status: 'AVAILABLE' as const,
    }))
  );

  // Batch insert
  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.showSeat.createMany({ data: toCreate.slice(i, i + 500) });
  }

  res.json({ ok: true, count: toCreate.length });
});

// ---- Read show seatmap (map meta + seats)
router.get('/shows/:showId/seatmap', async (req, res) => {
  const { showId } = req.params;

  const seats = await prisma.showSeat.findMany({
    where: { showId },
    orderBy: [{ section: 'asc' }, { rowLabel: 'asc' }, { seatNumber: 'asc' }],
  });

  // Minimal "map" wrapper for UI (you can enrich later)
  const map = { showId, sections: [...new Set(seats.map(s => s.section || ''))] };

  res.json({ ok: true, map, seats });
});

// ---- Bulk operations on seats
// body: { seatIds: string[], action: 'AVAILABLE'|'UNAVAILABLE'|'EXTERNAL_ALLOCATE'|'HELD'|'RESERVED'|'SOLD', allocationLabel?: string }
router.post('/shows/:showId/seats/bulk', async (req, res) => {
  const { showId } = req.params;
  const { seatIds, action, allocationLabel } = req.body || {};

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'seatIds required' });
  }
  const allowed = new Set(['AVAILABLE','UNAVAILABLE','EXTERNAL_ALLOCATE','HELD','RESERVED','SOLD']);
  if (!allowed.has(action)) return res.status(400).json({ ok: false, error: 'invalid action' });

  let data: any = {};
  if (action === 'EXTERNAL_ALLOCATE') {
    data = { status: 'EXTERNAL_ALLOCATED', allocationRef: allocationLabel || 'External' };
  } else {
    data = { status: action, allocationRef: action === 'AVAILABLE' ? null : undefined };
  }

  const r = await prisma.showSeat.updateMany({
    where: { showId, id: { in: seatIds } },
    data,
  });

  res.json({ ok: true, updated: r.count });
});

// ---- Allocation export
router.get('/shows/:showId/allocations/export', async (req, res) => {
  const { showId } = req.params;
  const format = (req.query.format as string) || 'text';

  const seats = await prisma.showSeat.findMany({ where: { showId } });

  // Group by allocationRef/status
  type GroupKey = string;
  const groups = new Map<GroupKey, { label: string; seats: typeof seats }>();
  for (const s of seats) {
    const label =
      s.status === 'EXTERNAL_ALLOCATED' ? (s.allocationRef || 'External') :
      s.status === 'HELD' ? 'Held' :
      s.status === 'RESERVED' ? 'Reserved' :
      s.status === 'SOLD' ? 'Sold' :
      s.status === 'UNAVAILABLE' ? 'Unavailable' :
      'Available';

    const key = label;
    if (!groups.has(key)) groups.set(key, { label, seats: [] as any });
    groups.get(key)!.seats.push(s);
  }

  if (format === 'csv') {
    res.type('text/csv');
    res.write('Group,Section,Row,Seat,Label,Status\n');
    for (const g of groups.values()) {
      for (const s of g.seats) {
        res.write(`"${g.label}",${s.section||''},${s.rowLabel},${s.seatNumber},"${s.label}",${s.status}\n`);
      }
    }
    return res.end();
  }

  // default: text
  res.type('text/plain');
  for (const g of groups.values()) {
    res.write(`=== ${g.label} (${g.seats.length}) ===\n`);
    res.write(g.seats.map(s => `${s.section||''} ${s.rowLabel}-${s.seatNumber}`).join(', ') + '\n\n');
  }
  res.end();
});

export default router;
