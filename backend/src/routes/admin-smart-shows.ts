import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import {
  buildEarlyInsights,
  buildShowAnalytics,
} from "../services/smart-shows-analytics.js";
import { evaluateSegmentContacts } from "../services/marketing/segments.js";

const router = Router();

function isOrganiser(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ORGANISER";
}

function showWhereForList(req: any) {
  if (isOrganiser(req)) {
    return { organiserId: String(req.user?.id || "") };
  }
  return {};
}

function toNumber(value: any) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) return "email,first_name,last_name,consent_status\n";
  const headers = Object.keys(rows[0]);
  const escape = (value: string) => {
    if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
      return `"${value.replace(/\"/g, '""')}"`;
    }
    return value;
  };
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(String(row[key] ?? ""))).join(","));
  });
  return lines.join("\n") + "\n";
}

router.get("/analytics/shows", requireAdminOrOrganiser, async (req, res) => {
  try {
    const rangeDays = Math.max(1, Math.min(180, Number(req.query.range || 60)));
    const now = new Date();
    const start7 = new Date(now);
    start7.setDate(now.getDate() - 7);
    const start14 = new Date(now);
    start14.setDate(now.getDate() - 14);

    const shows = await prisma.show.findMany({
      where: showWhereForList(req),
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        showCapacity: true,
        venueId: true,
        ticketTypes: { select: { available: true } },
        venue: { select: { name: true, city: true } },
        promoterLinks: {
          select: {
            weeklyReportEnabled: true,
            weeklyReportEmail: true,
            weeklyReportTime: true,
          },
        },
      },
    });

    if (!shows.length) {
      return res.json({ ok: true, rangeDays, shows: [] });
    }

    const showIds = shows.map((show) => show.id);
    const [totalSold, last7, prev7, revenueAgg] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID" } },
        },
        _sum: { quantity: true },
      }),
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID", createdAt: { gte: start7, lt: now } } },
        },
        _sum: { quantity: true },
      }),
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID", createdAt: { gte: start14, lt: start7 } } },
        },
        _sum: { quantity: true },
      }),
      prisma.order.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          status: "PAID",
        },
        _sum: { amountPence: true },
      }),
    ]);

    const byShowId = <T extends { showId: string }>(rows: T[]) => {
      const map = new Map<string, T>();
      rows.forEach((row) => map.set(row.showId, row));
      return map;
    };

    const soldMap = byShowId(totalSold);
    const last7Map = byShowId(last7);
    const prev7Map = byShowId(prev7);
    const revenueMap = byShowId(revenueAgg);

    const analytics = shows.map((show) => {
      const soldRow = soldMap.get(show.id);
      const last7Row = last7Map.get(show.id);
      const prev7Row = prev7Map.get(show.id);
      const revenueRow = revenueMap.get(show.id);

      return buildShowAnalytics({
        show,
        soldCount: toNumber(soldRow?._sum.quantity),
        revenuePence: toNumber(revenueRow?._sum.amountPence),
        last7: toNumber(last7Row?._sum.quantity),
        prev7: toNumber(prev7Row?._sum.quantity),
        now,
      });
    });

    return res.json({ ok: true, rangeDays, shows: analytics });
  } catch (err) {
    console.error("analytics/shows failed", err);
    res.status(500).json({ ok: false, error: "Failed to load analytics" });
  }
});

router.get("/analytics/early-insights", requireAdminOrOrganiser, async (req, res) => {
  try {
    const windowDays = Math.max(7, Math.min(45, Number(req.query.window || 21)));
    const analyticsResp = await prisma.show.findMany({
      where: showWhereForList(req),
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        showCapacity: true,
        venueId: true,
        ticketTypes: { select: { available: true } },
        venue: { select: { name: true, city: true } },
        promoterLinks: {
          select: {
            weeklyReportEnabled: true,
            weeklyReportEmail: true,
            weeklyReportTime: true,
          },
        },
      },
    });

    if (!analyticsResp.length) {
      return res.json({ ok: true, insights: [], actions: {} });
    }

    const showIds = analyticsResp.map((show) => show.id);
    const now = new Date();
    const start7 = new Date(now);
    start7.setDate(now.getDate() - 7);
    const start14 = new Date(now);
    start14.setDate(now.getDate() - 14);

    const [totalSold, last7, prev7, revenueAgg] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID" } },
        },
        _sum: { quantity: true },
      }),
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID", createdAt: { gte: start7, lt: now } } },
        },
        _sum: { quantity: true },
      }),
      prisma.ticket.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          order: { is: { status: "PAID", createdAt: { gte: start14, lt: start7 } } },
        },
        _sum: { quantity: true },
      }),
      prisma.order.groupBy({
        by: ["showId"],
        where: {
          showId: { in: showIds },
          status: "PAID",
        },
        _sum: { amountPence: true },
      }),
    ]);

    const mapById = <T extends { showId: string }>(rows: T[]) => {
      const map = new Map<string, T>();
      rows.forEach((row) => map.set(row.showId, row));
      return map;
    };

    const soldMap = mapById(totalSold);
    const last7Map = mapById(last7);
    const prev7Map = mapById(prev7);
    const revenueMap = mapById(revenueAgg);

    const analytics = analyticsResp.map((show) =>
      buildShowAnalytics({
        show,
        soldCount: toNumber(soldMap.get(show.id)?._sum.quantity),
        revenuePence: toNumber(revenueMap.get(show.id)?._sum.amountPence),
        last7: toNumber(last7Map.get(show.id)?._sum.quantity),
        prev7: toNumber(prev7Map.get(show.id)?._sum.quantity),
        now,
      })
    );

    const insights = buildEarlyInsights({ analytics, windowDays });

    const actionTargets: Record<
      string,
      { label: string; shows: Array<{ id: string; title: string | null; date: Date }> }
    > = {
      generate_promo_pack: { label: "Generate promo pack", shows: [] },
      schedule_email: { label: "Schedule email", shows: [] },
      boost_featured_slot: { label: "Boost featured slot", shows: [] },
      chase_venue_report: { label: "Chase venue report", shows: [] },
    };

    analytics.forEach((row) => {
      row.recommendations.forEach((rec) => {
        const target = actionTargets[rec.key];
        if (!target) return;
        target.shows.push({ id: row.showId, title: row.title, date: row.date });
      });
    });

    return res.json({ ok: true, insights, actions: actionTargets });
  } catch (err) {
    console.error("analytics/early-insights failed", err);
    res.status(500).json({ ok: false, error: "Failed to load insights" });
  }
});

