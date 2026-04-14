import { Router } from 'express';
import db from '../db.js';

const router = Router();

const ARRAY_FIELDS = ['goals', 'available_days', 'equipment'];
const ALL_FIELDS = [
  'name', 'age', 'height', 'weight', 'fitness_level',
  'goals', 'goals_other', 'sport_practice', 'sport_name',
  'available_days', 'session_duration', 'equipment', 'equipment_other',
  'injuries_limitations', 'training_preferences', 'past_injuries_detail',
  'time_constraints', 'short_term_goals', 'long_term_goals', 'special_considerations',
];

// GET /api/assessment
router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM user_assessment WHERE id = 1').get() as any;
  res.json(row || null);
});

// PUT /api/assessment
router.put('/', (req, res) => {
  const body = req.body as Record<string, any>;

  if (!body.name?.toString().trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  if (!body.age || isNaN(Number(body.age))) {
    return res.status(400).json({ error: 'La edad es requerida' });
  }

  const values = ALL_FIELDS.map(f => {
    const val = body[f];
    if (val === undefined || val === null || val === '') return null;
    if (ARRAY_FIELDS.includes(f) && Array.isArray(val)) return JSON.stringify(val);
    return val;
  });

  db.prepare(`
    INSERT OR REPLACE INTO user_assessment
      (id, ${ALL_FIELDS.join(', ')}, updated_at)
    VALUES
      (1, ${ALL_FIELDS.map(() => '?').join(', ')}, CURRENT_TIMESTAMP)
  `).run(...values);

  const row = db.prepare('SELECT * FROM user_assessment WHERE id = 1').get();
  res.json(row);
});

export default router;
