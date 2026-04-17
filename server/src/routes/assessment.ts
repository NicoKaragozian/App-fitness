import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/client.js';
import { user_assessment } from '../db/schema/index.js';

const router = Router();

const ARRAY_FIELDS = ['goals', 'available_days', 'equipment'];
const ALL_FIELDS = [
  'name', 'age', 'height', 'weight', 'fitness_level',
  'goals', 'goals_other', 'sport_practice', 'sport_name',
  'available_days', 'session_duration', 'equipment', 'equipment_other',
  'injuries_limitations', 'training_preferences', 'past_injuries_detail',
  'time_constraints', 'short_term_goals', 'long_term_goals', 'special_considerations',
] as const;

// GET /api/assessment
router.get('/', async (req, res) => {
  const [row] = await db.select().from(user_assessment).where(eq(user_assessment.id, 1));
  res.json(row ?? null);
});

// PUT /api/assessment
router.put('/', async (req, res) => {
  const body = req.body as Record<string, any>;

  if (!body.name?.toString().trim()) {
    res.status(400).json({ error: 'Name is required' }); return;
  }
  if (!body.age || isNaN(Number(body.age))) {
    res.status(400).json({ error: 'Age is required' }); return;
  }

  const values: Record<string, any> = { id: 1, updated_at: new Date().toISOString() };
  for (const f of ALL_FIELDS) {
    const val = body[f];
    if (val === undefined || val === null || val === '') {
      values[f] = null;
    } else if (ARRAY_FIELDS.includes(f) && Array.isArray(val)) {
      values[f] = val;
    } else {
      values[f] = val;
    }
  }

  await db.insert(user_assessment).values(values as any)
    .onConflictDoUpdate({
      target: user_assessment.id,
      set: { ...values, id: undefined } as any,
    });

  const [row] = await db.select().from(user_assessment).where(eq(user_assessment.id, 1));
  res.json(row);
});

export default router;
