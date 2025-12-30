import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { sendTicketsEmail } from "../services/email.js";

const router = Router();

function requireUserId(req: any) {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function parseDateOnly(value: string, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function parseList(value: unknown) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildOrderWhere(req: any, opts?: { orderIds?: string[] }) {
  const showWhere: Prisma.ShowWhereInput = {};
  if (isOrganiser(req)) {
    showWhere.organiserId = requireUserId(req);
  }

  const showId = typeof req.query.showId === "string" ? req.query.showId.trim() : "";
  const venueId = typeof req.query.venueId === "string" ? req.query.venueId.trim() : "";
  if (showId) showWhere.id = showId;
  if (venueId) showWhere.venueId = venueId;

  const showFrom = parseDateOnly(String(req.query.showFrom || ""));
  const showTo = parseDateOnly(String(req.query.showTo || ""), true);
  if (showFrom || showTo) {
    showWhere.date = {};
    if (showFrom) (showWhere.date as Prisma.DateTimeFilter).gte = showFrom;
    if (showTo) (showWhere.date as Prisma.DateTimeFilter).lte = showTo;
  }

  const and: Prisma.OrderWhereInput[] = [];
  if (Object.keys(showWhere).length) {
    and.push({ show: { is: showWhere } });
  }

  const orderFrom = parseDateOnly(String(req.query.orderFrom || ""));
  const orderTo = parseDateOnly(String(req.query.orderTo || ""), true);
  if (orderFrom || orderTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (orderFrom) createdAt.gte = orderFrom;
    if (orderTo) createdAt.lte = orderTo;
    and.push({ createdAt });
  }

  const statusList = parseList(req.query.status).map((s) => s.toUpperCase());
  if (statusList.length) {
    and.push({ status: { in: statusList as any[] } });
  }

  const emailStatuses = parseList(req.query.emailStatus).map((s) => s.toUpperCase());
  if (emailStatuses.length) {
    const includeUnknown = emailStatuses.includes("UNKNOWN");
    const known = emailStatuses.filter((s) => s !== "UNKNOWN");
    if (known.length && includeUnknown) {
      and.push({
        OR: [{ emailDeliveryStatus: { in: known as any[] } }, { emailDeliveryStatus: null }],
      });
    } else if (known.length) {
      and.push({ emailDeliveryStatus: { in: known as any[] } });
    } else if (includeUnknown) {
      and.push({ emailDeliveryStatus: null });
    }
  }

  const pdfStatuses = parseList(req.query.pdfStatus).map((s) => s.toLowerCase());
  if (pdfStatuses.length === 1) {
    if (pdfStatuses[0] === "attached") {
      and.push({ emailPdfAttached: true });
    } else if (pdfStatuses[0] === "missing") {
      and.push({ OR: [{ emailPdfAttached: false }, { emailPdfAttached: null }] });
    }
  }

  const ticketTypeId =
    typeof req.query.ticketTypeId === "string" ? req.query.ticketTypeId.trim() : "";
  if (ticketTypeId) {
    and.push({ tickets: { some: { ticketTypeId } } });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { buyerFirstName: { contains: q, mode: "insensitive" } },
        { buyerLastName: { contains: q, mode: "insensitive" } },
        { stripeId: { contains: q, mode: "insensitive" } },
        { stripeCheckoutSessionId: { contains: q, mode: "insensitive" } },
        { show: { is: { title: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  if (opts?.orderIds?.length) {
    and.push({ id: { in: opts.orderIds } });
  }

  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};
  return { where, showWhere };
}

router.get("/orders", requireAdminOrOrganiser, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.max(1, Math.min(100, Number(req.query.take) || 25));
    const skip = (page - 1) * take;

    const { where } = buildOrderWhere(req);

    const sortBy = String(req.query.sortBy || "createdAt");
    const sortDir = String(req.query.sortDir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const orderByMap: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      createdAt: { createdAt: sortDir },
      showDate: { show: { date: sortDir } },
      amount: { amountPence: sortDir },
      status: { status: sortDir },
      email: { email: sortDir },
    };
    const orderBy = orderByMap[sortBy] || orderByMap.createdAt;

    const [items, total, orderAgg, ticketAgg, refundAgg] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          createdAt: true,
          status: true,
          email: true,
          buyerFirstName: true,
          buyerLastName: true,
          amountPence: true,
          platformFeePence: true,
          paymentFeePence: true,
          netPayoutPence: true,
          stripeId: true,
          stripeCheckoutSessionId: true,
          emailDeliveryStatus: true,
          emailDeliveryAt: true,
          emailPdfAttached: true,
          tags: true,
          show: {
            select: {
              id: true,
              title: true,
              date: true,
              venue: { select: { id: true, name: true } },
            },
          },
          tickets: {
            select: {
              id: true,
              ticketType: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          amountPence: true,
          platformFeePence: true,
          paymentFeePence: true,
          netPayoutPence: true,
        },
      }),
      prisma.ticket.aggregate({
        where: { order: { is: where } },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      prisma.refund.aggregate({
        where: { order: { is: where } },
        _sum: { amountPence: true, amount: true },
      }),
    ]);

    const gross = orderAgg._sum.amountPence ?? 0;
    const platformFees = orderAgg._sum.platformFeePence ?? 0;
    const paymentFees = orderAgg._sum.paymentFeePence ?? 0;
    const fees = platformFees + paymentFees;
    const net =
      typeof orderAgg._sum.netPayoutPence === "number"
        ? orderAgg._sum.netPayoutPence
        : gross - fees;
    const refunds = refundAgg._sum.amountPence ?? refundAgg._sum.amount ?? 0;
    const ticketsSold =
      ticketAgg._sum.quantity ??
      ticketAgg._count._all ??
      0;

    const formatted = items.map((order) => ({
      ...order,
      ticketCount: order.tickets?.length ?? 0,
      ticketTypes: (order.tickets || [])
        .map((t) => t.ticketType?.name)
        .filter(Boolean),
    }));

    let filters;
    const includeFilters = String(req.query.includeFilters || "") === "1";
    if (includeFilters) {
      const baseShowWhere: Prisma.ShowWhereInput = {};
      if (isOrganiser(req)) {
        baseShowWhere.organiserId = requireUserId(req);
      }
      const [shows, venues, ticketTypes] = await Promise.all([
        prisma.show.findMany({
          where: baseShowWhere,
          orderBy: { date: "desc" },
          select: { id: true, title: true, date: true },
          take: 200,
        }),
        prisma.venue.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, city: true },
          take: 200,
        }),
        prisma.ticketType.findMany({
          where: { show: { is: baseShowWhere } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, show: { select: { title: true } } },
          take: 400,
        }),
      ]);
      filters = {
        shows,
        venues,
        ticketTypes: ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          showTitle: tt.show?.title ?? "",
        })),
      };
    }

    res.json({
      ok: true,
      items: formatted,
      total,
      page,
      take,
      kpis: {
        orders: orderAgg._count._all ?? total,
        ticketsSold,
        gross,
        fees,
        net,
        refunds,
      },
      filters,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Failed to load orders" });
  }
});

