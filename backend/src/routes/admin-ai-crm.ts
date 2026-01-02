import { Router } from "express";
import { Prisma, ShowEventType, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { ensureUniqueSlug, slugify } from "../lib/storefront.js";

const router = Router();

// Dev test checklist:
// - Create segment via prompt → preview → save → run → members appear → export CSV downloads
// - Tag customers in bulk and see tags on customer list
// - Create survey → submit response via public link → results visible in admin
// - Create product → attach as show add-on → shows at checkout as upsell → order stores line items correctly
// - Support: create ticket → triage → suggested reply uses real show/order info → message saves in thread
// - Chatbot: add knowledge → transcript records → mark conversion helped

function organiserIdFor(req: any) {
  return String(req.user?.id || "");
}

function logRequest(label: string, payload: any) {
  console.log(`[ai-crm] ${label}`, payload);
}

function parseJson(input: any, fallback: any) {
  if (!input) return fallback;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(String(input));
  } catch (err) {
    return fallback;
  }
}

function normalizeEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function formatCurrency(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function parseIntOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function isAdmin(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ADMIN";
}

async function loadStorefrontForRequest(req: any) {
  const ownerUserId = isAdmin(req)
    ? String(req.query.ownerUserId || req.body?.ownerUserId || req.user?.id || "")
    : organiserIdFor(req);

  if (!ownerUserId) {
    throw new Error("Missing owner user id");
  }

  const storefront = await prisma.storefront.findFirst({
    where: { ownerUserId },
  });

  return { storefront, ownerUserId };
}

async function ensureStorefront(req: any) {
  const { storefront, ownerUserId } = await loadStorefrontForRequest(req);
  if (storefront) return storefront;
  const fallbackSlug = await ensureUniqueSlug(slugify("storefront"));
  return prisma.storefront.create({
    data: {
      ownerUserId,
      name: "Storefront",
      slug: fallbackSlug,
      status: "DRAFT",
    },
  });
}

async function aggregateCustomers(organiserId: string) {
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      show: { organiserId },
    },
    select: {
      id: true,
      createdAt: true,
      amountPence: true,
      email: true,
      userId: true,
      user: { select: { id: true, email: true, name: true } },
      show: {
        select: {
          id: true,
          title: true,
          venue: { select: { city: true } },
        },
      },
    },
  });

  const map = new Map<string, any>();

  for (const order of orders) {
    const email = normalizeEmail(order.email || order.user?.email);
    if (!email) continue;
    const existing = map.get(email) || {
      email,
      name: order.user?.name || email.split("@")[0],
      userId: order.user?.id || null,
      orderCount: 0,
      lifetimeSpendPence: 0,
      lastPurchaseAt: null,
      town: null,
      lastShowTitle: null,
    };

    existing.orderCount += 1;
    existing.lifetimeSpendPence += Number(order.amountPence || 0);
    if (!existing.lastPurchaseAt || order.createdAt > existing.lastPurchaseAt) {
      existing.lastPurchaseAt = order.createdAt;
      existing.town = order.show?.venue?.city || existing.town;
      existing.lastShowTitle = order.show?.title || existing.lastShowTitle;
    }
    map.set(email, existing);
  }

  return Array.from(map.values());
}

