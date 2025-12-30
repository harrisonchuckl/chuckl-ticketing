import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expires: number; data: any }>();

function getCacheKey(req: any) {
  const base = `${req.path}?${new URLSearchParams(req.query as any).toString()}`;
  const organiserId = req.user?.id ? String(req.user.id) : "";
  const role = String(req.user?.role || "");
  return `${role}:${organiserId}:${base}`;
}

async function withCache<T>(key: string, fn: () => Promise<T>) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as T;
  const data = await fn();
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function organiserFilter(req: any) {
  if (!isOrganiser(req)) return {};
  const organiserId = String(req.user?.id || "");
  if (!organiserId) return {};
  return { show: { organiserId } };
}

function toNumber(value: any) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Number(value) || 0;
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function rangeFromDays(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return { start, end: now };
}

async function aggregateOrders(range: { start: Date; end: Date }, req: any) {
  const orderWhere: Prisma.OrderWhereInput = {
    status: "PAID",
    createdAt: { gte: range.start, lt: range.end },
    ...organiserFilter(req),
  };

  const [orderAgg, ticketAgg, refundAgg] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: {
        amountPence: true,
        paymentFeePence: true,
        platformFeePence: true,
        organiserSharePence: true,
      },
    }),
    prisma.ticket.aggregate({
      where: { order: { is: orderWhere } },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    prisma.refund.aggregate({
      where: {
        createdAt: { gte: range.start, lt: range.end },
        order: { is: organiserFilter(req) },
      },
      _sum: { amountPence: true, amount: true },
      _count: { _all: true },
    }),
  ]);

  const orders = orderAgg._count._all || 0;
  const gross = toNumber(orderAgg._sum.amountPence);
  const paymentFees = toNumber(orderAgg._sum.paymentFeePence);
  const refunds = toNumber(refundAgg._sum.amountPence || refundAgg._sum.amount);
  const refundsCount = refundAgg._count._all || 0;
  const tickets =
    toNumber(ticketAgg._sum.quantity) ||
    (ticketAgg._count._all ? Number(ticketAgg._count._all) : 0);

  const net = gross - refunds - paymentFees;
  const aov = orders ? gross / orders : 0;

  return {
    orders,
    gross,
    net,
    aov,
    paymentFees,
    refunds,
    refundsCount,
    tickets,
    platformFees: toNumber(orderAgg._sum.platformFeePence),
    organiserShare: toNumber(orderAgg._sum.organiserSharePence),
  };
}

async function aggregateCustomers(range: { start: Date; end: Date }, req: any) {
  const orderFilter: Prisma.OrderWhereInput = {
    status: "PAID",
    createdAt: { gte: range.start, lt: range.end },
    email: { not: null },
    ...organiserFilter(req),
  };

  const recent = await prisma.order.findMany({
    where: orderFilter,
    select: { email: true },
    distinct: ["email"],
  });

  const emails = recent.map((r) => r.email).filter(Boolean) as string[];
  if (!emails.length) return { newCustomers: 0, returningCustomers: 0 };

  const firstOrders = await prisma.order.groupBy({
    by: ["email"],
    where: {
      status: "PAID",
      email: { in: emails },
      ...organiserFilter(req),
    },
    _min: { createdAt: true },
  });

  let newCustomers = 0;
  let returningCustomers = 0;

  firstOrders.forEach((row) => {
    if (!row._min.createdAt) return;
    if (row._min.createdAt >= range.start) newCustomers += 1;
    else returningCustomers += 1;
  });

  return { newCustomers, returningCustomers };
}

