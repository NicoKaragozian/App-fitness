import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { activities, sleep, stress, hrv, daily_summary, sync_log } from '../db/schema/index.js';
import { garmin_tokens } from '../db/schema/auth.js';
import { deleteTokensForUser, hasTokensForUser } from '../garmin.js';
import { syncInitial as doSyncInitial, signalAbortSync, isSyncing, lastSync } from '../sync.js';
import { requireUser, optionalUser } from '../middleware/auth.js';

const router = Router();

// GET /api/auth/status — public (no auth required)
router.get('/status', optionalUser, async (req, res) => {
  const userId = req.userId;
  let garminConnected = false;
  if (userId) {
    garminConnected = await hasTokensForUser(userId);
  }
  res.json({
    authenticated: !!userId,
    userId: userId ?? null,
    role: req.userRole ?? null,
    garminConnected,
    syncing: isSyncing,
    lastSync,
  });
});

// POST /api/auth/sync-garmin — trigger initial sync for the current user
router.post('/sync-garmin', requireUser, async (req, res) => {
  const { userId } = req;
  const hasTokens = await hasTokensForUser(userId);
  if (!hasTokens) {
    res.status(400).json({ error: 'No Garmin tokens — run get-tokens.ts first' });
    return;
  }
  doSyncInitial(userId);
  res.json({ success: true, message: 'Sync started' });
});

// DELETE /api/garmin/disconnect — remove Garmin tokens + wipe Garmin data for user
router.delete('/garmin-disconnect', requireUser, async (req, res) => {
  const { userId } = req;
  signalAbortSync();
  await deleteTokensForUser(userId);
  try {
    await db.delete(activities).where(eq(activities.user_id, userId));
    await db.delete(sleep).where(eq(sleep.user_id, userId));
    await db.delete(stress).where(eq(stress.user_id, userId));
    await db.delete(hrv).where(eq(hrv.user_id, userId));
    await db.delete(daily_summary).where(eq(daily_summary.user_id, userId));
    await db.delete(sync_log).where(eq(sync_log.user_id, userId));
  } catch (err) {
    console.error('[auth] garmin-disconnect wipe error:', err);
  }
  res.json({ success: true });
});

// POST /api/auth/logout — sign out (Better Auth handles cookie; we just respond)
router.post('/logout', async (_req, res) => {
  // Session invalidation is handled by Better Auth at /api/auth/sign-out
  // This endpoint exists for backward compatibility
  res.json({ success: true });
});

export default router;
