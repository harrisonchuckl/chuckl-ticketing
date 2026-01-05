import { Router } from "express";
import { MarketingCampaignStatus, MarketingRecipientStatus, Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireSiteOwner } from "../lib/owner-authz.js";

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DateRange = {
  start: Date;
  end: Date;
};

function parseDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getDateRange(req: any): { range: DateRange; error?: string } {
  // Date range rules:
  // - from is inclusive (00:00:00 UTC on YYYY-MM-DD)
  // - to is inclusive; we add 1 day and treat end as exclusive
  const fromParam = req.query.from ? String(req.query.from) : "";
  const toParam = req.query.to ? String(req.query.to) : "";
  const now = new Date();

  if (!fromParam && !toParam) {
    const start = addDays(now, -30);
    return { range: { start, end: now } };
  }

  const fromDate = fromParam ? parseDate(fromParam) : null;
  const toDate = toParam ? parseDate(toParam) : null;

  if ((fromParam && !fromDate) || (toParam && !toDate)) {
    return { range: { start: now, end: now }, error: "Invalid date format" };
  }

  if (fromDate && toDate) {
    const end = addDays(toDate, 1);
    if (fromDate >= end) {
      return { range: { start: now, end: now }, error: "from must be before to" };
    }
    return { range: { start: fromDate, end } };
  }

  if (fromDate) {
    if (fromDate >= now) {
      return { range: { start: now, end: now }, error: "from must be before now" };
    }
    return { range: { start: fromDate, end: now } };
  }

  if (!toDate) {
    return { range: { start: now, end: now }, error: "Invalid date format" };
  }

  const end = addDays(toDate, 1);
  const start = addDays(end, -30);
  return { range: { start, end } };
}

function toNumber(value: any) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Number(value) || 0;
}

