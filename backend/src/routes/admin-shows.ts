import { Router } from "express";
import { OrderStatus, SeatStatus, ShowStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { clampBookingFeePence } from "../lib/booking-fee.js";


const router = Router();

function slugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function dateSlug(d: Date) {
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "long" }).toLowerCase();
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

async function allocateUniqueShowSlug(opts: {
  organiserId: string;
  title: string;
  date: Date;
  excludeShowId: string;
}) {
  const base = slugify(opts.title) || "event";

  const exists = async (candidate: string) => {
    const hit1 = await prisma.show.findFirst({
      where: {
        organiserId: opts.organiserId,
        slug: candidate,
        id: { not: opts.excludeShowId },
      },
      select: { id: true },
    });
    if (hit1) return true;

    const hit2 = await prisma.showSlugHistory.findFirst({
      where: { organiserId: opts.organiserId, slug: candidate },
      select: { id: true },
    });
    return !!hit2;
  };

  let candidate = base;

  if (await exists(candidate)) {
    candidate = `${base}-${dateSlug(opts.date)}`;
  }

  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${dateSlug(opts.date)}-${n++}`;
  }

  return candidate;
}


function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function requireUserId(req: any): string {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function showWhereForRead(req: any, showId: string) {
  if (isOrganiser(req)) {
    return { id: showId, organiserId: requireUserId(req) };
  }
  return { id: showId };
}

function showWhereForList(req: any) {
  if (isOrganiser(req)) {
    return { organiserId: requireUserId(req) };
  }
  return {};
}

async function ensureShowAccessible(req: any, showId: string) {
  return prisma.show.findFirst({
    where: showWhereForRead(req, showId),
    select: { id: true },
  });
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}


function isNonEmptyString(val: string | null | undefined): val is string {
  return typeof val === "string" && val.length > 0;
}


/** Utility: find existing venue (by exact name+city) or create one from text */
async function ensureVenue(
  venueId?: string | null,
  venueText?: string | null
): Promise<string | null> {
  if (venueId) {
    const v = await prisma.venue.findUnique({ where: { id: venueId } });
    if (v) return v.id;
  }
  const name = (venueText || "").trim();
  if (!name) return null;

  // Try a soft match by name
  const existing = await prisma.venue.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.venue.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

function parseLayoutMaybe(layout: unknown): any {
  if (!layout) return null;
  if (typeof layout === "string") {
    try {
      return JSON.parse(layout);
    } catch {
      return null;
    }
  }
  return layout;
}

/**
 * Best-effort seat counter for SeatMap.layout.
 * Supports common shapes:
 * - { seats: [...] }
 * - { zones: [{ seats: [...] }] }
 * - deeply nested objects containing seat-like nodes
 */
function countSellableSeatsFromLayout(layoutRaw: unknown): number {
  const layout = parseLayoutMaybe(layoutRaw);
  if (!layout || typeof layout !== "object") return 0;

  const isBlockedSeat = (s: any) => {
    const status = String(s?.status ?? s?.attrs?.status ?? "").toUpperCase();
    const blocked =
      s?.blocked === true ||
      s?.isBlocked === true ||
      s?.disabled === true ||
      s?.attrs?.blocked === true ||
      s?.attrs?.isBlocked === true ||
      s?.attrs?.disabled === true;

    return blocked || status === "BLOCKED" || status === "DISABLED";
  };

  // Helper to detect a seat-ish node (including Konva JSON objects)
  const looksLikeSeatNode = (node: any) => {
    if (!node || typeof node !== "object") return false;

    const type = String(
      node.type ?? node.kind ?? node.objectType ?? node.className ?? node.name ?? ""
    ).toLowerCase();

    const attrs = node.attrs && typeof node.attrs === "object" ? node.attrs : null;

    // Common direct flags/fields you might store
    const directSeatHints =
      type === "seat" ||
      type.includes("seat") ||
      node.isSeat === true ||
      node.seat === true;

    // Common seat identifiers (direct)
    const directIdHints =
      node.seatId != null ||
      node.ticketTypeId != null ||
      (node.row != null && (node.number != null || node.seatNumber != null));

    // Konva-style identifiers (attrs)
    const konvaHints =
      !!attrs &&
      (attrs.seatId != null ||
        attrs.ticketTypeId != null ||
        attrs.ticketTypeName != null ||
        (attrs.row != null && (attrs.number != null || attrs.seatNumber != null)) ||
        (attrs.label != null && attrs.x != null && attrs.y != null));

    return directSeatHints || directIdHints || konvaHints;
  };

  // 1) Direct seats array
  if (Array.isArray((layout as any).seats)) {
    const seats = (layout as any).seats;
    return seats.filter((s: any) => s && !isBlockedSeat(s)).length;
  }

  // 2) Zones -> seats
  if (Array.isArray((layout as any).zones)) {
    const zones = (layout as any).zones;
    const seats = zones.flatMap((z: any) => (Array.isArray(z?.seats) ? z.seats : []));
    if (seats.length) return seats.filter((s: any) => s && !isBlockedSeat(s)).length;
  }

  // 3) Generic recursive scan
  let count = 0;
  const seen = new Set<string>();

  const seatKey = (node: any) => {
    const attrs = node?.attrs && typeof node.attrs === "object" ? node.attrs : null;
    return String(
      node?.id ??
        node?.seatId ??
        attrs?.id ??
        attrs?.seatId ??
        attrs?.name ??
        ""
    );
  };

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (looksLikeSeatNode(node) && !isBlockedSeat(node)) {
      const key = seatKey(node);
      if (key) {
        if (!seen.has(key)) {
          seen.add(key);
          count += 1;
        }
      } else {
        count += 1;
      }
    }

    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };

  visit(layout);
  return count;
}

/**
 * Derive SOLD/HELD/BLOCKED + total sellable from SeatMap.layout (Konva JSON or similar).
 * Used as a fallback when Seat rows are not persisted.
 */
function seatStatsFromLayout(layoutRaw: unknown): {
  totalSellable: number;
  sold: number;
  held: number;
  blocked: number;
  seatIds: {
    sold: Set<string>;
    held: Set<string>;
    blocked: Set<string>;
    allSellable: Set<string>;
  };
} {
  const layout = parseLayoutMaybe(layoutRaw);
  const empty = {
    totalSellable: 0,
    sold: 0,
    held: 0,
    blocked: 0,
    seatIds: {
      sold: new Set<string>(),
      held: new Set<string>(),
      blocked: new Set<string>(),
      allSellable: new Set<string>(),
    },
  };

  if (!layout || typeof layout !== "object") return empty;

  const statusOf = (node: any) => {
    const raw =
      node?.status ??
      node?.seatStatus ??
      node?.attrs?.status ??
      node?.attrs?.seatStatus ??
      "";
    return String(raw).toUpperCase();
  };

  const isBlocked = (node: any) => {
    const s = statusOf(node);
    const blockedFlags =
      node?.blocked === true ||
      node?.isBlocked === true ||
      node?.disabled === true ||
      node?.attrs?.blocked === true ||
      node?.attrs?.isBlocked === true ||
      node?.attrs?.disabled === true;

    return blockedFlags || s === "BLOCKED" || s === "DISABLED";
  };

  const looksLikeSeat = (node: any) => {
    if (!node || typeof node !== "object") return false;

    const type = String(
      node.type ?? node.kind ?? node.objectType ?? node.className ?? node.name ?? ""
    ).toLowerCase();

    const attrs = node.attrs && typeof node.attrs === "object" ? node.attrs : null;

    const directHints =
      type === "seat" ||
      type.includes("seat") ||
      node.isSeat === true ||
      node.seat === true;

    const idHints =
      node.seatId != null ||
      (attrs && attrs.seatId != null) ||
      node.ticketTypeId != null ||
      (attrs && attrs.ticketTypeId != null) ||
      (node.row != null && (node.number != null || node.seatNumber != null)) ||
      (attrs && attrs.row != null && (attrs.number != null || attrs.seatNumber != null));

    return directHints || idHints;
  };

  const seatKey = (node: any) => {
    const attrs = node?.attrs && typeof node.attrs === "object" ? node.attrs : null;
    return String(
      node?.seatId ??
        attrs?.seatId ??
        node?.id ??
        attrs?.id ??
        attrs?.name ??
        ""
    );
  };

  const seen = new Set<string>();

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (looksLikeSeat(node)) {
      const key = seatKey(node) || "";
      const uniqueKey = key || JSON.stringify(node).slice(0, 80);

      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);

        const s = statusOf(node);
        const blocked = isBlocked(node);

        if (blocked) {
          empty.blocked += 1;
          if (key) empty.seatIds.blocked.add(key);
        } else {
          empty.totalSellable += 1;
          if (key) empty.seatIds.allSellable.add(key);

          // SOLD
          if (
            s === "SOLD" ||
            node?.sold === true ||
            node?.isSold === true ||
            node?.attrs?.sold === true ||
            node?.attrs?.isSold === true
          ) {
            empty.sold += 1;
            if (key) empty.seatIds.sold.add(key);
          }

          // HELD / HOLD / RESERVED
          if (
            s === "HELD" ||
            s === "HOLD" ||
            s === "RESERVED" ||
            node?.held === true ||
            node?.isHeld === true ||
            node?.attrs?.held === true ||
            node?.attrs?.isHeld === true
          ) {
            empty.held += 1;
            if (key) empty.seatIds.held.add(key);
          }
        }
      }
    }

    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };

  visit(layout);
  return empty;
}


/** GET /admin/shows — list */
router.get("/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const items = await prisma.show.findMany({
      where: showWhereForList(req),
      orderBy: [{ date: "asc" }],
   select: {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  date: true,
  eventType: true,
  eventCategory: true,
  status: true,
  publishedAt: true,
     slug: true,
organiser: { select: { id: true, storefrontSlug: true } },
  usesAllocatedSeating: true,
  activeSeatMapId: true,
  venueId: true,
  showCapacity: true,
},

    });

    const showIds = items.map((s) => s.id);

    const venueIds = items
  .map((s) => s.venueId)
  .filter((id): id is string => !!id);

const venues = venueIds.length
  ? await prisma.venue.findMany({
      where: { id: { in: venueIds } },
      select: { id: true, name: true, city: true, capacity: true },
    })
  : [];

const venueById = venues.reduce<Map<string, (typeof venues)[number]>>((acc, v) => {
  acc.set(v.id, v);
  return acc;
}, new Map());


    if (!showIds.length) {
      return res.json({ ok: true, items: [] });
    }

    const activeSeatMapIds = items
      .map((s) => s.activeSeatMapId)
      .filter((id): id is string => !!id);

const [
  seatMaps,
  seatStatusCounts,
  paidTicketTotals,
  allocations,
  ticketCapacityTotals,
  heldSeats,
  soldSeats,
  grossFaceTotals,
] = await Promise.all([
      prisma.seatMap.findMany({
        where: { showId: { in: showIds } },
        select: { id: true, showId: true, layout: true, updatedAt: true },
      }),

      prisma.seat.groupBy({
        by: ["seatMapId", "status"],
        where: { seatMap: { showId: { in: showIds } } },
        _count: { _all: true },
      }),

     // SOLD should mean PAID only (not pending checkouts)
      // SOLD should mean PAID only (use Order.quantity because Ticket rows may not exist)
      prisma.order.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          status: OrderStatus.PAID,
        },
        _sum: { quantity: true },
        _count: { _all: true },
      }),

  // Need allocation seatIds to avoid double-counting holds
      prisma.externalAllocation.findMany({
        where: { showId: { in: showIds } },
        select: {
          id: true,
          showId: true,
          seatMapId: true,
          quantity: true,
          seats: { select: { seatId: true } }, // AllocationSeat rows
        },
      }),

      // Treat TicketType.available as the configured capacity (cap), not "remaining"
      prisma.ticketType.groupBy({
        by: ["showId"],
        where: { showId: { in: showIds }, available: { not: null } },
        _sum: { available: true },
      }),

      // HELD seat IDs for active maps (to de-dupe with allocation seats)
      prisma.seat.findMany({
        where: {
          seatMapId: {
            in: activeSeatMapIds.length ? activeSeatMapIds : ["__none__"],
          },
          status: SeatStatus.HELD,
        },
        select: { seatMapId: true, id: true },
      }),

  // SOLD seat IDs for active maps (to de-dupe holds vs sold)
prisma.seat.findMany({
  where: {
    seatMapId: {
      in: activeSeatMapIds.length ? activeSeatMapIds : ["__none__"],
    },
    status: SeatStatus.SOLD,
  },
  select: { seatMapId: true, id: true },
}),


      // Gross face (optional but nice to have)
      prisma.order.groupBy({
        by: ["showId"],
        where: { showId: { in: showIds }, status: OrderStatus.PAID },
        _sum: { amountPence: true },
      }),
    ]);

    type SeatMapSummary = {
      id: string;
      showId: string;
      layout: unknown;
      updatedAt: Date;
    };

    const seatMapsByShow = seatMaps.reduce<Map<string, SeatMapSummary[]>>(
      (acc, sm) => {
        const list = acc.get(sm.showId) || [];
        list.push(sm);
        acc.set(sm.showId, list);
        return acc;
      },
      new Map()
    );

    const seatStatusByMap = seatStatusCounts.reduce<
      Map<string, { total: number; sold: number; held: number; blocked: number }>
    >((acc, row) => {
      const current = acc.get(row.seatMapId) || {
        total: 0,
        sold: 0,
        held: 0,
        blocked: 0,
      };
      const count = row._count._all ?? 0;

      current.total += count;
      if (row.status === SeatStatus.SOLD) current.sold += count;
      if (row.status === SeatStatus.HELD) current.held += count;

      // Only if BLOCKED exists in your SeatStatus enum (safe-cast so it compiles either way)
      if ((row.status as any) === "BLOCKED") current.blocked += count;

      acc.set(row.seatMapId, current);
      return acc;
    }, new Map());

   const soldByShow = paidTicketTotals.reduce<Map<string, number>>((acc, row) => {
  const sumQty = Number(row._sum.quantity ?? 0);
  const rowCount = Number((row as any)._count?._all ?? 0);

  // If quantity is used, trust it. Otherwise fall back to counting Ticket rows.
  acc.set(row.showId, sumQty > 0 ? sumQty : rowCount);
  return acc;
}, new Map());

    const capacityByShow = ticketCapacityTotals.reduce<Map<string, number>>(
      (acc, row) => {
        acc.set(row.showId, Number(row._sum.available ?? 0));
        return acc;
      },
      new Map()
    );

    const allocationsByShow = allocations.reduce<
      Map<string, Array<(typeof allocations)[number]>>
    >((acc, a) => {
      const list = acc.get(a.showId) || [];
      list.push(a);
      acc.set(a.showId, list);
      return acc;
    }, new Map());

    const heldSeatIdsByMap = heldSeats.reduce<Map<string, Set<string>>>((acc, s) => {
      const set = acc.get(s.seatMapId) || new Set<string>();
      set.add(s.id);
      acc.set(s.seatMapId, set);
      return acc;
    }, new Map());

    const soldSeatIdsByMap = soldSeats.reduce<Map<string, Set<string>>>((acc, s) => {
  const set = acc.get(s.seatMapId) || new Set<string>();
  set.add(s.id);
  acc.set(s.seatMapId, set);
  return acc;
}, new Map());


    const grossByShow = grossFaceTotals.reduce<Map<string, number>>((acc, row) => {
      acc.set(row.showId, Number(row._sum.amountPence ?? 0));
      return acc;
    }, new Map());

    const enriched = items.map((s) => {
      const seatMapsForShow = seatMapsByShow.get(s.id) || [];
      seatMapsForShow.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const activeSeatMap =
        seatMapsForShow.find((m) => m.id === s.activeSeatMapId) ||
        seatMapsForShow[0] ||
        null;

      const seatStats = activeSeatMap ? seatStatusByMap.get(activeSeatMap.id) : null;

      // Sellable seat capacity = total - blocked
      const seatTotalSellable = seatStats
        ? Math.max((seatStats.total ?? 0) - (seatStats.blocked ?? 0), 0)
        : 0;

      const seatSold = seatStats?.sold ?? 0;

      const estCapRaw = activeSeatMap
        ? (activeSeatMap.layout as any)?.estimatedCapacity
        : null;
      const estCapNum = Number(estCapRaw);
      const estCap = Number.isFinite(estCapNum) ? estCapNum : 0;

      const soldFromTickets = soldByShow.get(s.id) ?? 0;

      const allocs = allocationsByShow.get(s.id) || [];

      const isAllocated = !!s.usesAllocatedSeating && !!activeSeatMap?.id;

      let total = 0;
      let sold = 0;
      let hold = 0;

    if (isAllocated) {
  const mapId = activeSeatMap!.id;

  const layoutStats = activeSeatMap ? seatStatsFromLayout(activeSeatMap.layout) : null;

        // Total capacity priority:
  // 1) Seat rows totalSellable (if seats are persisted)
  // 2) Layout-derived totalSellable (if seats aren't persisted)
  // 3) estimatedCapacity in layout
 // Total capacity priority:
// 1) Seat rows totalSellable (if seats are persisted)
// 2) Layout-derived totalSellable (if seats aren't persisted)
// 3) estimatedCapacity in layout
const layoutTotalSellable = layoutStats ? layoutStats.totalSellable : 0;
total = seatTotalSellable || layoutTotalSellable || estCap || 0;

// If a show-level capacity override exists, cap the map capacity to it
const showCap = Number((s as any).showCapacity ?? 0);
if (Number.isFinite(showCap) && showCap > 0) {
  total = Math.min(total, showCap);
}



  // Sold priority:
  // 1) Seat rows SOLD count
  // 2) Layout-derived SOLD count
  // 3) Paid ticket totals fallback
  const layoutSold = layoutStats ? layoutStats.sold : 0;
  sold = seatSold || layoutSold || soldFromTickets;

  // HOLD:
  // Start with HELD seats from DB (if present) + HELD from layout (if present)
  const heldDb = heldSeatIdsByMap.get(mapId) || new Set<string>();
  const heldLayout = layoutStats ? layoutStats.seatIds.held : new Set<string>();
  const holdIds = new Set<string>([...heldDb, ...heldLayout]);

  // Add allocation seatIds (de-dupe)
  let unassigned = 0;
  for (const a of allocs) {
    if (a.seatMapId && a.seatMapId !== mapId) continue;

    const seatIds = (a.seats || []).map((x) => x.seatId).filter(Boolean);
    for (const id of seatIds) holdIds.add(id);

    const qty = Number(a.quantity ?? 0);
    const assigned = seatIds.length;
    unassigned += Math.max(qty - assigned, 0);
  }

  // Remove SOLD seats from holds (avoid “Held” including sold seats)
  const soldDb = soldSeatIdsByMap.get(mapId) || new Set<string>();
  const soldLayout = layoutStats ? layoutStats.seatIds.sold : new Set<string>();
  for (const id of soldDb) holdIds.delete(id);
  for (const id of soldLayout) holdIds.delete(id);

  hold = holdIds.size + unassigned;
} else {
        // General admission:
        // Capacity source of truth: Show.showCapacityInt
        const showCap = Number((s as any).showCapacity ?? 0);
const hasShowCap = Number.isFinite(showCap) && showCap > 0;

// Fallback only if showCapacity isn't set (keeps older shows working)
const cap = hasShowCap ? showCap : (capacityByShow.get(s.id) ?? 0);

        sold = soldFromTickets;

        // Holds are allocation quantities (GA allocations reserve ticket capacity)
        hold = allocs.reduce((sum, a) => sum + Number(a.quantity ?? 0), 0);

        // Total capacity for GA = show capacity (not sum of ticket capacities)
        total = cap;
      }

     return {
  ...s,
  venue: s.venueId ? venueById.get(s.venueId) ?? null : null,
  _alloc: { total, sold, hold },
  _revenue: { grossFace: (grossByShow.get(s.id) ?? 0) / 100 },
};
    });

    res.json({ ok: true, items: enriched });
  } catch (e) {
    console.error("GET /admin/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to load shows" });
  }
});

/** DELETE /admin/shows/:id — only if no tickets sold */
router.delete("/shows/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const showId = String(req.params.id);
    const show = await ensureShowAccessible(req, showId);

    if (!show) return res.status(404).json({ ok: false, error: "Show not found" });

const soldCount = await prisma.order.count({
  where: {
    showId,
    status: OrderStatus.PAID,
  },
});


    if (soldCount > 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot delete events that have sold tickets" });
    }

    await prisma.$transaction([
      prisma.refund.deleteMany({ where: { order: { showId } } }),
      prisma.ticket.deleteMany({ where: { showId } }),
      prisma.order.deleteMany({ where: { showId } }),
      prisma.allocationSeat.deleteMany({ where: { allocation: { showId } } }),
      prisma.seat.deleteMany({ where: { seatMap: { showId } } }),
      prisma.zone.deleteMany({ where: { seatMap: { showId } } }),
      prisma.externalAllocation.deleteMany({ where: { showId } }),
      prisma.seatMap.deleteMany({ where: { showId } }),
      prisma.ticketType.deleteMany({ where: { showId } }),
      prisma.show.delete({ where: { id: showId } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/shows/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to delete show" });
  }
});

/** POST /admin/shows — create (auto-creates venue if needed) */
router.post("/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      title,
      date,
      endDate,
      imageUrl,
      descriptionHtml,
      venueId,
      venueText,
      eventType,
      eventCategory,
      doorsOpenTime,
      ageGuidance,
      endTimeNote,
      accessibility,
      tags,
      additionalImages,
      usesAllocatedSeating,
    } = req.body || {};

    if (!title || !date || !(venueId || venueText) || !descriptionHtml) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const finalVenueId = (await ensureVenue(venueId, venueText)) || undefined;
    const parsedTags = Array.isArray(tags)
      ? tags.map((t: unknown) => asNullableString(t)).filter(isNonEmptyString)
      : [];
    const parsedAdditionalImages = Array.isArray(additionalImages)
      ? additionalImages.map((u: unknown) => asNullableString(u)).filter(isNonEmptyString)
      : [];
    const parsedAccessibility =
      accessibility && typeof accessibility === "object" ? accessibility : null;

    const created = await prisma.show.create({
      data: {
        title: String(title),
        date: new Date(date),

        organiserId: isOrganiser(req) ? requireUserId(req) : null,
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        imageUrl: imageUrl ?? null,
        description: descriptionHtml ?? null,
        venueId: finalVenueId,
        usesAllocatedSeating: !!usesAllocatedSeating,
        status: ShowStatus.DRAFT,
        eventType: asNullableString(eventType),
        eventCategory: asNullableString(eventCategory),
        doorsOpenTime: asNullableString(doorsOpenTime),
        ageGuidance: asNullableString(ageGuidance),
        endTimeNote: asNullableString(endTimeNote),
        accessibility: parsedAccessibility,
        tags: parsedTags,
        additionalImages: parsedAdditionalImages,
      },
      select: { id: true },
    });

    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /admin/shows failed", e);
    res.status(500).json({ ok: false, error: "Failed to create show" });
  }
});

/** GET /admin/shows/:id */

router.get("/shows/:id", requireAdminOrOrganiser, async (req, res) => {

  try {

    const s = await prisma.show.findFirst({

      where: showWhereForRead(req, String(req.params.id)),

      select: {

        id: true,

        title: true,

        description: true,

        imageUrl: true,

        date: true,

        endDate: true,

        eventType: true,

        eventCategory: true,

        doorsOpenTime: true,

        ageGuidance: true,

        endTimeNote: true,

        accessibility: true,

        tags: true,

        additionalImages: true,

        usesAllocatedSeating: true,

        status: true,

        publishedAt: true,

        venueId: true,

        showCapacity: true,

        // ✅ required for /public/<storefront>/<slug>
        slug: true,
        organiser: { select: { id: true, storefrontSlug: true } },

        ticketTypes: {

          select: {

            id: true,

            name: true,

            pricePence: true,

            bookingFeePence: true,

            available: true,

            onSaleAt: true,

            offSaleAt: true,

          },

          orderBy: { createdAt: "asc" },

        },

      },

    });

    if (!s) return res.status(404).json({ ok: false, error: "Not found" });

const venue = s.venueId
  ? await prisma.venue.findUnique({
      where: { id: s.venueId },
      select: { id: true, name: true, city: true, capacity: true },
    })
  : null;

res.json({ ok: true, item: { ...s, venue, venueText: venue?.name ?? "" } });
  } catch (e) {
    console.error("GET /admin/shows/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to load show" });
  }
});

/**
 * POST /admin/shows/:id/ticket-types
 * body: { name, pricePence, available?, onSaleAt?, offSaleAt? }
 */
router.post("/shows/:id/ticket-types", requireAdminOrOrganiser, async (req, res) => {
  try {
    const showId = String(req.params.id);
const { name, pricePence, bookingFeePence, available, onSaleAt, offSaleAt } = req.body || {};

    if (!name || pricePence == null || Number.isNaN(Number(pricePence))) {
      return res.status(400).json({ ok: false, error: "name and pricePence required" });
    }

    const show = await ensureShowAccessible(req, showId);
    if (!show) return res.status(404).json({ ok: false, error: "Show not found" });

    const pricePenceInt = Math.round(Number(pricePence));
if (!Number.isFinite(pricePenceInt) || pricePenceInt < 0) {
  return res.status(400).json({ error: "price_required" });
}

const bookingFeePenceClamped = clampBookingFeePence(pricePenceInt, bookingFeePence);

// Capacity MUST be provided and must be >= 1
const capInt = toIntOrNull(available);
if (capInt === null || capInt < 1) {
  return res.status(400).json({ ok: false, error: "available_required" });
}

const ticketType = await prisma.ticketType.create({
  data: {
    showId: show.id,
    name: String(name),
    pricePence: pricePenceInt,
    bookingFeePence: bookingFeePenceClamped,
    available: capInt,
    onSaleAt: onSaleAt ? new Date(onSaleAt) : null,
    offSaleAt: offSaleAt ? new Date(offSaleAt) : null,
  },
});


    res.json({ ok: true, ticketType });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to create ticket type" });
  }
});

/**
 * PUT /admin/ticket-types/:ttId
 */
router.put("/ticket-types/:ttId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { ttId } = req.params;
const { name, pricePence, bookingFeePence, available, onSaleAt, offSaleAt } = req.body || {};

    const ticketType = await prisma.ticketType.findUnique({
      where: { id: String(ttId) },
select: {
  id: true,
  pricePence: true,
  bookingFeePence: true,
  show: { select: { organiserId: true, id: true } },
},
    });

    if (!ticketType || !ticketType.show) {
      return res.status(404).json({ ok: false, error: "Ticket type not found" });
    }

    if (isOrganiser(req) && ticketType.show.organiserId !== requireUserId(req)) {
      return res.status(404).json({ ok: false, error: "Ticket type not found" });
    }

    const hasPrice = pricePence !== undefined;
const hasFee = bookingFeePence !== undefined;

const effectivePricePence = hasPrice ? Math.round(Number(pricePence)) : ticketType.pricePence;
if (!Number.isFinite(effectivePricePence) || effectivePricePence < 0) {
  return res.status(400).json({ error: "price_required" });
}

const effectiveFeeInput = hasFee ? bookingFeePence : ticketType.bookingFeePence;
const bookingFeePenceClamped = clampBookingFeePence(effectivePricePence, effectiveFeeInput);


    const updated = await prisma.ticketType.update({
      where: { id: String(ttId) },
      data: {
        ...(name !== undefined ? { name: String(name) } : {}),
...(hasPrice ? { pricePence: effectivePricePence } : {}),
...((hasFee || hasPrice) ? { bookingFeePence: bookingFeePenceClamped } : {}),
       ...(available !== undefined
  ? (() => {
      const capInt = toIntOrNull(available);
      if (capInt === null || capInt < 1) {
        throw new Error("available_required");
      }
      return { available: capInt };
    })()
  : {}),
        ...(onSaleAt !== undefined ? { onSaleAt: onSaleAt ? new Date(onSaleAt) : null } : {}),
        ...(offSaleAt !== undefined ? { offSaleAt: offSaleAt ? new Date(offSaleAt) : null } : {}),
      },
    });

    res.json({ ok: true, ticketType: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to update ticket type" });
  }
});

/**
 * DELETE /admin/ticket-types/:ttId
 */
router.delete("/ticket-types/:ttId", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { ttId } = req.params;

    const ticketType = await prisma.ticketType.findUnique({
      where: { id: String(ttId) },
      select: { id: true, show: { select: { organiserId: true, id: true } } },
    });

    if (!ticketType || !ticketType.show) {
      return res.status(404).json({ ok: false, error: "Ticket type not found" });
    }

    if (isOrganiser(req) && ticketType.show.organiserId !== requireUserId(req)) {
      return res.status(404).json({ ok: false, error: "Ticket type not found" });
    }

    await prisma.ticketType.delete({ where: { id: String(ttId) } });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to delete ticket type" });
  }
});

/** PATCH /admin/shows/:id */
router.patch("/shows/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const {
      title,
      date,
      endDate,
      imageUrl,
      descriptionHtml,
      venueId,
      venueText,
      status,
      eventType,
      eventCategory,
      doorsOpenTime,
      ageGuidance,
      endTimeNote,
      accessibility,
      tags,
      additionalImages,
      usesAllocatedSeating,
    } = req.body || {};

    const where = showWhereForRead(req, String(req.params.id));
const existing = await prisma.show.findFirst({
  where,
  select: {
    id: true,
    title: true,
    date: true,
    status: true,
    organiserId: true,
    slug: true,
  },
});
    if (!existing) return res.status(404).json({ ok: false, error: "Not found" });

    const finalVenueId = (await ensureVenue(venueId, venueText)) || undefined;
    const parsedTags = Array.isArray(tags)
      ? tags.map((t: unknown) => asNullableString(t)).filter(isNonEmptyString)
      : undefined;
    const parsedAdditionalImages = Array.isArray(additionalImages)
      ? additionalImages.map((u: unknown) => asNullableString(u)).filter(isNonEmptyString)
      : undefined;
    const parsedAccessibility =
      accessibility && typeof accessibility === "object" ? accessibility : undefined;

    let slugToSet: string | undefined;

const incomingTitle =
  title !== undefined && title !== null ? String(title).trim() : undefined;

const titleChanged =
  incomingTitle !== undefined && incomingTitle !== existing.title;

const nextStatus =
  status !== undefined && status !== null ? String(status) : undefined;

const willBeLive = nextStatus ? nextStatus === "LIVE" : existing.status === ShowStatus.LIVE;
const publishingNow = nextStatus === "LIVE" && existing.status !== ShowStatus.LIVE;

if ((publishingNow || (willBeLive && (titleChanged || !existing.slug))) && existing.organiserId) {
  const organiser = await prisma.user.findUnique({
    where: { id: existing.organiserId },
    select: { storefrontSlug: true },
  });

  if (!organiser?.storefrontSlug) {
    return res.status(400).json({
      ok: false,
      message:
        "Set a unique Storefront name in Account settings before publishing (or renaming) a live show.",
    });
  }

  const desiredTitle = incomingTitle ?? existing.title ?? "event";

  slugToSet = await allocateUniqueShowSlug({
    organiserId: existing.organiserId,
    title: desiredTitle,
    date: existing.date,
    excludeShowId: existing.id,
  });

  if (existing.slug && existing.slug !== slugToSet) {
    await prisma.showSlugHistory
      .create({
        data: {
          organiserId: existing.organiserId,
          showId: existing.id,
          slug: existing.slug,
        },
      })
      .catch(() => {});
  }
}

    
    const updated = await prisma.show.update({
      where: { id: existing.id },
      data: {
        ...(slugToSet ? { slug: slugToSet } : {}),
        ...(title != null ? { title: String(title) } : {}),
        ...(date != null ? { date: new Date(date) } : {}),
        ...(endDate != null ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
        ...(descriptionHtml !== undefined ? { description: descriptionHtml ?? null } : {}),
        ...(venueId !== undefined || venueText !== undefined
          ? { venueId: finalVenueId ?? null }
          : {}),
        ...(usesAllocatedSeating !== undefined
          ? { usesAllocatedSeating: !!usesAllocatedSeating }
          : {}),
        ...(eventType !== undefined ? { eventType: asNullableString(eventType) } : {}),
        ...(eventCategory !== undefined ? { eventCategory: asNullableString(eventCategory) } : {}),
        ...(doorsOpenTime !== undefined ? { doorsOpenTime: asNullableString(doorsOpenTime) } : {}),
        ...(ageGuidance !== undefined ? { ageGuidance: asNullableString(ageGuidance) } : {}),
        ...(endTimeNote !== undefined ? { endTimeNote: asNullableString(endTimeNote) } : {}),
        ...(parsedAccessibility !== undefined ? { accessibility: parsedAccessibility ?? null } : {}),
        ...(parsedTags !== undefined ? { tags: parsedTags } : {}),
        ...(parsedAdditionalImages !== undefined ? { additionalImages: parsedAdditionalImages } : {}),
        ...(status
          ? {
              status: status === "LIVE" ? ShowStatus.LIVE : ShowStatus.DRAFT,
              publishedAt: status === "LIVE" ? new Date() : null,
            }
          : {}),
      },
      select: { id: true },
    });

    res.json({ ok: true, id: updated.id });
  } catch (e) {
    console.error("PATCH /admin/shows/:id failed", e);
    res.status(500).json({ ok: false, error: "Failed to update show" });
  }
});

/** POST /admin/shows/:id/duplicate */
router.post("/shows/:id/duplicate", requireAdminOrOrganiser, async (req, res) => {
  try {
    const src = await prisma.show.findFirst({
      where: showWhereForRead(req, String(req.params.id)),
      select: { title: true, description: true, imageUrl: true, date: true, venueId: true },
    });

    if (!src) return res.status(404).json({ ok: false, error: "Not found" });

    const newShow = await prisma.show.create({
      data: {
        title: (src.title || "") + " (Copy)",
        description: src.description,
        imageUrl: src.imageUrl,
        date: src.date,
        venueId: src.venueId,
        organiserId: isOrganiser(req) ? requireUserId(req) : (req.body.organiserId ?? null),
        status: ShowStatus.DRAFT,
        publishedAt: null,
      },
      select: { id: true },
    });

    res.json({ ok: true, newId: newShow.id });
  } catch (e) {
    console.error("duplicate show failed", e);
    res.status(500).json({ ok: false, error: "Failed to duplicate" });
  }
});

export default router;