function parseSegmentPrompt(promptText: string) {
  const lower = promptText.toLowerCase();
  const matchDays = lower.match(/(\d+)\s*\+?\s*days?/);
  const matchOrders = lower.match(/(\d+)\s*\+?\s*orders?/);
  const matchSpend = lower.match(/£\s*(\d+)|(?:spend\s*)(\d+)/);
  const matchHours = lower.match(/(\d+)\s*hours?/);
  const matchComedian = lower.match(/fans?\s+of\s+([a-z0-9\s\-']+)/i);
  const matchTown = lower.match(/in\s+([a-z0-9\s\-']+)/i);

  if (lower.includes("lapsed")) {
    const days = matchDays ? Number(matchDays[1]) : 90;
    return {
      definitionJson: { type: "lapsed", days },
      summary: `Lapsed buyers (no paid order in ${days} days)`,
    };
  }

  if (lower.includes("regular")) {
    const minOrders = matchOrders ? Number(matchOrders[1]) : null;
    const minSpend = matchSpend ? Number(matchSpend[1] || matchSpend[2]) : null;
    return {
      definitionJson: { type: "regulars", minOrders, minSpend },
      summary: `Regulars (${minOrders ? `${minOrders}+ orders` : ""}${minOrders && minSpend ? " or " : ""}${minSpend ? `£${minSpend}+ spend` : ""})`,
    };
  }

  if (lower.includes("viewed")) {
    const days = matchDays ? Number(matchDays[1]) : 30;
    return {
      definitionJson: { type: "viewed_no_purchase", days },
      summary: `Viewed but didn't buy (${days} days)`,
    };
  }

  if (lower.includes("abandoned")) {
    const hours = matchHours ? Number(matchHours[1]) : 24;
    return {
      definitionJson: { type: "abandoned_checkout", hours },
      summary: `Abandoned checkout (${hours} hours)`,
    };
  }

  if (lower.includes("fans of") || lower.includes("comedian")) {
    const name = matchComedian ? matchComedian[1].trim() : promptText.trim();
    return {
      definitionJson: { type: "comedian_fans", name },
      summary: `Fans of ${name}`,
    };
  }

  if (matchTown) {
    const location = matchTown[1].trim();
    return {
      definitionJson: { type: "location", location },
      summary: `Location: ${location}`,
    };
  }

  return {
    definitionJson: { type: "custom", prompt: promptText },
    summary: "Custom segment",
  };
}

async function buildSegmentMembers(segment: any, organiserId: string) {
  const definition = parseJson(segment.definitionJson, {});
  const customers = await aggregateCustomers(organiserId);
  const now = Date.now();

  if (definition.type === "lapsed") {
    const cutoff = now - Number(definition.days || 90) * 24 * 60 * 60 * 1000;
    return customers.filter((c) => c.lastPurchaseAt && c.lastPurchaseAt.getTime() <= cutoff);
  }

  if (definition.type === "regulars") {
    const minOrders = Number(definition.minOrders || 0);
    const minSpend = Number(definition.minSpend || 0);
    return customers.filter((c) => {
      const byOrders = minOrders ? c.orderCount >= minOrders : false;
      const bySpend = minSpend ? c.lifetimeSpendPence >= minSpend * 100 : false;
      return byOrders || bySpend;
    });
  }

  if (definition.type === "comedian_fans") {
    const name = String(definition.name || "").toLowerCase();
    if (!name) return [];
    return customers.filter((c) => String(c.lastShowTitle || "").toLowerCase().includes(name));
  }

  if (definition.type === "location") {
    const location = String(definition.location || "").toLowerCase();
    return customers.filter((c) => String(c.town || "").toLowerCase().includes(location));
  }

  if (definition.type === "viewed_no_purchase") {
    const days = Number(definition.days || 30);
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const views = await prisma.crmEventView.findMany({
      where: {
        organiserId,
        eventType: "VIEW",
        viewedAt: { gte: new Date(cutoff) },
        customerEmail: { not: null },
      },
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    const emails = new Set(views.map((v) => normalizeEmail(v.customerEmail)));
    return customers.filter((c) => emails.has(c.email));
  }

  if (definition.type === "abandoned_checkout") {
    const hours = Number(definition.hours || 24);
    const cutoff = now - hours * 60 * 60 * 1000;
    const views = await prisma.crmEventView.findMany({
      where: {
        organiserId,
        eventType: "CHECKOUT_START",
        viewedAt: { gte: new Date(cutoff) },
        customerEmail: { not: null },
      },
      select: { customerEmail: true },
      distinct: ["customerEmail"],
    });
    const emails = new Set(views.map((v) => normalizeEmail(v.customerEmail)));
    return customers.filter((c) => emails.has(c.email));
  }

  return [];
}

router.get("/ai/audience/overview", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("audience.overview", { organiserId });

  const orders = await prisma.order.findMany({
    where: { status: "PAID", show: { organiserId } },
    select: {
      id: true,
      createdAt: true,
      amountPence: true,
      email: true,
      user: { select: { email: true } },
      show: { select: { id: true, title: true, venue: { select: { city: true } } } },
    },
  });

  const customers = new Map<string, { firstOrderAt: Date; lastOrderAt: Date; orderCount: number; showId?: string }>();
  for (const order of orders) {
    const email = normalizeEmail(order.email || order.user?.email);
    if (!email) continue;
    const existing = customers.get(email);
    if (!existing) {
      customers.set(email, {
        firstOrderAt: order.createdAt,
        lastOrderAt: order.createdAt,
        orderCount: 1,
        showId: order.show?.id,
      });
    } else {
      existing.orderCount += 1;
      if (order.createdAt < existing.firstOrderAt) {
        existing.firstOrderAt = order.createdAt;
        existing.showId = order.show?.id;
      }
      if (order.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = order.createdAt;
      }
    }
  }

  const now = Date.now();
  const totalCustomers = customers.size;
  const new7 = Array.from(customers.values()).filter((c) => now - c.firstOrderAt.getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const new30 = Array.from(customers.values()).filter((c) => now - c.firstOrderAt.getTime() <= 30 * 24 * 60 * 60 * 1000).length;
  const repeat = Array.from(customers.values()).filter((c) => c.orderCount >= 2).length;
  const lapsed = Array.from(customers.values()).filter((c) => now - c.lastOrderAt.getTime() > 90 * 24 * 60 * 60 * 1000).length;

  const townMap = new Map<string, number>();
  const showMap = new Map<string, { title: string; count: number }>();
  for (const order of orders) {
    const town = order.show?.venue?.city;
    if (town) townMap.set(town, (townMap.get(town) || 0) + 1);
  }
  for (const customer of customers.values()) {
    if (!customer.showId) continue;
    const show = orders.find((o) => o.show?.id === customer.showId)?.show;
    if (!show) continue;
    const existing = showMap.get(show.id) || { title: show.title || "Unknown", count: 0 };
    existing.count += 1;
    showMap.set(show.id, existing);
  }

  const topTowns = Array.from(townMap.entries())
    .map(([town, count]) => ({ town, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topShows = Array.from(showMap.entries())
    .map(([id, data]) => ({ showId: id, title: data.title, newBuyers: data.count }))
    .sort((a, b) => b.newBuyers - a.newBuyers)
    .slice(0, 5);

  const segments = await prisma.crmSegment.findMany({
    where: { organiserId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  const segmentIds = segments.map((s) => s.id);
  const memberCounts = await prisma.crmSegmentMember.groupBy({
    by: ["segmentId"],
    where: { segmentId: { in: segmentIds } },
    _count: { segmentId: true },
  });
  const memberMap = new Map(memberCounts.map((row) => [row.segmentId, row._count.segmentId]));

  return res.json({
    ok: true,
    overview: {
      totals: {
        totalCustomers,
        newCustomers7: new7,
        newCustomers30: new30,
        repeatCustomers: repeat,
        lapsedCustomers: lapsed,
      },
      topTowns,
      topShows,
      segments: segments.map((s) => ({
        id: s.id,
        name: s.name,
        size: memberMap.get(s.id) || 0,
        lastRunAt: s.lastRunAt,
      })),
    },
  });
});

router.post("/ai/segments/parse", requireAdminOrOrganiser, async (req, res) => {
  const promptText = String(req.body?.promptText || "").trim();
  logRequest("segments.parse", { promptText });
  if (!promptText) return res.status(400).json({ ok: false, error: "Prompt text required" });
  const parsed = parseSegmentPrompt(promptText);
  return res.json({ ok: true, ...parsed });
});

router.get("/ai/segments", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("segments.list", { organiserId });
  const segments = await prisma.crmSegment.findMany({
    where: { organiserId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, segments });
});

router.post("/ai/segments", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("segments.create", payload);

  const name = String(payload.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });

  const segment = await prisma.crmSegment.create({
    data: {
      organiserId,
      name,
      description: payload.description || null,
      definitionJson: payload.definitionJson || {},
    },
  });

  return res.json({ ok: true, segment });
});

router.put("/ai/segments/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("segments.update", { id: req.params.id, payload });

  const segment = await prisma.crmSegment.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      description: payload.description || null,
      definitionJson: payload.definitionJson || undefined,
    },
  });

  return res.json({ ok: true, segment });
});

router.post("/ai/segments/:id/archive", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("segments.archive", { id: req.params.id });

  await prisma.crmSegment.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: { archivedAt: new Date() },
  });

  return res.json({ ok: true });
});

router.post("/ai/segments/:id/run", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("segments.run", { id });

  const segment = await prisma.crmSegment.findFirst({ where: { id, organiserId } });
  if (!segment) return res.status(404).json({ ok: false, error: "Segment not found" });

  const members = await buildSegmentMembers(segment, organiserId);
  const emails = members.map((m) => normalizeEmail(m.email));

  await prisma.crmSegmentMember.deleteMany({ where: { segmentId: id } });

  if (emails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const userMap = new Map(users.map((u) => [normalizeEmail(u.email), u.id]));

    await prisma.crmSegmentMember.createMany({
      data: emails.map((email) => ({
        segmentId: id,
        customerEmail: email,
        customerId: userMap.get(email) || null,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.crmSegment.update({
    where: { id },
    data: { lastRunAt: new Date() },
  });

  return res.json({ ok: true, memberCount: emails.length });
});

router.get("/ai/segments/:id/members", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("segments.members", { id });

  const members = await prisma.crmSegmentMember.findMany({
    where: { segmentId: id },
    select: { customerEmail: true },
  });

  const customers = await aggregateCustomers(organiserId);
  const memberSet = new Set(members.map((m) => normalizeEmail(m.customerEmail)));
  const rows = customers
    .filter((c) => memberSet.has(c.email))
    .map((c) => ({
      name: c.name,
      email: c.email,
      town: c.town,
      lastPurchaseAt: c.lastPurchaseAt,
      orderCount: c.orderCount,
      lifetimeSpendPence: c.lifetimeSpendPence,
    }));

  return res.json({ ok: true, members: rows });
});

router.get("/ai/segments/:id/export", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("segments.export", { id });

  const members = await prisma.crmSegmentMember.findMany({
    where: { segmentId: id },
    select: { customerEmail: true },
  });

  const customers = await aggregateCustomers(organiserId);
  const memberSet = new Set(members.map((m) => normalizeEmail(m.customerEmail)));
  const rows = customers.filter((c) => memberSet.has(c.email));

  const header = ["Name", "Email", "Town", "Last Purchase", "Order Count", "Lifetime Spend"].join(",");
  const lines = rows.map((c) => [
    `"${String(c.name || "").replace(/"/g, '""')}"`,
    `"${c.email}"`,
    `"${String(c.town || "").replace(/"/g, '""')}"`,
    c.lastPurchaseAt ? c.lastPurchaseAt.toISOString() : "",
    String(c.orderCount || 0),
    formatCurrency(c.lifetimeSpendPence),
  ].join(","));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=segment-${id}.csv`);
  res.send([header, ...lines].join("\n"));
});

router.get("/ai/tags", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("tags.list", { organiserId });
  const tags = await prisma.crmTag.findMany({
    where: { organiserId },
    include: { customers: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, tags });
});

router.post("/ai/tags", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("tags.create", payload);

  const name = String(payload.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });

  const tag = await prisma.crmTag.create({
    data: {
      organiserId,
      name,
      colour: payload.colour || null,
    },
  });

  return res.json({ ok: true, tag });
});

router.put("/ai/tags/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("tags.update", { id: req.params.id, payload });

  await prisma.crmTag.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      colour: payload.colour || null,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/tags/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("tags.delete", { id });

  await prisma.crmCustomerTag.deleteMany({ where: { tagId: id } });
  await prisma.crmTag.deleteMany({ where: { id, organiserId } });

  return res.json({ ok: true });
});

router.post("/ai/tags/bulk", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("tags.bulk", payload);

  const tagId = String(payload.tagId || "");
  const action = String(payload.action || "add");
  const emails = Array.isArray(payload.emails) ? payload.emails.map(normalizeEmail).filter(Boolean) : [];
  if (!tagId || !emails.length) return res.status(400).json({ ok: false, error: "Tag and emails required" });

  if (action === "remove") {
    await prisma.crmCustomerTag.deleteMany({
      where: { organiserId, tagId, customerEmail: { in: emails } },
    });
    return res.json({ ok: true, removed: emails.length });
  }

  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const userMap = new Map(users.map((u) => [normalizeEmail(u.email), u.id]));

  await prisma.crmCustomerTag.createMany({
    data: emails.map((email) => ({
      organiserId,
      tagId,
      customerEmail: email,
      customerId: userMap.get(email) || null,
    })),
    skipDuplicates: true,
  });

  return res.json({ ok: true, added: emails.length });
});

router.get("/ai/surveys", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("surveys.list", { organiserId });
  const surveys = await prisma.crmSurvey.findMany({
    where: { organiserId },
    include: { questions: true, responses: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, surveys });
});

router.get("/ai/surveys/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("surveys.detail", { id });
  const survey = await prisma.crmSurvey.findFirst({
    where: { id, organiserId },
    include: { questions: true },
  });
  if (!survey) return res.status(404).json({ ok: false, error: "Survey not found" });
  return res.json({ ok: true, survey });
});

router.post("/ai/surveys", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("surveys.create", payload);

  const name = String(payload.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });

  const survey = await prisma.crmSurvey.create({
    data: {
      organiserId,
      name,
      showId: payload.showId || null,
      status: payload.status || "DRAFT",
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    },
  });

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (questions.length) {
    await prisma.crmSurveyQuestion.createMany({
      data: questions.map((q: any, index: number) => ({
        surveyId: survey.id,
        type: q.type || "text",
        prompt: q.prompt || "",
        optionsJson: q.optionsJson || null,
        sortOrder: Number(q.sortOrder ?? index),
      })),
    });
  }

  const fullSurvey = await prisma.crmSurvey.findUnique({
    where: { id: survey.id },
    include: { questions: true },
  });

  return res.json({ ok: true, survey: fullSurvey });
});

router.put("/ai/surveys/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  const payload = req.body || {};
  logRequest("surveys.update", { id, payload });

  await prisma.crmSurvey.updateMany({
    where: { id, organiserId },
    data: {
      name: payload.name || undefined,
      showId: payload.showId || null,
      status: payload.status || undefined,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    },
  });

  return res.json({ ok: true });
});

router.post("/ai/surveys/:id/questions", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  const payload = req.body || {};
  logRequest("surveys.questions", { id, payload });

  const survey = await prisma.crmSurvey.findFirst({ where: { id, organiserId } });
  if (!survey) return res.status(404).json({ ok: false, error: "Survey not found" });

  await prisma.crmSurveyQuestion.deleteMany({ where: { surveyId: id } });
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (questions.length) {
    await prisma.crmSurveyQuestion.createMany({
      data: questions.map((q: any, index: number) => ({
        surveyId: id,
        type: q.type || "text",
        prompt: q.prompt || "",
        optionsJson: q.optionsJson || null,
        sortOrder: Number(q.sortOrder ?? index),
      })),
    });
  }

  return res.json({ ok: true });
});

router.get("/ai/surveys/:id/responses", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("surveys.responses", { id });

  const survey = await prisma.crmSurvey.findFirst({ where: { id, organiserId } });
  if (!survey) return res.status(404).json({ ok: false, error: "Survey not found" });

  const responses = await prisma.crmSurveyResponse.findMany({
    where: { surveyId: id },
    orderBy: { submittedAt: "desc" },
  });

  return res.json({ ok: true, responses });
});

router.get("/ai/recommendations", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const showId = String(req.query.showId || "");
  logRequest("audience.recommendations", { showId });

  const show = await prisma.show.findFirst({ where: { id: showId, organiserId } });
  if (!show) return res.status(404).json({ ok: false, error: "Show not found" });

  const orders = await prisma.order.findMany({
    where: { showId, status: "PAID" },
    select: { email: true },
  });
  const totalOrders = orders.length || 1;

  const customers = await aggregateCustomers(organiserId);
  const locals = customers.filter((c) => c.town);
  const lapsed = customers.filter((c) => c.lastPurchaseAt && c.lastPurchaseAt.getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000);

  const recommendations = {
    segments: [
      {
        name: "Recent buyers",
        reason: `Already ${orders.length} buyers for ${show.title}.`,
        definitionJson: { type: "regulars", minOrders: 1 },
      },
      {
        name: "Lapsed locals",
        reason: `Reach ${lapsed.length} lapsed customers in local towns.`,
        definitionJson: { type: "lapsed", days: 90 },
      },
      {
        name: "Nearby audience",
        reason: `${locals.length} customers have a known town.`,
        definitionJson: { type: "location", location: locals[0]?.town || "local" },
      },
    ],
    subjectLines: [
      `Back in town: ${show.title}`,
      `Don't miss ${show.title} this week`,
      `Local favourite: ${show.title}`,
    ],
    previewText: [
      `Limited tickets left — ${totalOrders} already snapped up.`,
      `A night out at ${show.title}.`,
    ],
    messageAngles: [
      "Scarcity",
      "Local pride",
      "Big-name act",
      "Payday weekend",
    ],
  };

  return res.json({ ok: true, recommendations });
});

router.get("/ai/store/products", requireAdminOrOrganiser, async (req, res) => {
  const storefront = await ensureStorefront(req);
  logRequest("store.products.list", { storefrontId: storefront.id });

  const products = await prisma.product.findMany({
    where: { storefrontId: storefront.id },
    include: { variants: true, images: true },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ ok: true, products });
});

router.post("/ai/store/products", requireAdminOrOrganiser, async (req, res) => {
  const storefront = await ensureStorefront(req);
  const payload = req.body || {};
  logRequest("store.products.create", payload);

  const title = String(payload.title || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "Title required" });

  const slugValue = slugify(String(payload.slug || title));
  const existing = await prisma.product.findFirst({ where: { storefrontId: storefront.id, slug: slugValue } });
  if (existing) return res.status(409).json({ ok: false, error: "Product slug already exists" });

  const product = await prisma.product.create({
    data: {
      storefrontId: storefront.id,
      title,
      slug: slugValue,
      description: payload.description || null,
      category: payload.category || "MERCH",
      fulfilmentType: payload.fulfilmentType || "NONE",
      status: payload.status || "DRAFT",
      pricePence: parseIntOrNull(payload.pricePence),
      currency: payload.currency || "gbp",
      inventoryMode: payload.inventoryMode || "UNLIMITED",
      stockCount: parseIntOrNull(payload.stockCount),
    },
  });

  return res.json({ ok: true, product });
});

router.put("/ai/store/products/:id", requireAdminOrOrganiser, async (req, res) => {
  const storefront = await ensureStorefront(req);
  const payload = req.body || {};
  logRequest("store.products.update", { id: req.params.id, payload });

  const title = String(payload.title || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "Title required" });

  const slugValue = slugify(String(payload.slug || title));
  await prisma.product.updateMany({
    where: { id: String(req.params.id), storefrontId: storefront.id },
    data: {
      title,
      slug: slugValue,
      description: payload.description || null,
      category: payload.category || "MERCH",
      fulfilmentType: payload.fulfilmentType || "NONE",
      status: payload.status || "DRAFT",
      pricePence: parseIntOrNull(payload.pricePence),
      currency: payload.currency || "gbp",
      inventoryMode: payload.inventoryMode || "UNLIMITED",
      stockCount: parseIntOrNull(payload.stockCount),
    },
  });

  return res.json({ ok: true });
});

router.get("/ai/store/addons", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("store.addons.list", { organiserId });
  const addons = await prisma.storeShowAddOn.findMany({
    where: { organiserId },
    include: { product: true, show: true },
    orderBy: { sortOrder: "asc" },
  });
  return res.json({ ok: true, addons });
});

router.post("/ai/store/addons", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.addons.create", payload);

  const addon = await prisma.storeShowAddOn.create({
    data: {
      organiserId,
      showId: payload.showId,
      productId: payload.productId,
      mode: payload.mode || "UPSELL",
      isActive: payload.isActive !== false,
      maxPerOrder: parseIntOrNull(payload.maxPerOrder),
      sortOrder: parseIntOrNull(payload.sortOrder) || 0,
    },
  });

  return res.json({ ok: true, addon });
});

router.put("/ai/store/addons/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.addons.update", { id: req.params.id, payload });

  await prisma.storeShowAddOn.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      mode: payload.mode || undefined,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : undefined,
      maxPerOrder: parseIntOrNull(payload.maxPerOrder),
      sortOrder: parseIntOrNull(payload.sortOrder) || 0,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/store/addons/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("store.addons.delete", { id });

  await prisma.storeShowAddOn.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/store/bundles", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("store.bundles.list", { organiserId });
  const bundles = await prisma.storeBundleRule.findMany({
    where: { organiserId },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, bundles });
});