router.get("/orders/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { where } = buildOrderWhere(req, { orderIds: [String(req.params.id)] });
    const order = await prisma.order.findFirst({
      where,
      include: {
        show: { include: { venue: true } },
        tickets: { include: { ticketType: true } },
        refunds: true,
        notes: {
          include: { createdBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) return res.status(404).json({ ok: false, message: "Order not found" });

    const timeline = [
      ...(order.notes || []).map((note) => ({
        id: note.id,
        createdAt: note.createdAt,
        title: "Note added",
        detail: note.body,
        actor: note.createdBy,
      })),
      ...(order.auditLogs || []).map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        title: log.action.replace(/_/g, " "),
        detail: log.metadata ? JSON.stringify(log.metadata) : "",
        actor: log.actor,
      })),
    ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    res.json({
      ok: true,
      order,
      timeline,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Failed to load order" });
  }
});

router.post("/orders/:id/resend", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { where } = buildOrderWhere(req, { orderIds: [String(req.params.id)] });
    const order = await prisma.order.findFirst({ where, select: { id: true, email: true } });
    if (!order) return res.status(404).json({ ok: false, message: "Order not found" });

    const result = await sendTicketsEmail(order.id);
    if (!result?.ok) {
      return res.status(400).json({ ok: false, message: result?.message || "Resend failed" });
    }

    await prisma.orderAuditLog.create({
      data: {
        orderId: order.id,
        action: "RESEND_EMAIL",
        actorId: req.user?.id || null,
        metadata: { email: order.email || null },
      },
    });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message || "Resend failed" });
  }
});

