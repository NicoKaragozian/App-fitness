import { Router } from 'express';
import { syncInitial, syncActivitiesOnly, isSyncing, lastSync } from '../sync.js';

const router = Router();

router.post('/', async (_req, res) => {
  if (isSyncing) {
    res.json({ message: 'Sync already in progress', lastSync });
    return;
  }

  syncInitial();
  res.json({ message: 'Sync started', lastSync });
});

// Fast sync — only activities (no sleep/HRV/stress loops)
router.post('/activities', async (_req, res) => {
  if (isSyncing) {
    res.json({ message: 'Sync already in progress', lastSync });
    return;
  }

  try {
    await syncActivitiesOnly();
    res.json({ message: 'Activities synced' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Sync failed' });
  }
});

export default router;
