import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/client.js';
import { user_profile } from '../db/schema/index.js';
import { computeMacroTargets } from '../lib/macros.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [row] = await db.select().from(user_profile).where(eq(user_profile.id, 1));
  res.json(row ?? null);
});

router.put('/', async (req: Request, res: Response) => {
  const p = req.body;
  const now = new Date().toISOString();

  let macros = {
    daily_calorie_target: p.daily_calorie_target ?? null,
    daily_protein_g: p.daily_protein_g ?? null,
    daily_carbs_g: p.daily_carbs_g ?? null,
    daily_fat_g: p.daily_fat_g ?? null,
  };

  if (!macros.daily_calorie_target && p.sex && p.age && p.weight_kg && p.height_cm) {
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

  const [existing] = await db.select({ onboarded_at: user_profile.onboarded_at }).from(user_profile).where(eq(user_profile.id, 1));

  await db.insert(user_profile).values({
    id: 1,
    has_wearable: Boolean(p.has_wearable ?? false),
    name: p.name ?? null,
    age: p.age ?? null,
    sex: p.sex ?? null,
    height_cm: p.height_cm ?? null,
    weight_kg: p.weight_kg ?? null,
    experience_level: p.experience_level ?? null,
    primary_goal: p.primary_goal ?? null,
    secondary_goals: p.secondary_goals || [],
    sports: p.sports || [],
    training_days_per_week: p.training_days_per_week ?? null,
    session_duration_min: p.session_duration_min ?? null,
    equipment: p.equipment || [],
    injuries: p.injuries ?? null,
    dietary_preferences: p.dietary_preferences || [],
    daily_calorie_target: macros.daily_calorie_target,
    daily_protein_g: macros.daily_protein_g,
    daily_carbs_g: macros.daily_carbs_g,
    daily_fat_g: macros.daily_fat_g,
    onboarded_at: existing?.onboarded_at ?? now,
    updated_at: now,
  }).onConflictDoUpdate({
    target: user_profile.id,
    set: {
      has_wearable: Boolean(p.has_wearable ?? false),
      name: p.name ?? null,
      age: p.age ?? null,
      sex: p.sex ?? null,
      height_cm: p.height_cm ?? null,
      weight_kg: p.weight_kg ?? null,
      experience_level: p.experience_level ?? null,
      primary_goal: p.primary_goal ?? null,
      secondary_goals: p.secondary_goals || [],
      sports: p.sports || [],
      training_days_per_week: p.training_days_per_week ?? null,
      session_duration_min: p.session_duration_min ?? null,
      equipment: p.equipment || [],
      injuries: p.injuries ?? null,
      dietary_preferences: p.dietary_preferences || [],
      daily_calorie_target: macros.daily_calorie_target,
      daily_protein_g: macros.daily_protein_g,
      daily_carbs_g: macros.daily_carbs_g,
      daily_fat_g: macros.daily_fat_g,
      updated_at: now,
    },
  });

  const [updated] = await db.select().from(user_profile).where(eq(user_profile.id, 1));
  res.json(updated);
});

export default router;