router.post("/ai/store/bundles", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.bundles.create", payload);

  const bundle = await prisma.storeBundleRule.create({
    data: {
      organiserId,
      name: payload.name,
      showId: payload.showId || null,
      productIdsJson: payload.productIdsJson || [],
      discountType: payload.discountType || "FIXED",
      discountValue: Number(payload.discountValue || 0),
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      isActive: payload.isActive !== false,
    },
  });

  return res.json({ ok: true, bundle });
});

router.put("/ai/store/bundles/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.bundles.update", { id: req.params.id, payload });

  await prisma.storeBundleRule.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      showId: payload.showId || null,
      productIdsJson: payload.productIdsJson || undefined,
      discountType: payload.discountType || undefined,
      discountValue: payload.discountValue !== undefined ? Number(payload.discountValue) : undefined,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : undefined,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/store/bundles/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("store.bundles.delete", { id });

  await prisma.storeBundleRule.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/store/tax-rates", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("store.tax.list", { organiserId });
  const rates = await prisma.storeTaxRate.findMany({ where: { organiserId }, orderBy: { createdAt: "desc" } });
  return res.json({ ok: true, rates });
});

router.post("/ai/store/tax-rates", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.tax.create", payload);

  const rate = await prisma.storeTaxRate.create({
    data: {
      organiserId,
      name: payload.name,
      rateBps: Number(payload.rateBps || 0),
      isDefault: Boolean(payload.isDefault),
    },
  });

  return res.json({ ok: true, rate });
});

