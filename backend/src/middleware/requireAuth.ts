// backend/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/auth.js';

declare global {
  // augment Express Request with user
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string | null };
    }
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.auth;
    if (token) {
      const user = await verifyJwt(token);
      req.user = { id: String(user.id), email: String(user.email), name: (user as any).name ?? null };
    }
  } catch {
    // ignore invalid token
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Unauthorised' });
  }
  next();
}
