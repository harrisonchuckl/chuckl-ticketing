import { Request, Response, NextFunction } from 'express';

/**
 * VERY LIGHT placeholder authZ middlewares.
 * Replace with your real checks (e.g., req.user.role === 'ADMIN') once your auth is wired.
 */

export function requireAdmin(_req: Request, _res: Response, next: NextFunction) {
  // TODO: enforce admin role
  next();
}

export function requireOrganiser(_req: Request, _res: Response, next: NextFunction) {
  // TODO: enforce organiser role
  next();
}

export function requireAdminOrOrganiser(_req: Request, _res: Response, next: NextFunction) {
  // TODO: enforce (admin || organiser)
  next();
}

export default { requireAdmin, requireOrganiser, requireAdminOrOrganiser };
