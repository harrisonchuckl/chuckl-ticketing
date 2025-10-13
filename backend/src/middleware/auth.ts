import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/security.js';
export async function requireAuth(req: Request, res: Response, next: NextFunction){
  const auth = req.headers.authorization;
  if(!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = auth.split(' ')[1];
  try{ // @ts-ignore
    req.user = await verifyJwt(token); next();
  } catch{ return res.status(401).json({ error: 'invalid_token' }); }
}
export function requireRole(role: string){
  return (req: Request, res: Response, next: NextFunction) => { // @ts-ignore
    if(req.user?.role !== role) return res.status(403).json({ error: 'forbidden' }); next(); };
}