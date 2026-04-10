import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const SESSION_DAYS = 30;
const COOKIE_NAME = 'drift_session';

function createSession(userId: number): string {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(sessionId, userId, expiresAt);
  return sessionId;
}

function setCookie(res: Response, sessionId: string) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

// POST /api/users/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, inviteCode } = req.body as {
    username?: string;
    password?: string;
    inviteCode?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: 'username y password son requeridos' });
    return;
  }
  if (username.length < 3 || username.length > 30) {
    res.status(400).json({ error: 'El username debe tener entre 3 y 30 caracteres' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    return;
  }

  // Bootstrap: si no hay usuarios, el primero puede registrarse sin invite code
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const isBootstrap = userCount === 0;

  if (!isBootstrap) {
    if (!inviteCode) {
      res.status(403).json({ error: 'Se requiere un invite code' });
      return;
    }
    const invite = db.prepare(
      'SELECT code FROM invite_codes WHERE code = ? AND used_by IS NULL'
    ).get(inviteCode) as { code: string } | undefined;

    if (!invite) {
      res.status(403).json({ error: 'Invite code inválido o ya utilizado' });
      return;
    }
  }

  // Verificar que el username no esté tomado
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'El username ya está en uso' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    const result = insertUser.run(username, passwordHash);
    const userId = result.lastInsertRowid as number;

    // Marcar el invite code como usado
    if (!isBootstrap && inviteCode) {
      db.prepare(
        "UPDATE invite_codes SET used_by = ?, used_at = datetime('now') WHERE code = ?"
      ).run(userId, inviteCode);
    }

    return userId;
  });

  const userId = tx() as number;
  const sessionId = createSession(userId);
  setCookie(res, sessionId);

  res.json({ ok: true, username });
});

// POST /api/users/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username y password son requeridos' });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, password_hash FROM users WHERE username = ?'
  ).get(username) as { id: number; username: string; password_hash: string } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const sessionId = createSession(user.id);
  setCookie(res, sessionId);

  res.json({ ok: true, username: user.username });
});

// POST /api/users/logout
router.post('/logout', (req: Request, res: Response) => {
  const sessionId = (req as any).cookies?.[COOKIE_NAME];
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// GET /api/users/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});

// GET /api/users/has-users — saber si hay usuarios registrados (para UI de registro)
router.get('/has-users', (_req: Request, res: Response) => {
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  res.json({ hasUsers: count > 0 });
});

// POST /api/users/invite — crear invite code (solo usuario autenticado)
router.post('/invite', requireAuth, (req: AuthRequest, res: Response) => {
  const code = randomUUID().split('-')[0].toUpperCase(); // ej: "A1B2C3D4"
  db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(code);
  res.json({ code });
});

export default router;
