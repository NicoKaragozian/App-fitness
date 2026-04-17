import { Router } from 'express';
import { eq, asc, sql, count } from 'drizzle-orm';
import db from '../db/client.js';
import { weekly_plan, training_sessions } from '../db/schema/index.js';

const router = Router();

// Get all plan items
router.get('/', async (req, res) => {
  try {
    const items = await db.select().from(weekly_plan).orderBy(asc(weekly_plan.created_at));
    res.json(items);
  } catch (error) {
    console.error('Failed to get plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new item
router.post('/', async (req, res) => {
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

// Update an item
router.put('/:id', async (req, res) => {
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

    await db.update(weekly_plan).set(updates).where(eq(weekly_plan.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(weekly_plan).where(eq(weekly_plan.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initial seeder
router.post('/seed', async (req, res) => {
  const mockPlan = [
    { day: 'MON', sport: 'GYM / STRENGTH', detail: 'UPPER BODY STRENGTH', completed: true },
    { day: 'TUE', sport: 'WINGFOIL', detail: 'TECHNICAL SESSION - WIND 15KT', completed: true },
    { day: 'WED', sport: 'TENNIS', detail: 'MATCH PLAY - 90 MIN', completed: true },
    { day: 'THU', sport: 'GYM / STRENGTH', detail: 'LOWER BODY + CORE', completed: false },
    { day: 'FRI', sport: 'TENNIS', detail: 'TECHNICAL TRAINING', completed: false },
  ];

  try {
    const [{ c }] = await db.select({ c: count() }).from(weekly_plan);
    if (Number(c) === 0) {
      await db.insert(weekly_plan).values(
        mockPlan.map(item => ({ ...item, created_at: new Date().toISOString() }))
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed' });
  }
});

export default router;