router.put("/ai/store/tax-rates/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.tax.update", { id: req.params.id, payload });

  await prisma.storeTaxRate.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      rateBps: payload.rateBps !== undefined ? Number(payload.rateBps) : undefined,
      isDefault: payload.isDefault !== undefined ? Boolean(payload.isDefault) : undefined,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/store/tax-rates/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("store.tax.delete", { id });

  await prisma.storeTaxRate.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/store/fulfilment", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("store.fulfilment.list", { organiserId });
  const methods = await prisma.storeFulfilmentMethod.findMany({ where: { organiserId }, orderBy: { createdAt: "desc" } });
  return res.json({ ok: true, methods });
});

router.post("/ai/store/fulfilment", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.fulfilment.create", payload);

  const method = await prisma.storeFulfilmentMethod.create({
    data: {
      organiserId,
      name: payload.name,
      type: payload.type || "COLLECT",
      detailsJson: payload.detailsJson || null,
    },
  });

  return res.json({ ok: true, method });
});

router.put("/ai/store/fulfilment/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("store.fulfilment.update", { id: req.params.id, payload });

  await prisma.storeFulfilmentMethod.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      type: payload.type || undefined,
      detailsJson: payload.detailsJson || null,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/store/fulfilment/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("store.fulfilment.delete", { id });

  await prisma.storeFulfilmentMethod.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/store/recommendations", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const showId = String(req.query.showId || "");
  logRequest("store.recommendations", { showId });

  const show = await prisma.show.findFirst({ where: { id: showId, organiserId } });
  if (!show) return res.status(404).json({ ok: false, error: "Show not found" });

  const orders = await prisma.order.findMany({
    where: { showId, status: "PAID" },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  const items = await prisma.productOrderItem.findMany({
    where: { productOrder: { orderId: { in: orderIds } } },
    select: { productId: true, qty: true, lineTotalPence: true },
  });

  const productMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const existing = productMap.get(item.productId) || { qty: 0, revenue: 0 };
    existing.qty += item.qty;
    existing.revenue += item.lineTotalPence;
    productMap.set(item.productId, existing);
  }

  const productIds = Array.from(productMap.keys());
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productNameMap = new Map(products.map((p) => [p.id, p.title]));

  const recommendations = productIds
    .map((id) => ({
      productId: id,
      title: productNameMap.get(id) || "Unknown",
      qty: productMap.get(id)?.qty || 0,
      revenuePence: productMap.get(id)?.revenue || 0,
      attachRate: orders.length ? (productMap.get(id)?.qty || 0) / orders.length : 0,
    }))
    .sort((a, b) => b.revenuePence - a.revenuePence)
    .slice(0, 5);

  return res.json({ ok: true, recommendations });
});