function getOptionalId(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function buildSqlFilters(organiserId: string | null, showId: string | null) {
  const organiserFilterSql = organiserId
    ? Prisma.sql`AND s."organiserId" = ${organiserId}`
    : Prisma.sql``;
  const showFilterSql = showId ? Prisma.sql`AND s."id" = ${showId}` : Prisma.sql``;
  return { organiserFilterSql, showFilterSql };
}

function buildOrderScope(organiserId: string | null, showId: string | null) {
  const scope: Prisma.OrderWhereInput = {};
  if (showId) scope.showId = showId;
  if (organiserId) scope.show = { organiserId };
  return scope;
}

function alignToGranularity(date: Date, granularity: "day" | "week" | "month") {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (granularity === "day") return base;
  if (granularity === "month") {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  }

  const day = base.getUTCDay();
  const diff = (day + 6) % 7;
  return addDays(base, -diff);
}

function addGranularity(date: Date, granularity: "day" | "week" | "month") {
  if (granularity === "day") return addDays(date, 1);
  if (granularity === "week") return addDays(date, 7);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function buildBuckets(start: Date, end: Date, granularity: "day" | "week" | "month") {
  const buckets: string[] = [];
  let cursor = alignToGranularity(start, granularity);
  while (cursor < end) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor = addGranularity(cursor, granularity);
  }
  return buckets;
}

// Owner Insights API
// curl \
//   -H "cookie: session=..." \
//   "https://example.com/admin/api/owner/summary?from=2024-01-01&to=2024-01-31"
// curl "https://example.com/admin/api/owner/timeseries?metric=gross&granularity=week"
// curl "https://example.com/admin/api/owner/top-organisers?from=2024-01-01&to=2024-01-31"

router.get("/owner/summary", requireSiteOwner, async (req, res) => {
  const { range, error } = getDateRange(req);
  if (error) {
    return res.status(400).json({ error: true, message: error });
  }

  const organiserId = getOptionalId(req.query.organiserId);
  const showId = getOptionalId(req.query.showId);
  const orderScope = buildOrderScope(organiserId, showId);

  try {
    const orderWhere: Prisma.OrderWhereInput = {
      status: "PAID",
      createdAt: { gte: range.start, lt: range.end },
      ...orderScope,
    };

    const [orderAgg, ticketAgg, refundAgg, kickbackRow, organisersRow] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          amountPence: true,
          paymentFeePence: true,
          platformFeePence: true,
          organiserSharePence: true,
        },
        _count: { _all: true },
      }),
      prisma.ticket.aggregate({
        where: { order: { is: orderWhere } },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      prisma.refund.aggregate({
        where: {
          createdAt: { gte: range.start, lt: range.end },
          order: { is: orderScope },
        },
        _sum: { amountPence: true, amount: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ kickback: number }[]>`
        SELECT COALESCE(SUM(GREATEST(0,
          COALESCE(o."platformFeePence", 0) - COALESCE(o."organiserSharePence", 0)
        )), 0)::int as kickback
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserId ? Prisma.sql`AND s."organiserId" = ${organiserId}` : Prisma.sql``}
          ${showId ? Prisma.sql`AND s."id" = ${showId}` : Prisma.sql``}
      `,
      prisma.$queryRaw<{ organisers: number }[]>`
        SELECT COUNT(DISTINCT s."organiserId")::int as organisers
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserId ? Prisma.sql`AND s."organiserId" = ${organiserId}` : Prisma.sql``}
          ${showId ? Prisma.sql`AND s."id" = ${showId}` : Prisma.sql``}
      `,
    ]);

    console.log("[owner-summary] aggregates", {
      orderAgg,
      ticketAgg,
      refundAgg,
      kickbackRow,
      organisersRow,
    });

    const gross = toNumber(orderAgg._sum.amountPence);
    const paymentFees = toNumber(orderAgg._sum.paymentFeePence);
    const refunds = toNumber(refundAgg._sum.amountPence || refundAgg._sum.amount);
    const ticketsSold =
      toNumber(ticketAgg._sum.quantity) ||
      (ticketAgg._count._all ? Number(ticketAgg._count._all) : 0);

    // Definitions:
    // - gross = sum(Order.amountPence) for PAID orders
    // - net = gross - payment fees - refunds
    // - kickback = sum(max(0, platformFeePence - organiserSharePence))
    const net = gross - paymentFees - refunds;
    const kickback = kickbackRow[0]?.kickback || 0;
    const organisersCount = organisersRow[0]?.organisers || 0;

    const { organiserFilterSql, showFilterSql } = buildSqlFilters(organiserId, showId);

    const [customersDistinct, registeredCustomers] = await Promise.all([
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int as count
        FROM (
          SELECT DISTINCT LOWER(o."email") as email
          FROM "Order" o
          JOIN "Show" s ON s."id" = o."showId"
          WHERE o."status" = 'PAID'
            AND o."createdAt" >= ${range.start}
            AND o."createdAt" < ${range.end}
            AND o."email" IS NOT NULL
            ${organiserFilterSql}
            ${showFilterSql}
          UNION
          SELECT DISTINCT LOWER(c."email") as email
          FROM "CustomerAccount" c
          JOIN "Order" o ON o."customerAccountId" = c."id"
          JOIN "Show" s ON s."id" = o."showId"
          WHERE o."status" = 'PAID'
            AND o."createdAt" >= ${range.start}
            AND o."createdAt" < ${range.end}
            ${organiserFilterSql}
            ${showFilterSql}
        ) emails
      `,
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT c."id")::int as count
        FROM "CustomerAccount" c
        JOIN "Order" o ON o."customerAccountId" = c."id"
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
      `,
    ]);

    console.log("[owner-summary] customer counts", {
      customersDistinct,
      registeredCustomers,
    });

    return res.json({
      grossPence: gross,
      ticketsSold,
      paymentFeesPence: paymentFees,
      refundsPence: refunds,
      netPence: net,
      kickbackPence: kickback,
      organisersCount,
      customersDistinctCount: customersDistinct[0]?.count || 0,
      registeredCustomersCount: registeredCustomers[0]?.count || 0,
    });
  } catch (err) {
    console.error("owner/summary failed", err);
    return res.status(500).json({ error: true, message: "Failed to load owner summary" });
  }
});

