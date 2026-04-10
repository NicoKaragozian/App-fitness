import { Request, Response, NextFunction } from 'express';
import db from '../db.js';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const sessionId = (req as any).cookies?.drift_session;
  if (!sessionId) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const session = db.prepare(`
    SELECT s.user_id, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(sessionId) as { user_id: number; username: string } | undefined;

  if (!session) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return;
  }

  req.userId = session.user_id;
  req.username = session.username;
  next();
}
