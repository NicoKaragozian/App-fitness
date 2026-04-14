import { Router, Request, Response } from 'express';
import db from '../db.js';
import { computeMacroTargets } from '../lib/macros.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  res.json(row || null);
});

router.put('/', (req: Request, res: Response) => {
  const p = req.body;
  const now = new Date().toISOString();

  // Si no tiene targets manuales y tiene datos suficientes, calcula automaticamente
  let macros = {
    daily_calorie_target: p.daily_calorie_target ?? null,
    daily_protein_g: p.daily_protein_g ?? null,
    daily_carbs_g: p.daily_carbs_g ?? null,
    daily_fat_g: p.daily_fat_g ?? null,
  };

  if (
    !macros.daily_calorie_target &&
    p.sex && p.age && p.weight_kg && p.height_cm
  ) {
    const computed = computeMacroTargets({
      sex: p.sex,
      age: p.age,
      weight_kg: p.weight_kg,
      height_cm: p.height_cm,
      training_days_per_week: p.training_days_per_week || 3,
      primary_goal: p.primary_goal || 'maintain',
    });
    macros = computed;
  }

  db.prepare(`
    INSERT INTO user_profile (
      id, has_wearable, name, age, sex, height_cm, weight_kg,
      experience_level, primary_goal, secondary_goals, sports, training_days_per_week,
      session_duration_min, equipment, injuries, dietary_preferences,
      daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g,
      onboarded_at, updated_at
    ) VALUES (
      1, @has_wearable, @name, @age, @sex, @height_cm, @weight_kg,
      @experience_level, @primary_goal, @secondary_goals, @sports, @training_days_per_week,
      @session_duration_min, @equipment, @injuries, @dietary_preferences,
      @daily_calorie_target, @daily_protein_g, @daily_carbs_g, @daily_fat_g,
      COALESCE((SELECT onboarded_at FROM user_profile WHERE id=1), @now), @now
    )
    ON CONFLICT(id) DO UPDATE SET
      has_wearable=excluded.has_wearable, name=excluded.name, age=excluded.age,
      sex=excluded.sex, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg,
      experience_level=excluded.experience_level, primary_goal=excluded.primary_goal,
      secondary_goals=excluded.secondary_goals, sports=excluded.sports,
      training_days_per_week=excluded.training_days_per_week,
      session_duration_min=excluded.session_duration_min, equipment=excluded.equipment,
      injuries=excluded.injuries, dietary_preferences=excluded.dietary_preferences,
      daily_calorie_target=excluded.daily_calorie_target,
      daily_protein_g=excluded.daily_protein_g, daily_carbs_g=excluded.daily_carbs_g,
      daily_fat_g=excluded.daily_fat_g, updated_at=excluded.updated_at
  `).run({
    has_wearable: p.has_wearable ?? 0,
    name: p.name ?? null,
    age: p.age ?? null,
    sex: p.sex ?? null,
    height_cm: p.height_cm ?? null,
    weight_kg: p.weight_kg ?? null,
    experience_level: p.experience_level ?? null,
    primary_goal: p.primary_goal ?? null,
    secondary_goals: JSON.stringify(p.secondary_goals || []),
    sports: JSON.stringify(p.sports || []),
    training_days_per_week: p.training_days_per_week ?? null,
    session_duration_min: p.session_duration_min ?? null,
    equipment: JSON.stringify(p.equipment || []),
    injuries: p.injuries ?? null,
    dietary_preferences: JSON.stringify(p.dietary_preferences || []),
    daily_calorie_target: macros.daily_calorie_target,
    daily_protein_g: macros.daily_protein_g,
    daily_carbs_g: macros.daily_carbs_g,
    daily_fat_g: macros.daily_fat_g,
    now,
  });

  const updated = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  res.json(updated);
});

export default router;
