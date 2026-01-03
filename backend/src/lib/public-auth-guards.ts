import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

export const publicAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (!origin) return next();
  if (origin === "null") {
    return res.status(403).json({ ok: false, error: "Invalid origin" });
  }

  const host = req.get("host");
  if (!host) return res.status(403).json({ ok: false, error: "Invalid origin" });

  const expected = `${req.protocol}://${host}`;
  if (origin !== expected) {
    return res.status(403).json({ ok: false, error: "Invalid origin" });
  }

  return next();
}
