import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

function normaliseRole(role: string | undefined | null) {
  return String(role || "").trim().toUpperCase();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const role = normaliseRole(req.user?.role);
    if (role !== "ADMIN") return res.status(403).json({ error: true, message: "Forbidden" });
    next();
  });
}

export function requireOrganiser(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const role = normaliseRole(req.user?.role);
    if (role !== "ORGANISER") return res.status(403).json({ error: true, message: "Forbidden" });
    next();
  });
}

export function requireAdminOrOrganiser(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const role = normaliseRole(req.user?.role);
    if (role !== "ADMIN" && role !== "ORGANISER") {
      return res.status(403).json({ error: true, message: "Forbidden" });
    }
    next();
  });
}

export default { requireAdmin, requireOrganiser, requireAdminOrOrganiser };
