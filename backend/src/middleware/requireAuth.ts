// backend/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
      };
    }
  }
}

const JWT_SECRET = String(process.env.JWT_SECRET || "dev-secret");

// 1 hour inactivity by default; configurable
const SESSION_MS = Number(process.env.AUTH_SESSION_MS || 60 * 60 * 1000);

// Keep cookie secure on Railway (HTTPS), but allow local dev over http
function isSecureCookie(req: Request) {
  // trust proxy should be enabled on Railway; also supports x-forwarded-proto
  const xfProto = String(req.headers["x-forwarded-proto"] || "");
  return process.env.NODE_ENV === "production" || xfProto.includes("https");
}

function signSession(payload: { sub: string; email: string; role: string; name?: string | null }) {
  const seconds = Math.floor(SESSION_MS / 1000);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: seconds });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
}

/**
 * attachUser:
 * - verifies JWT from cookie "auth"
 * - sets req.user
 * - refreshes cookie + JWT expiry on every request (sliding inactivity window)
 */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.auth as string | undefined;
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET) as any;

    const id = String(payload.sub || "");
    const email = String(payload.email || "");
    const role = String(payload.role || "USER");
    const name = payload.name === undefined ? null : (payload.name ?? null);

    if (!id || !email) return next();

    req.user = { id, email, role, name };

    // Sliding expiry: re-issue token + cookie on activity
    const newToken = signSession({ sub: id, email, role, name });
    res.cookie("auth", newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureCookie(req),
      maxAge: SESSION_MS,
      path: "/",
    });
  } catch {
    // invalid/expired token: ignore and treat as logged out
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: true, message: "Unauthorised" });
  }
  next();
}
