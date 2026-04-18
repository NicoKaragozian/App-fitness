import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

// Augment Express Request to carry userId / userRole
declare global {
  namespace Express {
    interface Request {
      userId: string;
      userRole: string;
    }
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionData = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!sessionData?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.userId = sessionData.user.id;
  req.userRole = (sessionData.user as any).role ?? 'user';
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionData = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!sessionData?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const role = (sessionData.user as any).role ?? 'user';
  if (role !== 'admin') {
    res.status(403).json({ error: 'Forbidden — admin only' });
    return;
  }
  req.userId = sessionData.user.id;
  req.userRole = role;
  next();
}

export async function optionalUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionData = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (sessionData?.user) {
    req.userId = sessionData.user.id;
    req.userRole = (sessionData.user as any).role ?? 'user';
  }
  next();
}