function deriveCategory(text: string): SupportTicketCategory {
  const lower = text.toLowerCase();
  if (lower.includes("resend")) return "RESEND";
  if (lower.includes("seat") || lower.includes("access")) return "SEATING";
  if (lower.includes("refund") || lower.includes("exchange")) return "REFUND";
  if (lower.includes("payment") || lower.includes("card")) return "PAYMENT";
  if (lower.includes("venue") || lower.includes("parking")) return "VENUE";
  return "OTHER";
}

function derivePriority(text: string): SupportTicketPriority {
  const lower = text.toLowerCase();
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("today")) return "HIGH";
  if (lower.includes("soon")) return "MED";
  return "LOW";
}

router.get("/ai/support/tickets", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  logRequest("support.tickets.list", { organiserId, status });

  const tickets = await prisma.supportTicket.findMany({
    where: { organiserId, status: status as SupportTicketStatus || undefined },
    include: { order: true, show: true },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ ok: true, tickets });
});

router.get("/ai/support/tickets/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("support.tickets.detail", { id });

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, organiserId },
    include: { messages: true, order: true, show: true, triageResults: true, suggestedReplies: true },
  });

  if (!ticket) return res.status(404).json({ ok: false, error: "Ticket not found" });
  return res.json({ ok: true, ticket });
});

