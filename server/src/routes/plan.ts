import { Router } from 'express';
import { eq, asc, and } from 'drizzle-orm';
import db from '../db/client.js';
import { weekly_plan } from '../db/schema/index.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

router.get('/', async (req, res) => {
  const { userId } = req;
  try {
    const items = await db.select().from(weekly_plan)
      .where(eq(weekly_plan.user_id, userId))
      .orderBy(asc(weekly_plan.created_at));
    res.json(items);
  } catch (error) {
    console.error('Failed to get plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { userId } = req;
  const { day, sport, detail, plan_id, session_id } = req.body;
  if (!day || !sport) { res.status(400).json({ error: 'Missing day or sport' }); return; }

  try {
    const [item] = await db.insert(weekly_plan).values({
      day,
      sport,
      detail: detail || '',
      completed: false,
      plan_id: plan_id ?? null,
      session_id: session_id ?? null,
      created_at: new Date().toISOString(),
      user_id: userId,
    }).returning();

    res.json({
      id: item.id,
      day: item.day,
      sport: item.sport,
      detail: item.detail || '',
      completed: item.completed,
      plan_id: item.plan_id ?? null,
      session_id: item.session_id ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { userId } = req;
  const { id } = req.params;
  const { day, sport, detail, completed, plan_id, session_id } = req.body;

  try {
    const updates: Partial<typeof weekly_plan.$inferInsert> = {};
    if (day !== undefined) updates.day = day;
    if (sport !== undefined) updates.sport = sport;
    if (detail !== undefined) updates.detail = detail;
    if (completed !== undefined) updates.completed = Boolean(completed);
    if (plan_id !== undefined) updates.plan_id = plan_id;
    if (session_id !== undefined) updates.session_id = session_id;

    await db.update(weekly_plan).set(updates)
      .where(and(eq(weekly_plan.id, parseInt(id)), eq(weekly_plan.user_id, userId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { userId } = req;
  const { id } = req.params;
  try {
    await db.delete(weekly_plan)
      .where(and(eq(weekly_plan.id, parseInt(id)), eq(weekly_plan.user_id, userId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
