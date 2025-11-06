// backend/src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ck_session';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_change_me');

export type Session = {
  uid: number;
  email: string;
  role: 'SUPERADMIN' | 'ORGANISER';
};

export async function createSessionCookie(res: Response, session: Session) {
  const token = await new SignJWT(session as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const secure = (process.env.SESSION_COOKIE_SECURE || 'true') === 'true';
  const domain = (process.env.SESSION_COOKIE_DOMAIN || undefined) || undefined;

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    domain,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  const secure = (process.env.SESSION_COOKIE_SECURE || 'true') === 'true';
  const domain = (process.env.SESSION_COOKIE_DOMAIN || undefined) || undefined;
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    domain,
    path: '/',
  });
}

export async function readSession(req: Request): Promise<Session | null> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const s = payload as unknown as Session;
    // (optional) re-check user still exists
    const user = await prisma.user.findUnique({ where: { id: s.uid } });
    if (!user) return null;
    return { uid: user.id, email: user.email, role: user.role as Session['role'] };
  } catch {
    return null;
  }
}

declare global {
  // augment Express Request
  namespace Express {
    interface Request {
      session?: Session | null;
    }
  }
}

export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  req.session = await readSession(req);
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return res.status(401).json({ error: true, message: 'Unauthenticated' });
  }
  next();
}

// Helpers to check venue permissions
export async function userHasVenueAccess(userId: number, venueId: number) {
  const link = await prisma.userVenue.findUnique({
    where: { userId_venueId: { userId, venueId } },
  });
  return !!link;
}