router.get("/owner/health", requireSiteOwner, async (_req, res) => {
  const workerEnabled = String(process.env.MARKETING_WORKER_ENABLED || "true") === "true";
  const intervalMs = Number(process.env.MARKETING_WORKER_INTERVAL_MS || 30000);
  const sendRate = Number(process.env.MARKETING_SEND_RATE_PER_SEC || 50);
  const dailyLimit = Number(process.env.MARKETING_DAILY_LIMIT || 50000);
  const providerConfigured = Boolean(String(process.env.SENDGRID_API_KEY || "").trim());
  const webhookTokenConfigured = Boolean(String(process.env.SENDGRID_WEBHOOK_TOKEN || "").trim());
  const maxWebhookAgeHours = Number(process.env.SENDGRID_WEBHOOK_MAX_AGE_HOURS || 72);

  const [workerState, sendQueueDepth] = await Promise.all([
    prisma.marketingWorkerState.findUnique({ where: { id: "global" } }),
    prisma.marketingCampaignRecipient.count({
      where: {
        status: { in: [MarketingRecipientStatus.PENDING, MarketingRecipientStatus.RETRYABLE] },
        campaign: {
          status: {
            in: [
              MarketingCampaignStatus.SCHEDULED,
              MarketingCampaignStatus.SENDING,
              MarketingCampaignStatus.PAUSED_LIMIT,
            ],
          },
        },
      },
    }),
  ]);

  res.json({
    ok: true,
    worker: {
      enabled: workerEnabled,
      intervalMs,
      sendRate,
      dailyLimit,
      lastRunAt: workerState?.lastWorkerRunAt || null,
      lastSendAt: workerState?.lastSendAt || null,
    },
    sendQueueDepth,
    provider: {
      sendgridConfigured: providerConfigured,
      webhookTokenConfigured,
      maxWebhookAgeHours,
    },
  });
});

