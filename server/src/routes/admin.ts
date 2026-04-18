import { Router, Request, Response } from 'express';
import { eq, sql, count } from 'drizzle-orm';
import db from '../db/client.js';
import { requireAdmin } from '../middleware/auth.js';
import { garmin_tokens, user } from '../db/schema/auth.js';
import { activities, sleep, hrv, stress, daily_summary } from '../db/schema/garmin.js';
import { nutrition_logs } from '../db/schema/nutrition.js';
import { training_plans } from '../db/schema/training.js';
import { goals } from '../db/schema/goals.js';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/users — list all users with token status
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    }).from(user);

    const tokensRows = await db.select({ user_id: garmin_tokens.user_id }).from(garmin_tokens);
    const usersWithTokens = new Set(tokensRows.map(r => r.user_id));

    const result = users.map(u => ({
      ...u,
      garminConnected: usersWithTokens.has(u.id),
    }));

    res.json(result);
  } catch (err: any) {
    console.error('[admin] Error listing users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users/:id/summary — per-user data summary
router.get('/users/:id/summary', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const [activitiesCount] = await db.select({ c: count() }).from(activities).where(eq(activities.user_id, id));
    const [sleepCount] = await db.select({ c: count() }).from(sleep)
      .where(sql`${sleep.user_id} = ${id} AND ${sleep.score} IS NOT NULL`);
    const [nutritionCount] = await db.select({ c: count() }).from(nutrition_logs).where(eq(nutrition_logs.user_id, id));
    const [trainingCount] = await db.select({ c: count() }).from(training_plans).where(eq(training_plans.user_id, id));
    const [goalsCount] = await db.select({ c: count() }).from(goals).where(eq(goals.user_id, id));

    const [tokenRow] = await db.select({ updated_at: garmin_tokens.updated_at })
      .from(garmin_tokens).where(eq(garmin_tokens.user_id, id));

    res.json({
      userId: id,
      garminConnected: Boolean(tokenRow),
      lastTokenUpdate: tokenRow?.updated_at ?? null,
      counts: {
        activities: Number(activitiesCount?.c ?? 0),
        sleepNights: Number(sleepCount?.c ?? 0),
        nutritionLogs: Number(nutritionCount?.c ?? 0),
        trainingPlans: Number(trainingCount?.c ?? 0),
        goals: Number(goalsCount?.c ?? 0),
      },
    });
  } catch (err: any) {
    console.error('[admin] Error getting user summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
