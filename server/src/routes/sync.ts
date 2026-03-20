import { Router } from 'express';
import { syncInitial, isSyncing, lastSync } from '../sync.js';

const router = Router();

router.post('/', async (_req, res) => {
  if (isSyncing) {
    res.json({ message: 'Sync already in progress', lastSync });
    return;
  }

  syncInitial();
  res.json({ message: 'Sync started', lastSync });
});

export default router;
