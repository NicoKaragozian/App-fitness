import { Router } from 'express';
import * as garmin from '../garmin.js';
import { syncInitial, startPeriodicSync, isSyncing, lastSync, signalAbortSync } from '../sync.js';
import db from '../db.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  try {
    await garmin.login(email, password);
    // Start initial sync in background
    syncInitial().then(() => startPeriodicSync());
    res.json({ success: true, message: 'Logged in, syncing data...' });
  } catch (err: any) {
    console.error('Login error:', err);
    const msg = err.message || 'Unknown error';
    if (msg.includes('429')) {
      res.status(429).json({ error: 'Ban temporal de Garmin (429 Too Many Requests). Espera 30 mins o usa un VPN.' });
      return;
    }

    const userMsg = msg.includes('OAuth2') || msg.includes('401')
      ? 'Credenciales incorrectas o Garmin está bloqueando la solicitud.'
      : msg;
    res.status(401).json({ error: userMsg });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    authenticated: garmin.getStatus(),
    syncing: isSyncing,
    lastSync,
  });
});

router.post('/logout', (_req, res) => {
  signalAbortSync();
  garmin.logout();
  try {
    db.prepare('DELETE FROM activities').run();
    db.prepare('DELETE FROM sleep').run();
    db.prepare('DELETE FROM stress').run();
    db.prepare('DELETE FROM hrv').run();
    db.prepare('DELETE FROM daily_summary').run();
    db.prepare('DELETE FROM sync_log').run();
  } catch (err) {
    console.error('DB wipe error on logout:', err);
  }
  res.json({ success: true });
});

export default router;