router.post("/ai/support/tickets", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("support.tickets.create", payload);

  const subject = String(payload.subject || "").trim();
  if (!subject) return res.status(400).json({ ok: false, error: "Subject required" });

  const ticket = await prisma.supportTicket.create({
    data: {
      organiserId,
      customerId: payload.customerId || null,
      orderId: payload.orderId || null,
      showId: payload.showId || null,
      subject,
      category: payload.category || deriveCategory(subject),
      status: payload.status || "OPEN",
      priority: payload.priority || derivePriority(subject),
    },
  });

  if (payload.message) {
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "CUSTOMER",
        body: String(payload.message),
      },
    });
  }

  return res.json({ ok: true, ticket });
});

router.patch("/ai/support/tickets/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("support.tickets.update", { id: req.params.id, payload });

  await prisma.supportTicket.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      subject: payload.subject || undefined,
      category: payload.category || undefined,
      status: payload.status || undefined,
      priority: payload.priority || undefined,
    },
  });

  return res.json({ ok: true });
});

router.post("/ai/support/tickets/:id/message", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  const payload = req.body || {};
  logRequest("support.tickets.message", { id, payload });

  const ticket = await prisma.supportTicket.findFirst({ where: { id, organiserId } });
  if (!ticket) return res.status(404).json({ ok: false, error: "Ticket not found" });

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: id,
      senderType: payload.senderType || "STAFF",
      body: String(payload.body || ""),
      metaJson: payload.metaJson || null,
    },
  });

  return res.json({ ok: true, message });
});

