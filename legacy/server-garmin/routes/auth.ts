import { Router } from 'express';
import * as garmin from '../garmin.js';
import { syncInitial, startPeriodicSync, isSyncing, lastSync, signalAbortSync } from '../sync.js';
import db from '../db.js';

const router = Router();

// Token-based login: carga los tokens OAuth guardados por get-tokens.ts
router.post('/token-login', async (_req, res) => {
  try {
    const ok = await garmin.tryRestoreSession();
    if (!ok) {
      res.status(401).json({ error: 'No se encontraron tokens válidos. Corré npx tsx server/src/get-tokens.ts primero.' });
      return;
    }
    syncInitial().then(() => startPeriodicSync());
    res.json({ success: true, message: 'Sesión restaurada, sincronizando datos...' });
  } catch (err: any) {
    console.error('Token login error:', err);
    res.status(500).json({ error: err.message || 'Error al restaurar sesión' });
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
