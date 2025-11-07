// backend/src/lib/authz.ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Simple admin auth middleware.
 * You can later expand this to check roles, JWT, or cookies.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user || !user.isAdmin) {
      return res.status(401).json({ ok: false, message: 'Admin login required' });
    }
    next();
  } catch (err) {
    res.status(401).json({ ok: false, message: 'Unauthorised' });
  }
}