router.post("/ai/support/tickets/:id/triage", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("support.tickets.triage", { id });

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, organiserId },
    include: { messages: true },
  });
  if (!ticket) return res.status(404).json({ ok: false, error: "Ticket not found" });

  const text = [ticket.subject, ...ticket.messages.map((m) => m.body)].join(" ");
  const suggestedCategory = deriveCategory(text);
  const suggestedPriority = derivePriority(text);
  const suggestedNextStep = suggestedCategory === "RESEND" ? "Resend tickets" : "Review details";

  const triage = await prisma.supportTriageResult.create({
    data: {
      ticketId: id,
      suggestedCategory,
      suggestedPriority,
      suggestedNextStep,
    },
  });

  return res.json({ ok: true, triage });
});

router.get("/ai/support/tickets/:id/suggested-reply", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("support.tickets.suggested-reply", { id });

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, organiserId },
    include: { order: true, show: { include: { venue: true } } },
  });
  if (!ticket) return res.status(404).json({ ok: false, error: "Ticket not found" });

  const showTitle = ticket.show?.title || "your show";
  const showDate = ticket.show?.date ? ticket.show.date.toLocaleDateString("en-GB") : "";
  const venue = ticket.show?.venue?.name || "the venue";
  const orderRef = ticket.order?.id || "";

  const draftBody =
    `Hi there,\n\nThanks for getting in touch about ${showTitle}. ` +
    (showDate ? `The show date is ${showDate} at ${venue}. ` : "") +
    (orderRef ? `Your order reference is ${orderRef}. ` : "") +
    `We'll look into this now and come back with the next steps.\n\nBest,\nSupport`;

  const reply = await prisma.supportSuggestedReply.create({
    data: {
      ticketId: id,
      draftBody,
    },
  });

  return res.json({ ok: true, reply });
});

