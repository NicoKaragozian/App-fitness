#!/usr/bin/env tsx
/**
 * migrate-sqlite-to-postgres.ts
 *
 * Migrates app-generated data from the local SQLite database to Neon Postgres.
 * Garmin data (activities, sleep, hrv, stress, daily_summary) is intentionally
 * excluded — it will be re-fetched by syncInitial() on first login.
 *
 * Tables migrated:
 *   user_profile, user_assessment, sport_groups, weekly_plan,
 *   training_plans → training_sessions → training_exercises,
 *   workout_logs → workout_sets,
 *   goals → goal_milestones,
 *   nutrition_plans → nutrition_plan_meals, nutrition_logs
 *
 * Usage:
 *   DB_PATH=/path/to/drift.db DATABASE_URL=... npx tsx server/scripts/migrate-sqlite-to-postgres.ts
 *   (or run with the .env already loaded)
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import db from '../src/db/client.js';
import {
  user_profile, user_assessment,
} from '../src/db/schema/profile.js';
import {
  sport_groups, weekly_plan,
} from '../src/db/schema/core.js';
import {
  training_plans, training_sessions, training_exercises,
  workout_logs, workout_sets,
} from '../src/db/schema/training.js';
import {
  nutrition_plans, nutrition_plan_meals, nutrition_logs,
} from '../src/db/schema/nutrition.js';
import {
  goals, goal_milestones,
} from '../src/db/schema/goals.js';

const SQLITE_PATH = process.env.DB_PATH || './drift.db';
console.log(`[migrate] Opening SQLite at: ${SQLITE_PATH}`);
const sqlite = new Database(SQLITE_PATH, { readonly: true });

function get<T>(query: string, params: any[] = []): T[] {
  return sqlite.prepare(query).all(...params) as T[];
}

function parseJSON<T>(v: any, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try { return JSON.parse(v); } catch { return fallback; }
}

async function migrateUserProfile() {
  const [row] = get<any>('SELECT * FROM user_profile WHERE id = 1');
  if (!row) { console.log('[migrate] user_profile: empty, skipping'); return; }

  await db.insert(user_profile).values({
    id: 1,
    has_wearable: Boolean(row.has_wearable),
    name: row.name ?? null,
    age: row.age ?? null,
    sex: row.sex ?? null,
    height_cm: row.height_cm ?? null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    experience_level: row.experience_level ?? null,
    primary_goal: row.primary_goal ?? null,
    secondary_goals: parseJSON(row.secondary_goals, []),
    sports: parseJSON(row.sports, []),
    training_days_per_week: row.training_days_per_week ?? null,
    session_duration_min: row.session_duration_min ?? null,
    equipment: parseJSON(row.equipment, []),
    injuries: row.injuries ?? null,
    dietary_preferences: parseJSON(row.dietary_preferences, null),
    daily_calorie_target: row.daily_calorie_target ?? null,
    daily_protein_g: row.daily_protein_g ?? null,
    daily_carbs_g: row.daily_carbs_g ?? null,
    daily_fat_g: row.daily_fat_g ?? null,
    onboarded_at: row.onboarded_at ?? null,
    updated_at: row.updated_at ?? null,
  }).onConflictDoUpdate({
    target: user_profile.id,
    set: {
      has_wearable: Boolean(row.has_wearable),
      name: row.name ?? null,
      age: row.age ?? null,
      sex: row.sex ?? null,
      height_cm: row.height_cm ?? null,
      weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
      experience_level: row.experience_level ?? null,
      primary_goal: row.primary_goal ?? null,
      secondary_goals: parseJSON(row.secondary_goals, []),
      sports: parseJSON(row.sports, []),
      training_days_per_week: row.training_days_per_week ?? null,
      session_duration_min: row.session_duration_min ?? null,
      equipment: parseJSON(row.equipment, []),
      injuries: row.injuries ?? null,
      dietary_preferences: parseJSON(row.dietary_preferences, null),
      daily_calorie_target: row.daily_calorie_target ?? null,
      daily_protein_g: row.daily_protein_g ?? null,
      daily_carbs_g: row.daily_carbs_g ?? null,
      daily_fat_g: row.daily_fat_g ?? null,
      updated_at: row.updated_at ?? null,
    },
  });
  console.log('[migrate] user_profile: done');
}

async function migrateUserAssessment() {
  const [row] = get<any>('SELECT * FROM user_assessment WHERE id = 1');
  if (!row) { console.log('[migrate] user_assessment: empty, skipping'); return; }

  await db.insert(user_assessment).values({
    id: 1,
    name: row.name ?? null,
    age: row.age ?? null,
    height: row.height != null ? Number(row.height) : null,
    weight: row.weight != null ? Number(row.weight) : null,
    fitness_level: row.fitness_level ?? null,
    goals: parseJSON(row.goals, []),
    goals_other: row.goals_other ?? null,
    sport_practice: row.sport_practice ?? null,
    sport_name: row.sport_name ?? null,
    available_days: parseJSON(row.available_days, []),
    session_duration: row.session_duration ?? null,
    equipment: parseJSON(row.equipment, []),
    equipment_other: row.equipment_other ?? null,
    injuries_limitations: row.injuries_limitations ?? null,
    training_preferences: row.training_preferences ?? null,
    past_injuries_detail: row.past_injuries_detail ?? null,
    time_constraints: row.time_constraints ?? null,
    short_term_goals: row.short_term_goals ?? null,
    long_term_goals: row.long_term_goals ?? null,
    special_considerations: row.special_considerations ?? null,
    updated_at: row.updated_at ?? null,
  }).onConflictDoUpdate({
    target: user_assessment.id,
    set: {
      name: row.name ?? null,
      age: row.age ?? null,
      height: row.height != null ? Number(row.height) : null,
      weight: row.weight != null ? Number(row.weight) : null,
      fitness_level: row.fitness_level ?? null,
      goals: parseJSON(row.goals, []),
      goals_other: row.goals_other ?? null,
      sport_practice: row.sport_practice ?? null,
      sport_name: row.sport_name ?? null,
      available_days: parseJSON(row.available_days, []),
      session_duration: row.session_duration ?? null,
      equipment: parseJSON(row.equipment, []),
      equipment_other: row.equipment_other ?? null,
      injuries_limitations: row.injuries_limitations ?? null,
      training_preferences: row.training_preferences ?? null,
      past_injuries_detail: row.past_injuries_detail ?? null,
      time_constraints: row.time_constraints ?? null,
      short_term_goals: row.short_term_goals ?? null,
      long_term_goals: row.long_term_goals ?? null,
      special_considerations: row.special_considerations ?? null,
      updated_at: row.updated_at ?? null,
    },
  });
  console.log('[migrate] user_assessment: done');
}

async function migrateSportGroups() {
  const rows = get<any>('SELECT * FROM sport_groups ORDER BY sort_order');
  if (!rows.length) { console.log('[migrate] sport_groups: empty, skipping'); return; }

  for (const row of rows) {
    await db.insert(sport_groups).values({
      id: row.id,
      name: row.name,
      subtitle: row.subtitle ?? '',
      color: row.color ?? '#6a9cff',
      icon: row.icon ?? '◎',
      sport_types: parseJSON(row.sport_types, []),
      metrics: parseJSON(row.metrics, []),
      chart_metrics: parseJSON(row.chart_metrics, []),
      sort_order: row.sort_order ?? 0,
      created_at: row.created_at ?? null,
    }).onConflictDoUpdate({
      target: sport_groups.id,
      set: {
        name: row.name,
        subtitle: row.subtitle ?? '',
        color: row.color ?? '#6a9cff',
        icon: row.icon ?? '◎',
        sport_types: parseJSON(row.sport_types, []),
        metrics: parseJSON(row.metrics, []),
        chart_metrics: parseJSON(row.chart_metrics, []),
        sort_order: row.sort_order ?? 0,
      },
    });
  }
  console.log(`[migrate] sport_groups: ${rows.length} rows done`);
}

async function migrateWeeklyPlan() {
  const rows = get<any>('SELECT * FROM weekly_plan ORDER BY id');
  if (!rows.length) { console.log('[migrate] weekly_plan: empty, skipping'); return; }

  await db.delete(weekly_plan);
  for (const row of rows) {
    await db.insert(weekly_plan).values({
      day: row.day,
      sport: row.sport,
      detail: row.detail ?? null,
      completed: Boolean(row.completed),
      created_at: row.created_at ?? null,
      plan_id: row.plan_id ?? null,
      session_id: row.session_id ?? null,
    });
  }
  console.log(`[migrate] weekly_plan: ${rows.length} rows done`);
}

async function migrateTraining() {
  const plans = get<any>('SELECT * FROM training_plans ORDER BY id');
  if (!plans.length) { console.log('[migrate] training: empty, skipping'); return; }

  // Map old id → new id
  const planIdMap = new Map<number, number>();

  for (const plan of plans) {
    const [inserted] = await db.insert(training_plans).values({
      title: plan.title,
      objective: plan.objective ?? null,
      frequency: plan.frequency ?? null,
      status: plan.status ?? 'active',
      ai_model: plan.ai_model ?? null,
      raw_ai_response: plan.raw_ai_response ?? null,
      created_at: plan.created_at ?? null,
      updated_at: plan.updated_at ?? null,
    }).returning({ id: training_plans.id });
    planIdMap.set(plan.id, inserted.id);
  }

  const sessionIdMap = new Map<number, number>();
  for (const [oldPlanId, newPlanId] of planIdMap.entries()) {
    const sessions = get<any>('SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY sort_order', [oldPlanId]);
    for (const sess of sessions) {
      const [inserted] = await db.insert(training_sessions).values({
        plan_id: newPlanId,
        name: sess.name,
        sort_order: sess.sort_order ?? 0,
        notes: sess.notes ?? null,
        type: sess.type ?? null,
      }).returning({ id: training_sessions.id });
      sessionIdMap.set(sess.id, inserted.id);
    }
  }

  for (const [oldSessId, newSessId] of sessionIdMap.entries()) {
    const exercises = get<any>('SELECT * FROM training_exercises WHERE session_id = ? ORDER BY sort_order', [oldSessId]);
    if (exercises.length > 0) {
      await db.insert(training_exercises).values(exercises.map(ex => ({
        session_id: newSessId,
        name: ex.name,
        category: ex.category ?? 'main',
        target_sets: ex.target_sets ?? null,
        target_reps: ex.target_reps ?? null,
        notes: ex.notes ?? null,
        sort_order: ex.sort_order ?? 0,
        description: ex.description ?? null,
        type: ex.type ?? 'strength',
        target_duration_seconds: ex.target_duration_seconds ?? null,
        target_distance_meters: ex.target_distance_meters != null ? Number(ex.target_distance_meters) : null,
        target_pace: ex.target_pace ?? null,
      })));
    }
  }

  // Migrate workout_logs and workout_sets
  const exerciseIdMap = new Map<number, number>();
  for (const [oldSessId, newSessId] of sessionIdMap.entries()) {
    const exes = get<any>('SELECT * FROM training_exercises WHERE session_id = ?', [oldSessId]);
    const newExes = await db.select({ id: training_exercises.id })
      .from(training_exercises)
      .where(sql`${training_exercises.session_id} = ${newSessId}`)
      .orderBy(training_exercises.sort_order);
    exes.forEach((ex, i) => {
      if (newExes[i]) exerciseIdMap.set(ex.id, newExes[i].id);
    });
  }

  const logs = get<any>('SELECT * FROM workout_logs ORDER BY id');
  const logIdMap = new Map<number, number>();
  for (const log of logs) {
    const newPlanId = planIdMap.get(log.plan_id);
    const newSessId = sessionIdMap.get(log.session_id);
    if (!newPlanId || !newSessId) continue;

    const [inserted] = await db.insert(workout_logs).values({
      plan_id: newPlanId,
      session_id: newSessId,
      started_at: log.started_at,
      completed_at: log.completed_at ?? null,
      notes: log.notes ?? null,
    }).returning({ id: workout_logs.id });
    logIdMap.set(log.id, inserted.id);
  }

  const sets = get<any>('SELECT * FROM workout_sets ORDER BY id');
  for (const set of sets) {
    const newLogId = logIdMap.get(set.workout_log_id);
    const newExId = exerciseIdMap.get(set.exercise_id);
    if (!newLogId || !newExId) continue;

    await db.insert(workout_sets).values({
      workout_log_id: newLogId,
      exercise_id: newExId,
      set_number: set.set_number,
      reps: set.reps ?? null,
      weight: set.weight != null ? Number(set.weight) : null,
      completed: Boolean(set.completed),
      notes: set.notes ?? null,
      duration_seconds: set.duration_seconds != null ? Number(set.duration_seconds) : null,
      distance_meters: set.distance_meters != null ? Number(set.distance_meters) : null,
    });
  }

  console.log(`[migrate] training: ${plans.length} plans, ${sessionIdMap.size} sessions, ${exerciseIdMap.size} exercises, ${logIdMap.size} workout logs done`);
}

async function migrateGoals() {
  const goalRows = get<any>('SELECT * FROM goals ORDER BY id');
  if (!goalRows.length) { console.log('[migrate] goals: empty, skipping'); return; }

  const goalIdMap = new Map<number, number>();
  for (const g of goalRows) {
    const [inserted] = await db.insert(goals).values({
      title: g.title,
      description: g.description ?? null,
      target_date: g.target_date ?? '',
      status: g.status ?? 'active',
      prerequisites: parseJSON(g.prerequisites, []),
      common_mistakes: parseJSON(g.common_mistakes, []),
      estimated_timeline: g.estimated_timeline ?? null,
      ai_model: g.ai_model ?? null,
      raw_ai_response: g.raw_ai_response ?? null,
      created_at: g.created_at ?? null,
      updated_at: g.updated_at ?? null,
    }).returning({ id: goals.id });
    goalIdMap.set(g.id, inserted.id);
  }

  const milestones = get<any>('SELECT * FROM goal_milestones ORDER BY goal_id, sort_order');
  for (const m of milestones) {
    const newGoalId = goalIdMap.get(m.goal_id);
    if (!newGoalId) continue;
    await db.insert(goal_milestones).values({
      goal_id: newGoalId,
      week_number: m.week_number,
      title: m.title,
      description: m.description ?? null,
      target: m.target ?? null,
      workouts: parseJSON(m.workouts, []),
      completed: Boolean(m.completed),
      completed_at: m.completed_at ?? null,
      sort_order: m.sort_order ?? 0,
      duration: m.duration ?? null,
      tips: parseJSON(m.tips, []),
    });
  }

  console.log(`[migrate] goals: ${goalRows.length} goals, ${milestones.length} milestones done`);
}

async function migrateNutrition() {
  // nutrition_plans
  const plans = get<any>('SELECT * FROM nutrition_plans ORDER BY id');
  const planIdMap = new Map<number, number>();
  for (const p of plans) {
    const [inserted] = await db.insert(nutrition_plans).values({
      title: p.title ?? null,
      daily_calories: p.daily_calories ?? null,
      daily_protein_g: p.daily_protein_g ?? null,
      daily_carbs_g: p.daily_carbs_g ?? null,
      daily_fat_g: p.daily_fat_g ?? null,
      strategy: p.strategy ?? null,
      rationale: p.rationale ?? null,
      ai_model: p.ai_model ?? null,
      raw_ai_response: p.raw_ai_response ?? null,
      created_at: p.created_at ?? null,
    }).returning({ id: nutrition_plans.id });
    planIdMap.set(p.id, inserted.id);
  }

  // nutrition_plan_meals
  const meals = get<any>('SELECT * FROM nutrition_plan_meals ORDER BY plan_id, slot, option_number');
  for (const m of meals) {
    const newPlanId = planIdMap.get(m.plan_id);
    if (!newPlanId) continue;
    await db.insert(nutrition_plan_meals).values({
      plan_id: newPlanId,
      slot: m.slot ?? null,
      name: m.name ?? null,
      description: m.description ?? null,
      calories: m.calories ?? null,
      protein_g: m.protein_g ?? null,
      carbs_g: m.carbs_g ?? null,
      fat_g: m.fat_g ?? null,
      option_number: m.option_number ?? 1,
    });
  }

  // nutrition_logs
  const logs = get<any>('SELECT * FROM nutrition_logs ORDER BY id');
  if (logs.length > 0) {
    for (const l of logs) {
      await db.insert(nutrition_logs).values({
        date: l.date,
        logged_at: l.logged_at ?? null,
        meal_slot: l.meal_slot ?? null,
        meal_name: l.meal_name ?? null,
        description: l.description ?? null,
        calories: l.calories ?? null,
        protein_g: l.protein_g ?? null,
        carbs_g: l.carbs_g ?? null,
        fat_g: l.fat_g ?? null,
        fiber_g: l.fiber_g ?? null,
        image_path: l.image_path ?? null,
        ai_model: l.ai_model ?? null,
        ai_confidence: l.ai_confidence ?? null,
        raw_ai_response: l.raw_ai_response ?? null,
      });
    }
  }

  console.log(`[migrate] nutrition: ${plans.length} plans, ${meals.length} meal options, ${logs.length} logs done`);
}

async function resetSequences() {
  // Reset serial sequences to avoid id collisions if new rows are inserted
  const tables = [
    { table: 'training_plans', seq: 'training_plans_id_seq' },
    { table: 'training_sessions', seq: 'training_sessions_id_seq' },
    { table: 'training_exercises', seq: 'training_exercises_id_seq' },
    { table: 'workout_logs', seq: 'workout_logs_id_seq' },
    { table: 'workout_sets', seq: 'workout_sets_id_seq' },
    { table: 'goals', seq: 'goals_id_seq' },
    { table: 'goal_milestones', seq: 'goal_milestones_id_seq' },
    { table: 'nutrition_plans', seq: 'nutrition_plans_id_seq' },
    { table: 'nutrition_plan_meals', seq: 'nutrition_plan_meals_id_seq' },
    { table: 'nutrition_logs', seq: 'nutrition_logs_id_seq' },
    { table: 'weekly_plan', seq: 'weekly_plan_id_seq' },
  ];

  for (const { table, seq } of tables) {
    await db.execute(sql`SELECT setval(${sql.raw(`'${seq}'`)}, COALESCE((SELECT MAX(id) FROM ${sql.raw(table)}), 1))`);
  }
  console.log('[migrate] sequences reset done');
}

async function main() {
  console.log('[migrate] Starting SQLite → Neon Postgres migration...');
  console.log('[migrate] DATABASE_URL:', process.env.DATABASE_URL?.slice(0, 40) + '...');

  await migrateUserProfile();
  await migrateUserAssessment();
  await migrateSportGroups();
  await migrateWeeklyPlan();
  await migrateTraining();
  await migrateGoals();
  await migrateNutrition();
  await resetSequences();

  console.log('\n[migrate] ✓ Migration complete. Garmin data (activities, sleep, hrv, stress, daily_summary) will be re-synced on first login.');
  sqlite.close();
  process.exit(0);
}

main().catch(err => {
  console.error('[migrate] Fatal error:', err);
  sqlite.close();
  process.exit(1);
});
