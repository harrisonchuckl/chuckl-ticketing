import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const DEFAULT_OWNER_EMAILS = ["harrison@chuckl.co.uk"];

function getOwnerAllowlist(): string[] {
  const raw = process.env.TIXALL_OWNER_EMAILS;
  if (!raw || raw.trim().length === 0) {
    return process.env.NODE_ENV === "production" ? [] : DEFAULT_OWNER_EMAILS;
  }

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;

  const allowlist = getOwnerAllowlist();
  return allowlist.includes(normalized);
}

export function requireSiteOwner(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if (!isOwnerEmail(req.user?.email)) {
      if (req.originalUrl.startsWith("/admin/api/")) {
        return res.status(403).json({ error: true, message: "Forbidden" });
      }
      return res.redirect("/admin/ui");
    }

    next();
  });
}

// Self-test (dev default):
// - process.env.TIXALL_OWNER_EMAILS unset + NODE_ENV !== "production" => isOwnerEmail("harrison@chuckl.co.uk") === true
// - isOwnerEmail("someone@else.com") === false
