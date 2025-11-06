import type { Request, Response, NextFunction } from 'express';
import { attachSession, requireAuth as baseRequire } from '../lib/auth.js';

export function withAuth() {
  return [attachSession, baseRequire] as Array<(req: Request, res: Response, next: NextFunction) => void>;
}