async function customerSnapshot(req: any) {
  const now = new Date();
  const start7 = new Date(now);
  start7.setDate(now.getDate() - 7);
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 30);
  const start90 = new Date(now);
  start90.setDate(now.getDate() - 90);

  const baseWhere: Prisma.OrderWhereInput = {
    status: "PAID",
    email: { not: null },
    ...organiserFilter(req),
  };

  const [last7, last30, last90] = await Promise.all([
    aggregateCustomers({ start: start7, end: now }, req),
    aggregateCustomers({ start: start30, end: now }, req),
    prisma.order.groupBy({
      by: ["email"],
      where: { ...baseWhere, createdAt: { gte: start90, lt: now } },
      _count: { _all: true },
    }),
  ]);

  const repeatCount = last90.filter((row) => (row._count._all || 0) > 1).length;
  const repeatRate = last90.length ? (repeatCount / last90.length) * 100 : 0;

  const lapsed = await prisma.order.groupBy({
    by: ["email"],
    where: baseWhere,
    _max: { createdAt: true },
  });

  const lapsedCount = lapsed.filter((row) => row._max.createdAt && row._max.createdAt < start90)
    .length;

  const topRangeStart = start30;
  const recentOrders = await prisma.order.findMany({
    where: { ...baseWhere, createdAt: { gte: topRangeStart, lt: now } },
    select: {
      email: true,
      buyerPostcode: true,
      show: { select: { venue: { select: { name: true } } } },
    },
    take: 2000,
  });

  const townMap = new Map<string, Set<string>>();
  const venueMap = new Map<string, Set<string>>();

  recentOrders.forEach((order) => {
    const email = order.email || "";
    if (!email) return;

    const town = order.buyerPostcode ? order.buyerPostcode.trim() : "";
    if (town) {
      if (!townMap.has(town)) townMap.set(town, new Set());
      townMap.get(town)?.add(email);
    }

    const venueName = order.show?.venue?.name || "";
    if (venueName) {
      if (!venueMap.has(venueName)) venueMap.set(venueName, new Set());
      venueMap.get(venueName)?.add(email);
    }
  });

  const topTowns = Array.from(townMap.entries())
    .map(([town, emails]) => ({ town, customers: emails.size }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 5);

  const topVenues = Array.from(venueMap.entries())
    .map(([venue, emails]) => ({ venue, customers: emails.size }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 5);

  return {
    last7,
    last30,
    repeatRate,
    lapsedCount,
    topTowns,
    topVenues,
  };
}

router.get("/dashboard/summary", requireAdminOrOrganiser, async (req, res) => {
  const key = getCacheKey(req);
  try {
    const data = await withCache(key, async () => {
      const rangeParam = String(req.query.range || "7d");
      const days = Math.max(1, Number(rangeParam.replace(/[^0-9]/g, "")) || 7);

      const currentRange = rangeFromDays(days);
      const prevRange = {
        start: new Date(currentRange.start),
        end: currentRange.start,
      };
      prevRange.start.setDate(prevRange.start.getDate() - days);

      const [current, previous, customerData] = await Promise.all([
        aggregateOrders(currentRange, req),
        aggregateOrders(prevRange, req),
        customerSnapshot(req),
      ]);

      const { newCustomers, returningCustomers } = await aggregateCustomers(currentRange, req);
      const prevCustomers = await aggregateCustomers(prevRange, req);

      const comparisons = {
        tickets: pctChange(current.tickets, previous.tickets),
        orders: pctChange(current.orders, previous.orders),
        gross: pctChange(current.gross, previous.gross),
        net: pctChange(current.net, previous.net),
        aov: pctChange(current.aov, previous.aov),
        newCustomers: pctChange(newCustomers, prevCustomers.newCustomers),
        returningCustomers: pctChange(returningCustomers, prevCustomers.returningCustomers),
        refunds: pctChange(current.refunds, previous.refunds),
      };

      return {
        ok: true,
        range: { days },
        current: {
          tickets: current.tickets,
          orders: current.orders,
          gross: current.gross,
          net: current.net,
          aov: current.aov,
          refunds: current.refunds,
          refundsCount: current.refundsCount,
          newCustomers,
          returningCustomers,
        },
        comparisons,
        customerSnapshot: customerData,
      };
    });

    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("dashboard/summary failed", err);
    res.status(500).json({ ok: false, error: "Failed to load dashboard summary" });
  }
});

router.get("/dashboard/booking-fee-kickback", requireAdminOrOrganiser, async (req, res) => {
  const key = getCacheKey(req);
  try {
    const data = await withCache(key, async () => {
      const now = new Date();
      const start7 = new Date(now);
      start7.setDate(now.getDate() - 7);
      const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const start52w = new Date(now);
      start52w.setDate(now.getDate() - 364);

      async function sumKickback(start: Date) {
        const agg = await prisma.order.aggregate({
          where: {
            status: "PAID",
            createdAt: { gte: start, lt: now },
            ...organiserFilter(req),
          },
          _sum: { platformFeePence: true, organiserSharePence: true },
        });

        const platform = toNumber(agg._sum.platformFeePence);
        const organiserShare = toNumber(agg._sum.organiserSharePence);
        return Math.max(0, platform - organiserShare);
      }

      const [last7, mtd, last52w] = await Promise.all([
        sumKickback(start7),
        sumKickback(startMonth),
        sumKickback(start52w),
      ]);

      return { ok: true, last7, mtd, last52w };
    });

    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("dashboard/booking-fee-kickback failed", err);
    res.status(500).json({ ok: false, error: "Failed to load booking fee kickback" });
  }
});

router.get("/dashboard/timeseries", requireAdminOrOrganiser, async (req, res) => {
  const key = getCacheKey(req);
  try {
    const data = await withCache(key, async () => {
      const metric = String(req.query.metric || "tickets");
      const days = Math.max(1, Number(req.query.days) || 30);
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - days);

      const organiserId = isOrganiser(req) ? String(req.user?.id || "") : "";

      if (!organiserId && isOrganiser(req)) {
        throw new Error("Missing organiser id");
      }

      const organiserFilterSql = organiserId
        ? Prisma.sql`AND s."organiserId" = ${organiserId}`
        : Prisma.sql``;

      let rows: Array<{ day: Date; value: number }> = [];

      if (metric === "tickets") {
        rows = await prisma.$queryRaw`
          SELECT date_trunc('day', o."createdAt")::date as day,
                 COALESCE(SUM(t."quantity"), 0)::int as value
          FROM "Ticket" t
          JOIN "Order" o ON o."id" = t."orderId"
          JOIN "Show" s ON s."id" = o."showId"
          WHERE o."status" = 'PAID'
            AND o."createdAt" >= ${start}
            AND o."createdAt" < ${end}
            ${organiserFilterSql}
          GROUP BY day
          ORDER BY day ASC
        `;
      } else if (metric === "orders") {
        rows = await prisma.$queryRaw`
          SELECT date_trunc('day', o."createdAt")::date as day,
                 COUNT(*)::int as value
          FROM "Order" o
          JOIN "Show" s ON s."id" = o."showId"
          WHERE o."status" = 'PAID'
            AND o."createdAt" >= ${start}
            AND o."createdAt" < ${end}
            ${organiserFilterSql}
          GROUP BY day
          ORDER BY day ASC
        `;
      } else if (metric === "gross") {
        rows = await prisma.$queryRaw`
          SELECT date_trunc('day', o."createdAt")::date as day,
                 COALESCE(SUM(o."amountPence"), 0)::int as value
          FROM "Order" o
          JOIN "Show" s ON s."id" = o."showId"
          WHERE o."status" = 'PAID'
            AND o."createdAt" >= ${start}
            AND o."createdAt" < ${end}
            ${organiserFilterSql}
          GROUP BY day
          ORDER BY day ASC
        `;
      } else if (metric === "refunds") {
        rows = await prisma.$queryRaw`
          SELECT date_trunc('day', r."createdAt")::date as day,
                 COALESCE(SUM(COALESCE(r."amountPence", r."amount")), 0)::int as value
          FROM "Refund" r
          JOIN "Order" o ON o."id" = r."orderId"
          JOIN "Show" s ON s."id" = o."showId"
          WHERE r."createdAt" >= ${start}
            AND r."createdAt" < ${end}
            ${organiserFilterSql}
          GROUP BY day
          ORDER BY day ASC
        `;
      } else if (metric === "net") {
        const orderRows: Array<{ day: Date; gross: number; fees: number }> =
          await prisma.$queryRaw`
            SELECT date_trunc('day', o."createdAt")::date as day,
                   COALESCE(SUM(o."amountPence"), 0)::int as gross,
                   COALESCE(SUM(o."paymentFeePence"), 0)::int as fees
            FROM "Order" o
            JOIN "Show" s ON s."id" = o."showId"
            WHERE o."status" = 'PAID'
              AND o."createdAt" >= ${start}
              AND o."createdAt" < ${end}
              ${organiserFilterSql}
            GROUP BY day
            ORDER BY day ASC
          `;

        const refundRows: Array<{ day: Date; value: number }> = await prisma.$queryRaw`
          SELECT date_trunc('day', r."createdAt")::date as day,
                 COALESCE(SUM(COALESCE(r."amountPence", r."amount")), 0)::int as value
          FROM "Refund" r
          JOIN "Order" o ON o."id" = r."orderId"
          JOIN "Show" s ON s."id" = o."showId"
          WHERE r."createdAt" >= ${start}
            AND r."createdAt" < ${end}
            ${organiserFilterSql}
          GROUP BY day
          ORDER BY day ASC
        `;

        const refundMap = new Map(
          refundRows.map((row) => [new Date(row.day).toISOString().slice(0, 10), row.value])
        );

        rows = orderRows.map((row) => {
          const key = new Date(row.day).toISOString().slice(0, 10);
          const refund = refundMap.get(key) || 0;
          return { day: row.day, value: row.gross - row.fees - refund };
        });
      } else {
        throw new Error("Invalid metric");
      }

      const output: { date: string; value: number }[] = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const day = new Date(end);
        day.setDate(end.getDate() - i);
        const key = day.toISOString().slice(0, 10);
        const match = rows.find((r) => new Date(r.day).toISOString().slice(0, 10) === key);
        output.push({ date: key, value: match ? Number(match.value) : 0 });
      }

      return { ok: true, metric, days, series: output };
    });

    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("dashboard/timeseries failed", err);
    res.status(500).json({ ok: false, error: "Failed to load timeseries" });
  }
});