router.post("/campaign-drafts", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const {
      id,
      showId,
      objective,
      riskLevel,
      timeToShowDays,
      audienceRules,
      schedule,
      copySkeleton,
      notes,
    } = req.body || {};

    if (!showId || !objective) {
      return res.status(400).json({ ok: false, error: "Show and objective are required" });
    }

    const show = await prisma.show.findFirst({
      where: { id: showId, ...showWhereForList(req) },
      select: { id: true },
    });

    if (!show) {
      return res.status(404).json({ ok: false, error: "Show not found" });
    }

    const payload = {
      showId,
      objective: String(objective),
      riskLevel: riskLevel ? String(riskLevel) : null,
      timeToShowDays: timeToShowDays != null ? Number(timeToShowDays) : null,
      audienceRules: audienceRules ?? null,
      schedule: schedule ?? null,
      copySkeleton: copySkeleton ? String(copySkeleton) : null,
      notes: notes ? String(notes) : null,
      createdByUserId: userId,
    };

    if (id) {
      const existing = await prisma.campaignDraft.findFirst({
        where: { id: String(id), show: showWhereForList(req) },
        select: { id: true },
      });
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Draft not found" });
      }
    }

    const draft = id
      ? await prisma.campaignDraft.update({
          where: { id: String(id) },
          data: payload,
        })
      : await prisma.campaignDraft.create({ data: payload });

    return res.json({ ok: true, draft });
  } catch (err) {
    console.error("campaign draft save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save draft" });
  }
});

router.get("/campaign-drafts/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const draft = await prisma.campaignDraft.findFirst({
      where: {
        id: String(req.params.id),
        show: showWhereForList(req),
      },
      include: { show: { select: { id: true, title: true, date: true } } },
    });

    if (!draft) return res.status(404).json({ ok: false, error: "Draft not found" });

    return res.json({ ok: true, draft });
  } catch (err) {
    console.error("campaign draft fetch failed", err);
    res.status(500).json({ ok: false, error: "Failed to load draft" });
  }
});

router.get(
  "/campaign-drafts/:id/export-recipients",
  requireAdminOrOrganiser,
  async (req, res) => {
    try {
      const draft = await prisma.campaignDraft.findFirst({
        where: {
          id: String(req.params.id),
          show: showWhereForList(req),
        },
        select: { id: true, audienceRules: true },
      });

      if (!draft) return res.status(404).json({ ok: false, error: "Draft not found" });

      const tenantId = String(req.user?.id || "");
      const recipients = await evaluateSegmentContacts(tenantId, draft.audienceRules || {});

      const csv = toCsv(
        recipients.map((contact) => ({
          email: contact.email,
          first_name: contact.firstName || "",
          last_name: contact.lastName || "",
          consent_status: contact.consentStatus || "",
        }))
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=campaign-draft-${draft.id}-recipients.csv`
      );
      return res.send(csv);
    } catch (err) {
      console.error("campaign draft export failed", err);
      res.status(500).json({ ok: false, error: "Failed to export recipients" });
    }
  }
);

router.post("/upsell-bundles", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { id, showId, template, title, recommendedReason, items, status } = req.body || {};

    if (!showId) {
      return res.status(400).json({ ok: false, error: "Show is required" });
    }

    const show = await prisma.show.findFirst({
      where: { id: showId, ...showWhereForList(req) },
      select: { id: true },
    });

    if (!show) {
      return res.status(404).json({ ok: false, error: "Show not found" });
    }

    const payload = {
      showId,
      template: template ? String(template) : null,
      title: title ? String(title) : null,
      recommendedReason: recommendedReason ? String(recommendedReason) : null,
      items: items ?? null,
      status: status ? String(status) : "DRAFT",
      createdByUserId: userId,
    };

    if (id) {
      const existing = await prisma.upsellBundle.findFirst({
        where: { id: String(id), show: showWhereForList(req) },
        select: { id: true },
      });
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Bundle not found" });
      }
    }

    const bundle = id
      ? await prisma.upsellBundle.update({
          where: { id: String(id) },
          data: payload,
        })
      : await prisma.upsellBundle.create({ data: payload });

    return res.json({ ok: true, bundle });
  } catch (err) {
    console.error("upsell bundle save failed", err);
    res.status(500).json({ ok: false, error: "Failed to save upsell bundle" });
  }
});

router.get("/upsell-bundles/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const bundle = await prisma.upsellBundle.findFirst({
      where: {
        id: String(req.params.id),
        show: showWhereForList(req),
      },
      include: { show: { select: { id: true, title: true, date: true } } },
    });

    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });

    return res.json({ ok: true, bundle });
  } catch (err) {
    console.error("upsell bundle fetch failed", err);
    res.status(500).json({ ok: false, error: "Failed to load bundle" });
  }
});

export default router;
