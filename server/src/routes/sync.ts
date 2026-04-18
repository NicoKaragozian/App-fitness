import { Router } from 'express';
import { syncInitial, isSyncing, lastSync, isSyncingForUser, getLastSyncForUser } from '../sync.js';
import { hasTokensForUser } from '../garmin.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

router.post('/', async (req, res) => {
  const { userId } = req;
  const hasTokens = await hasTokensForUser(userId);
  if (!hasTokens) {
    res.status(400).json({ error: 'No Garmin tokens' });
    return;
  }

  if (isSyncingForUser(userId)) {
    res.json({ message: 'Sync already in progress', lastSync: getLastSyncForUser(userId) });
    return;
  }

  syncInitial(userId);
  res.json({ message: 'Sync started', lastSync: getLastSyncForUser(userId) });
});

export default router;