router.get("/dashboard/top-shows", requireAdminOrOrganiser, async (req, res) => {
  const key = getCacheKey(req);
  try {
    const data = await withCache(key, async () => {
      const rangeParam = String(req.query.range || "7d");
      const days = Math.max(1, Number(rangeParam.replace(/[^0-9]/g, "")) || 7);
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - days);

      const showFilter: Prisma.ShowWhereInput = isOrganiser(req)
        ? { organiserId: String(req.user?.id || "") }
        : {};

      const ticketsByShow = await prisma.ticket.groupBy({
        by: ["showId"],
        where: { order: { is: { status: "PAID", createdAt: { gte: start, lt: end }, ...showFilter } } },
        _sum: { quantity: true },
      });

      const orderByShow = await prisma.order.groupBy({
        by: ["showId"],
        where: { status: "PAID", createdAt: { gte: start, lt: end }, ...showFilter },
        _sum: { amountPence: true },
      });

      const showIds = Array.from(new Set(ticketsByShow.map((row) => row.showId)));
      if (!showIds.length) {
        return { ok: true, top: [], bottom: [] };
      }

      const shows = await prisma.show.findMany({
        where: { id: { in: showIds } },
        select: {
          id: true,
          title: true,
          date: true,
          showCapacity: true,
          venue: { select: { name: true } },
        },
      });

      const totalTickets = await prisma.ticket.groupBy({
        by: ["showId"],
        where: { order: { is: { status: "PAID", ...showFilter } }, showId: { in: showIds } },
        _sum: { quantity: true },
      });

      const ticketMap = new Map(
        ticketsByShow.map((row) => [row.showId, toNumber(row._sum.quantity)])
      );
      const grossMap = new Map(
        orderByShow.map((row) => [row.showId, toNumber(row._sum.amountPence)])
      );
      const totalMap = new Map(
        totalTickets.map((row) => [row.showId, toNumber(row._sum.quantity)])
      );

      const enriched = shows.map((show) => {
        const tickets = ticketMap.get(show.id) || 0;
        const gross = grossMap.get(show.id) || 0;
        const totalSold = totalMap.get(show.id) || 0;
        const capacity = show.showCapacity || 0;
        const capacityPct = capacity ? (totalSold / capacity) * 100 : null;

        return {
          id: show.id,
          title: show.title || "Untitled show",
          venue: show.venue?.name || "",
          date: show.date,
          tickets,
          gross,
          capacityPct,
        };
      });

      const top = [...enriched].sort((a, b) => b.tickets - a.tickets).slice(0, 5);

      const bottom = [...enriched].sort((a, b) => a.tickets - b.tickets).slice(0, 5);

      return { ok: true, top, bottom };
    });

    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("dashboard/top-shows failed", err);
    res.status(500).json({ ok: false, error: "Failed to load top shows" });
  }
});