router.post("/orders/bulk", requireAdminOrOrganiser, async (req, res) => {
  try {
    const action = String(req.body?.action || "");
    const orderIds = Array.isArray(req.body?.orderIds)
      ? req.body.orderIds.map((id: any) => String(id)).filter(Boolean)
      : [];
    if (!orderIds.length) {
      return res.status(400).json({ ok: false, message: "orderIds is required" });
    }

    const accessWhere = buildOrderWhere(req, { orderIds }).where;
    const accessibleOrders = await prisma.order.findMany({
      where: accessWhere,
      select: { id: true, tags: true, email: true },
    });
    const accessibleIds = accessibleOrders.map((o) => o.id);
    if (!accessibleIds.length) {
      return res.status(404).json({ ok: false, message: "No accessible orders found" });
    }

    if (action === "resend_emails") {
      for (const orderId of accessibleIds) {
        await sendTicketsEmail(orderId);
        await prisma.orderAuditLog.create({
          data: {
            orderId,
            action: "BULK_RESEND_EMAIL",
            actorId: req.user?.id || null,
          },
        });
      }
      return res.json({ ok: true });
    }

    if (action === "apply_tags") {
      const tags = Array.isArray(req.body?.tags)
        ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean)
        : [];
      if (!tags.length) {
        return res.status(400).json({ ok: false, message: "tags are required" });
      }
      const mode = String(req.body?.mode || "append");
      for (const order of accessibleOrders) {
        const nextTags =
          mode === "replace"
            ? tags
            : Array.from(new Set([...(order.tags || []), ...tags]));
        await prisma.order.update({
          where: { id: order.id },
          data: { tags: { set: nextTags } },
        });
        await prisma.orderAuditLog.create({
          data: {
            orderId: order.id,
            action: "TAGS_UPDATED",
            actorId: req.user?.id || null,
            metadata: { tags: nextTags, mode },
          },
        });
      }
      return res.json({ ok: true });
    }

    if (action === "add_note") {
      const note = String(req.body?.note || "").trim();
      if (!note) return res.status(400).json({ ok: false, message: "note is required" });
      const noteRows = accessibleIds.map((orderId) => ({
        orderId,
        body: note,
        createdById: req.user?.id || null,
      }));
      await prisma.orderNote.createMany({ data: noteRows });
      for (const orderId of accessibleIds) {
        await prisma.orderAuditLog.create({
          data: {
            orderId,
            action: "NOTE_ADDED",
            actorId: req.user?.id || null,
          },
        });
      }
      return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, message: "Unknown action" });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message || "Bulk action failed" });
  }
});

router.get("/orders/export", requireAdminOrOrganiser, async (req, res) => {
  try {
    const orderIds = parseList(req.query.orderIds);
    const { where } = buildOrderWhere(req, { orderIds });
    const type = String(req.query.type || "finance").toLowerCase();

    let csv = "";
    let filename = "orders-export.csv";

    if (type === "door") {
      const tickets = await prisma.ticket.findMany({
        where: { order: { is: where } },
        include: {
          order: { select: { id: true, email: true, buyerFirstName: true, buyerLastName: true } },
          ticketType: { select: { name: true } },
          show: { select: { title: true, date: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const header = [
        "order_id",
        "buyer_name",
        "buyer_email",
        "show_title",
        "show_date",
        "ticket_type",
        "seat",
        "ticket_serial",
        "holder_name",
      ];
      const rows = tickets.map((t) => [
        t.order?.id ?? "",
        [t.order?.buyerFirstName, t.order?.buyerLastName].filter(Boolean).join(" "),
        t.order?.email ?? "",
        t.show?.title ?? "",
        t.show?.date ? t.show.date.toISOString() : "",
        t.ticketType?.name ?? "",
        t.seatRef ?? t.seatId ?? "",
        t.serial ?? "",
        t.holderName ?? "",
      ]);
      csv = [header, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const s = String(cell ?? "");
              return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
            })
            .join(",")
        )
        .join("\n");
      filename = "orders-door-list.csv";
    } else {
      const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { show: { select: { id: true, title: true, date: true } } },
      });
      const header = [
        "order_id",
        "created_at",
        "status",
        "buyer_email",
        "show_id",
        "show_title",
        "show_date",
        "gross_pence",
        "platform_fee_pence",
        "payment_fee_pence",
        "net_pence",
      ];
      const rows = orders.map((o) => {
        const fees = (o.platformFeePence ?? 0) + (o.paymentFeePence ?? 0);
        const net =
          typeof o.netPayoutPence === "number"
            ? o.netPayoutPence
            : (o.amountPence ?? 0) - fees;
        return [
          o.id,
          o.createdAt.toISOString(),
          o.status,
          o.email ?? "",
          o.show?.id ?? "",
          o.show?.title ?? "",
          o.show?.date ? o.show.date.toISOString() : "",
          String(o.amountPence ?? 0),
          String(o.platformFeePence ?? 0),
          String(o.paymentFeePence ?? 0),
          String(net),
        ];
      });
      csv = [header, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const s = String(cell ?? "");
              return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
            })
            .join(",")
        )
        .join("\n");
      filename = type === "receipt" ? "order-receipt.csv" : "orders-finance.csv";
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Export failed" });
  }
});

export default router;
