import { Router } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireSiteOwner } from "../lib/owner-authz.js";

const router = Router();

const ORGANISER_TYPES = ["VENUE", "PROMOTER", "ARTIST", "OTHER"] as const;
const SUBSCRIPTION_STATUSES = [
  "NONE",
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const;

type OrganiserType = (typeof ORGANISER_TYPES)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

type OrganiserProfilePayload = {
  organiserType?: OrganiserType;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: string | null;
  subscriptionPeriodEnd?: Date | null;
  permissionsJson?: Prisma.JsonValue | null;
  notes?: string | null;
};

function isOrganiserType(value: any): value is OrganiserType {
  return ORGANISER_TYPES.includes(String(value) as OrganiserType);
}

function isSubscriptionStatus(value: any): value is SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(String(value) as SubscriptionStatus);
}

function normalizeProfile(profile: any) {
  const organiserType = profile?.organiserType || "OTHER";
  const subscriptionStatus = profile?.subscriptionStatus || "NONE";
  return {
    organiserType,
    subscriptionStatus,
    subscriptionPlan: profile?.subscriptionPlan || null,
    subscriptionPeriodEnd: profile?.subscriptionPeriodEnd || null,
    permissionsJson: profile?.permissionsJson || null,
    notes: profile?.notes || null,
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
  };
}

router.get("/owner/organisers", requireSiteOwner, async (req, res) => {
  const search = req.query.search ? String(req.query.search).trim() : "";
  const typeParam = req.query.type ? String(req.query.type).trim().toUpperCase() : "";
  const statusParam = req.query.status ? String(req.query.status).trim().toUpperCase() : "";
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));

  const filters: Prisma.UserWhereInput[] = [];

  if (search) {
    filters.push({
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { tradingName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (typeParam && isOrganiserType(typeParam)) {
    const typeFilter: Prisma.UserWhereInput = {
      OR: [
        { organiserProfile: { is: { organiserType: typeParam } } },
        ...(typeParam === "OTHER" ? [{ organiserProfile: { is: null } }] : []),
      ],
    };
    filters.push(typeFilter);
  }

  if (statusParam && isSubscriptionStatus(statusParam)) {
    const statusFilter: Prisma.UserWhereInput = {
      OR: [
        { organiserProfile: { is: { subscriptionStatus: statusParam } } },
        ...(statusParam === "NONE" ? [{ organiserProfile: { is: null } }] : []),
      ],
    };
    filters.push(statusFilter);
  }

  const where = filters.length ? { AND: filters } : {};

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { organiserProfile: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.json({
    page,
    pageSize,
    total,
    totalPages,
    items: items.map((user) => ({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      organiserProfile: normalizeProfile(user.organiserProfile),
    })),
  });
});

router.get("/owner/organisers/:userId", requireSiteOwner, async (req, res) => {
  const userId = String(req.params.userId || "");
  if (!userId) {
    return res.status(400).json({ error: true, message: "Missing userId" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organiserProfile: true,
      venueMemberships: {
        include: {
          venue: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: true, message: "User not found" });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      platformRole: user.platformRole,
      createdAt: user.createdAt,
    },
    organiserProfile: normalizeProfile(user.organiserProfile),
    venueMemberships: user.venueMemberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      createdAt: membership.createdAt,
      venue: membership.venue,
    })),
  });
});

router.post("/owner/organisers/:userId/profile", requireSiteOwner, async (req, res) => {
  const userId = String(req.params.userId || "");
  if (!userId) {
    return res.status(400).json({ error: true, message: "Missing userId" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: true, message: "User not found" });
  }

  const payload = req.body || {};
  const update: OrganiserProfilePayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, "organiserType")) {
    if (!isOrganiserType(payload.organiserType)) {
      return res.status(400).json({ error: true, message: "Invalid organiser type" });
    }
    update.organiserType = payload.organiserType;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "subscriptionStatus")) {
    if (!isSubscriptionStatus(payload.subscriptionStatus)) {
      return res.status(400).json({ error: true, message: "Invalid subscription status" });
    }
    update.subscriptionStatus = payload.subscriptionStatus;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "subscriptionPlan") ||
    Object.prototype.hasOwnProperty.call(payload, "plan")
  ) {
    const planValue =
      Object.prototype.hasOwnProperty.call(payload, "subscriptionPlan")
        ? payload.subscriptionPlan
        : payload.plan;
    update.subscriptionPlan = planValue ? String(planValue) : null;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "subscriptionPeriodEnd") ||
    Object.prototype.hasOwnProperty.call(payload, "periodEnd")
  ) {
    const periodValue =
      Object.prototype.hasOwnProperty.call(payload, "subscriptionPeriodEnd")
        ? payload.subscriptionPeriodEnd
        : payload.periodEnd;
    if (!periodValue) {
      update.subscriptionPeriodEnd = null;
    } else {
      const parsed = new Date(periodValue);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: true, message: "Invalid period end" });
      }
      update.subscriptionPeriodEnd = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    update.notes = payload.notes ? String(payload.notes) : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "permissionsJson")) {
    update.permissionsJson = payload.permissionsJson || null;
  }

  const profile = await prisma.organiserProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...update,
    },
    update,
  });

  return res.json({
    ok: true,
    organiserProfile: normalizeProfile(profile),
  });
});

export default router;
