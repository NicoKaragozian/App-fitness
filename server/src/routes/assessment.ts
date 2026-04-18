import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/client.js';
import { user_assessment } from '../db/schema/index.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

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
  const { userId } = req;
  const [row] = await db.select().from(user_assessment).where(eq(user_assessment.user_id, userId));
  res.json(row ?? null);
});

// PUT /api/assessment
router.put('/', async (req, res) => {
  const { userId } = req;
  const body = req.body as Record<string, any>;

  if (!body.name?.toString().trim()) {
    res.status(400).json({ error: 'Name is required' }); return;
  }
  if (!body.age || isNaN(Number(body.age))) {
    res.status(400).json({ error: 'Age is required' }); return;
  }

  const [existing] = await db.select({ id: user_assessment.id })
    .from(user_assessment).where(eq(user_assessment.user_id, userId));

  const values: Record<string, any> = { updated_at: new Date().toISOString(), user_id: userId };
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

  if (existing) {
    await db.update(user_assessment).set(values as any).where(eq(user_assessment.user_id, userId));
  } else {
    const nextId = Date.now();
    await db.insert(user_assessment).values({ id: nextId, ...values } as any);
  }

  const [row] = await db.select().from(user_assessment).where(eq(user_assessment.user_id, userId));
  res.json(row);
});

export default router;
