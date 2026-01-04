import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const STEPUP_COOKIE = "owner_stepup";
const STEPUP_TTL_MS = Number(process.env.OWNER_STEPUP_TTL_MS || 10 * 60 * 1000);
const JWT_SECRET = String(process.env.JWT_SECRET || "dev-secret");

function isSecureCookie(req: Request) {
  const xfProto = String(req.headers["x-forwarded-proto"] || "");
  return process.env.NODE_ENV === "production" || xfProto.includes("https");
}

function signStepUp(userId: string) {
  const seconds = Math.floor(STEPUP_TTL_MS / 1000);
  return jwt.sign({ sub: userId, type: "owner_stepup" }, JWT_SECRET, { expiresIn: seconds });
}

function verifyStepUp(token: string, userId: string) {
  const payload = jwt.verify(token, JWT_SECRET) as any;
  return payload?.type === "owner_stepup" && String(payload.sub || "") === userId;
}

export function setOwnerStepUpCookie(req: Request, res: Response, userId: string) {
  const token = signStepUp(userId);
  res.cookie(STEPUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(req),
    maxAge: STEPUP_TTL_MS,
    path: "/admin",
  });
}

export function requireOwnerStepUp(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: true, message: "Unauthorised" });
  }

  const token = req.cookies?.[STEPUP_COOKIE];
  if (!token) {
    return res
      .status(403)
      .json({ error: true, message: "Step-up required", stepUpRequired: true });
  }

  try {
    if (!verifyStepUp(String(token), req.user.id)) {
      return res
        .status(403)
        .json({ error: true, message: "Step-up required", stepUpRequired: true });
    }
  } catch {
    return res
      .status(403)
      .json({ error: true, message: "Step-up required", stepUpRequired: true });
  }

  next();
}