router.get("/dashboard/alerts", requireAdminOrOrganiser, async (req, res) => {
  const key = getCacheKey(req);
  try {
    const data = await withCache(key, async () => {
      const now = new Date();
      const start7 = new Date(now);
      start7.setDate(now.getDate() - 7);
      const prevStart = new Date(now);
      prevStart.setDate(now.getDate() - 14);

      const showFilter: Prisma.ShowWhereInput = isOrganiser(req)
        ? { organiserId: String(req.user?.id || "") }
        : {};

      const upcomingEnd = new Date(now);
      upcomingEnd.setDate(now.getDate() + 14);

      const upcomingShows = await prisma.show.findMany({
        where: { date: { gte: now, lte: upcomingEnd }, ...showFilter },
        select: { id: true, title: true, date: true, venue: { select: { name: true } } },
        take: 20,
      });

      const showIds = upcomingShows.map((show) => show.id);

      const salesByShow = showIds.length
        ? await prisma.ticket.groupBy({
            by: ["showId"],
            where: {
              showId: { in: showIds },
              order: { is: { status: "PAID", createdAt: { gte: start7, lt: now }, ...showFilter } },
            },
            _sum: { quantity: true },
          })
        : [];

      const salesMap = new Map(
        salesByShow.map((row) => [row.showId, toNumber(row._sum.quantity)])
      );

      const alerts: Array<{
        id: string;
        title: string;
        detail: string;
        action: { label: string; href: string };
      }> = [];

      upcomingShows.forEach((show) => {
        const tickets = salesMap.get(show.id) || 0;
        if (tickets < 10) {
          alerts.push({
            id: `low-sales-${show.id}`,
            title: "Weak sales velocity",
            detail: `${show.title || "Untitled show"} at ${show.venue?.name || ""} — ${
              tickets
            } tickets in last 7 days`,
            action: { label: "Open", href: `/admin/ui/shows/${show.id}/edit` },
          });
        }
      });

      const [refundNow, refundPrev] = await Promise.all([
        prisma.refund.aggregate({
          where: { createdAt: { gte: start7, lt: now }, order: { is: organiserFilter(req) } },
          _sum: { amountPence: true, amount: true },
        }),
        prisma.refund.aggregate({
          where: { createdAt: { gte: prevStart, lt: start7 }, order: { is: organiserFilter(req) } },
          _sum: { amountPence: true, amount: true },
        }),
      ]);

      const refundNowValue = toNumber(refundNow._sum.amountPence || refundNow._sum.amount);
      const refundPrevValue = toNumber(refundPrev._sum.amountPence || refundPrev._sum.amount);

      if (refundPrevValue > 0 && refundNowValue > refundPrevValue * 1.5) {
        alerts.push({
          id: "refund-spike",
          title: "Refund spike",
          detail: `Refunds are up ${Math.round(
            pctChange(refundNowValue, refundPrevValue)
          )}% vs previous week`,
          action: { label: "View orders", href: "/admin/ui/orders" },
        });
      }

      return {
        ok: true,
        alerts,
        milestonesTracked: false,
      };
    });

    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("dashboard/alerts failed", err);
    res.status(500).json({ ok: false, error: "Failed to load alerts" });
  }
});

export default router;
