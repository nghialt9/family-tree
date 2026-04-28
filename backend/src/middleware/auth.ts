import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

function extractUser(req: AuthRequest): JwtPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7));
  } catch {
    return null;
  }
}

export function requireViewer(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  req.user = user;
  next();
}

export function requireEditor(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (user.role === 'viewer') { res.status(403).json({ error: 'Forbidden' }); return; }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (user.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  req.user = user;
  next();
}
