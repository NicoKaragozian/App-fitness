import { Router } from 'express';
import * as garmin from '../garmin.js';
import { syncInitial, startPeriodicSync, isSyncing, lastSync, signalAbortSync } from '../sync.js';
import db from '../db/client.js';
import { activities, sleep, stress, hrv, daily_summary, sync_log } from '../db/schema/index.js';

const router = Router();

router.post('/token-login', async (_req, res) => {
  try {
    const ok = await garmin.tryRestoreSession();
    if (!ok) {
      res.status(401).json({ error: 'No valid tokens found. Run npx tsx server/src/get-tokens.ts first.' });
      return;
    }
    syncInitial().then(() => startPeriodicSync());
    res.json({ success: true, message: 'Session restored, syncing data...' });
  } catch (err: any) {
    console.error('Token login error:', err);
    res.status(500).json({ error: err.message || 'Error restoring session' });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    authenticated: garmin.getStatus(),
    syncing: isSyncing,
    lastSync,
  });
});

router.post('/logout', async (_req, res) => {
  signalAbortSync();
  garmin.logout();
  try {
    await db.delete(activities);
    await db.delete(sleep);
    await db.delete(stress);
    await db.delete(hrv);
    await db.delete(daily_summary);
    await db.delete(sync_log);
  } catch (err) {
    console.error('DB wipe error on logout:', err);
  }
  res.json({ success: true });
});

export default router;