router.get("/owner/timeseries", requireSiteOwner, async (req, res) => {
  const metric = String(req.query.metric || "tickets");
  const granularity = String(req.query.granularity || "day");

  if (!["tickets", "gross", "kickback", "net"].includes(metric)) {
    return res.status(400).json({ error: true, message: "Invalid metric" });
  }

  if (!["day", "week", "month"].includes(granularity)) {
    return res.status(400).json({ error: true, message: "Invalid granularity" });
  }

  const { range, error } = getDateRange(req);
  if (error) {
    return res.status(400).json({ error: true, message: error });
  }

  const organiserId = getOptionalId(req.query.organiserId);
  const showId = getOptionalId(req.query.showId);
  const { organiserFilterSql, showFilterSql } = buildSqlFilters(organiserId, showId);
  const granularityValue = granularity as "day" | "week" | "month";
  const dateTruncOrder = Prisma.raw(`date_trunc('${granularityValue}', o."createdAt")::date`);
  const dateTruncRefund = Prisma.raw(`date_trunc('${granularityValue}', r."createdAt")::date`);

  try {
    let rows: Array<{ day: Date; value: number }> = [];

    if (metric === "tickets") {
      rows = await prisma.$queryRaw`
        SELECT ${dateTruncOrder} as day,
               COALESCE(SUM(t."quantity"), 0)::int as value
        FROM "Ticket" t
        JOIN "Order" o ON o."id" = t."orderId"
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY day
        ORDER BY day ASC
      `;
    } else if (metric === "gross") {
      rows = await prisma.$queryRaw`
        SELECT ${dateTruncOrder} as day,
               COALESCE(SUM(o."amountPence"), 0)::int as value
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY day
        ORDER BY day ASC
      `;
    } else if (metric === "kickback") {
      rows = await prisma.$queryRaw`
        SELECT ${dateTruncOrder} as day,
               COALESCE(SUM(GREATEST(0,
                 COALESCE(o."platformFeePence", 0) - COALESCE(o."organiserSharePence", 0)
               )), 0)::int as value
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY day
        ORDER BY day ASC
      `;
    } else if (metric === "net") {
      const orderRows: Array<{ day: Date; gross: number; fees: number }> = await prisma.$queryRaw`
        SELECT ${dateTruncOrder} as day,
               COALESCE(SUM(o."amountPence"), 0)::int as gross,
               COALESCE(SUM(COALESCE(o."paymentFeePence", 0)), 0)::int as fees
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY day
        ORDER BY day ASC
      `;

      const refundRows: Array<{ day: Date; value: number }> = await prisma.$queryRaw`
        SELECT ${dateTruncRefund} as day,
               COALESCE(SUM(COALESCE(r."amountPence", r."amount")), 0)::int as value
        FROM "Refund" r
        JOIN "Order" o ON o."id" = r."orderId"
        JOIN "Show" s ON s."id" = o."showId"
        WHERE r."createdAt" >= ${range.start}
          AND r."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
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

      console.log("[owner-timeseries] net rows", { orderRows, refundRows });
    }

    console.log("[owner-timeseries] raw rows", { metric, granularity, rows });

    const bucketKeys = buildBuckets(range.start, range.end, granularityValue);
    const rowMap = new Map(
      rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), Number(row.value) || 0])
    );

    const series = bucketKeys.map((date) => {
      const value = rowMap.get(date) || 0;
      if (metric === "tickets") {
        return { date, value };
      }
      return { date, valuePence: value };
    });

    return res.json(series);
  } catch (err) {
    console.error("owner/timeseries failed", err);
    return res.status(500).json({ error: true, message: "Failed to load owner timeseries" });
  }
});

router.get("/owner/top-organisers", requireSiteOwner, async (req, res) => {
  const { range, error } = getDateRange(req);
  if (error) {
    return res.status(400).json({ error: true, message: error });
  }

  const organiserId = getOptionalId(req.query.organiserId);
  const showId = getOptionalId(req.query.showId);
  const { organiserFilterSql, showFilterSql } = buildSqlFilters(organiserId, showId);

  try {
    const rows: Array<{
      organiserId: string;
      organiserName: string | null;
      organiserEmail: string | null;
      gross: number;
      paymentFees: number;
      tickets: number;
      kickback: number;
      refunds: number;
    }> = await prisma.$queryRaw`
      WITH order_rows AS (
        SELECT s."organiserId" as organiser_id,
               COALESCE(SUM(o."amountPence"), 0)::int as gross,
               COALESCE(SUM(COALESCE(o."paymentFeePence", 0)), 0)::int as payment_fees,
               COALESCE(SUM(GREATEST(0,
                 COALESCE(o."platformFeePence", 0) - COALESCE(o."organiserSharePence", 0)
               )), 0)::int as kickback,
               COALESCE(SUM(tickets.tickets), 0)::int as tickets
        FROM "Order" o
        JOIN "Show" s ON s."id" = o."showId"
        LEFT JOIN (
          SELECT "orderId", COALESCE(SUM("quantity"), 0)::int as tickets
          FROM "Ticket"
          GROUP BY "orderId"
        ) tickets ON tickets."orderId" = o."id"
        WHERE o."status" = 'PAID'
          AND o."createdAt" >= ${range.start}
          AND o."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY s."organiserId"
      ),
      refund_rows AS (
        SELECT s."organiserId" as organiser_id,
               COALESCE(SUM(COALESCE(r."amountPence", r."amount")), 0)::int as refunds
        FROM "Refund" r
        JOIN "Order" o ON o."id" = r."orderId"
        JOIN "Show" s ON s."id" = o."showId"
        WHERE r."createdAt" >= ${range.start}
          AND r."createdAt" < ${range.end}
          ${organiserFilterSql}
          ${showFilterSql}
        GROUP BY s."organiserId"
      )
      SELECT u."id" as "organiserId",
             u."name" as "organiserName",
             u."email" as "organiserEmail",
             COALESCE(order_rows.gross, 0)::int as "gross",
             COALESCE(order_rows.payment_fees, 0)::int as "paymentFees",
             COALESCE(order_rows.tickets, 0)::int as "tickets",
             COALESCE(order_rows.kickback, 0)::int as "kickback",
             COALESCE(refund_rows.refunds, 0)::int as "refunds"
      FROM order_rows
      JOIN "User" u ON u."id" = order_rows.organiser_id
      LEFT JOIN refund_rows ON refund_rows.organiser_id = order_rows.organiser_id
      ORDER BY gross DESC
      LIMIT 20
    `;

    console.log("[owner-top-organisers] raw rows", {
      organiserIds: rows.map((row) => row.organiserId),
      totals: rows.map((row) => ({ gross: row.gross, tickets: row.tickets })),
    });

    const response = rows.map((row) => {
      const net = toNumber(row.gross) - toNumber(row.paymentFees) - toNumber(row.refunds);
      return {
        organiserId: row.organiserId,
        organiserName: row.organiserName,
        organiserEmail: row.organiserEmail,
        grossPence: toNumber(row.gross),
        ticketsSold: toNumber(row.tickets),
        kickbackPence: toNumber(row.kickback),
        netPence: net,
      };
    });

    return res.json(response);
  } catch (err) {
    console.error("owner/top-organisers failed", err);
    return res.status(500).json({ error: true, message: "Failed to load top organisers" });
  }
});

export default router;