router.get("/ai/chatbot/knowledge", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("chatbot.knowledge.list", { organiserId });
  const items = await prisma.chatbotKnowledgeSource.findMany({
    where: { organiserId },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, items });
});

router.post("/ai/chatbot/knowledge", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("chatbot.knowledge.create", payload);

  const item = await prisma.chatbotKnowledgeSource.create({
    data: {
      organiserId,
      type: payload.type || "FAQ",
      title: payload.title || "",
      content: payload.content || "",
      isActive: payload.isActive !== false,
    },
  });

  return res.json({ ok: true, item });
});

router.put("/ai/chatbot/knowledge/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("chatbot.knowledge.update", { id: req.params.id, payload });

  await prisma.chatbotKnowledgeSource.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      type: payload.type || undefined,
      title: payload.title || undefined,
      content: payload.content || undefined,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : undefined,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/chatbot/knowledge/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("chatbot.knowledge.delete", { id });
  await prisma.chatbotKnowledgeSource.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/chatbot/rules", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("chatbot.rules.list", { organiserId });
  const items = await prisma.chatbotEscalationRule.findMany({
    where: { organiserId },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ ok: true, items });
});

router.post("/ai/chatbot/rules", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("chatbot.rules.create", payload);

  const item = await prisma.chatbotEscalationRule.create({
    data: {
      organiserId,
      name: payload.name || "",
      matchJson: payload.matchJson || {},
      actionJson: payload.actionJson || {},
      isActive: payload.isActive !== false,
    },
  });

  return res.json({ ok: true, item });
});

router.put("/ai/chatbot/rules/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const payload = req.body || {};
  logRequest("chatbot.rules.update", { id: req.params.id, payload });

  await prisma.chatbotEscalationRule.updateMany({
    where: { id: String(req.params.id), organiserId },
    data: {
      name: payload.name || undefined,
      matchJson: payload.matchJson || undefined,
      actionJson: payload.actionJson || undefined,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : undefined,
    },
  });

  return res.json({ ok: true });
});

router.delete("/ai/chatbot/rules/:id", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("chatbot.rules.delete", { id });
  await prisma.chatbotEscalationRule.deleteMany({ where: { id, organiserId } });
  return res.json({ ok: true });
});

router.get("/ai/chatbot/transcripts", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  logRequest("chatbot.transcripts.list", { organiserId });
  const transcripts = await prisma.chatbotTranscript.findMany({
    where: { organiserId },
    orderBy: { startedAt: "desc" },
  });
  return res.json({ ok: true, transcripts });
});

router.post("/ai/chatbot/transcripts/:id/flag-conversion-helped", requireAdminOrOrganiser, async (req, res) => {
  const organiserId = organiserIdFor(req);
  const id = String(req.params.id);
  logRequest("chatbot.transcripts.flag", { id });

  await prisma.chatbotTranscript.updateMany({
    where: { id, organiserId },
    data: { conversionHelped: true },
  });
  return res.json({ ok: true });
});

export default router;
