import { Router } from "express";
import * as bcryptNS from "bcryptjs";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { requireSiteOwner } from "../lib/owner-authz.js";
import { setOwnerStepUpCookie } from "../lib/owner-stepup.js";
import { logAdminAudit } from "../lib/admin-audit.js";

const router = Router();
const bcrypt: any = (bcryptNS as any).default ?? bcryptNS;

router.get("/owner", requireAdminOrOrganiser, requireSiteOwner, (_req, res) => {
  const response = {
    ok: true,
    message: "Owner console endpoint ready.",
  };
  console.log("[admin-owner] response", response);
  return res.json(response);
});

router.post("/owner/step-up", requireSiteOwner, async (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(400).json({ error: true, message: "Password required" });
  }

  const actorId = req.user?.id || null;
  const actorEmail = req.user?.email || null;

  try {
    const user = await prisma.user.findUnique({ where: { id: actorId || "" } });
    if (!user || !user.passwordHash) {
      await logAdminAudit({
        actorUserId: actorId,
        actorEmail,
        action: "OWNER_STEP_UP",
        metadataJson: { status: "failed" },
        req,
      });
      return res.status(400).json({ error: true, message: "Invalid user" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await logAdminAudit({
        actorUserId: actorId,
        actorEmail,
        action: "OWNER_STEP_UP",
        metadataJson: { status: "failed" },
        req,
      });
      return res.status(401).json({ error: true, message: "Invalid credentials" });
    }

    setOwnerStepUpCookie(req, res, user.id);
    await logAdminAudit({
      actorUserId: actorId,
      actorEmail,
      action: "OWNER_STEP_UP",
      metadataJson: { status: "success" },
      req,
    });

    return res.json({ ok: true });
  } catch (error) {
    await logAdminAudit({
      actorUserId: actorId,
      actorEmail,
      action: "OWNER_STEP_UP",
      metadataJson: { status: "error" },
      req,
    });
    return res.status(500).json({ error: true, message: "Failed to confirm step-up" });
  }
});

router.get("/owner/audit-logs", requireSiteOwner, async (req, res) => {
  const action = req.query.action ? String(req.query.action).trim() : "";
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 25) || 25));

  const where: any = {};
  if (action) where.action = action;
  if (from && !Number.isNaN(from.getTime())) where.createdAt = { gte: from };
  if (to && !Number.isNaN(to.getTime())) {
    where.createdAt = { ...(where.createdAt || {}), lte: to };
  }

  const [total, items] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map((item) => ({
      id: item.id,
      actorEmail: item.actorEmail,
      action: item.action,
      targetType: item.targetType,
      targetId: item.targetId,
      metadataJson: item.metadataJson,
      ip: item.ip,
      userAgent: item.userAgent,
      createdAt: item.createdAt,
    })),
  });
});

export default router;
