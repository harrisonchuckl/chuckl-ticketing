import type { Request } from "express";
import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";

export type AdminAuditInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
  req?: Request;
};

export async function logAdminAudit(input: AdminAuditInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadataJson: input.metadataJson ?? null,
        ip: input.req?.ip ?? null,
        userAgent: String(input.req?.headers["user-agent"] || "") || null,
      },
    });
  } catch (error) {
    console.error("[admin-audit] failed", error);
  }
}
