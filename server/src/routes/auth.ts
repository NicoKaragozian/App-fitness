import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/auth/status — verifica si hay sesión activa (usada por AuthContext)
router.get('/status', (req, res) => {
  const sessionId = (req as any).cookies?.drift_session;
  if (!sessionId) {
    res.json({ authenticated: false });
    return;
  }
  const session = db.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionId);
  res.json({ authenticated: !!session });
});

export default router;
