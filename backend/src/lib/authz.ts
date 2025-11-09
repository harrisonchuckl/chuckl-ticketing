import { Request, Response, NextFunction } from 'express';

/**
 * Very light placeholder that assumes cookie auth has already happened upstream.
 * Tighten as needed (e.g., check req.user.role).
 */
export function requireAdminOrOrganiser(_req: Request, _res: Response, next: NextFunction) {
  // TODO: implement proper authorisation
  next();
}
