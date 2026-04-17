import { pgTable, serial, text, integer, doublePrecision, boolean, index } from 'drizzle-orm/pg-core';

export const training_plans = pgTable('training_plans', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  objective: text('objective'),
  frequency: text('frequency'),
  status: text('status').notNull().default('active'),
  ai_model: text('ai_model'),
  raw_ai_response: text('raw_ai_response'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
}, (table) => [
  index('idx_training_plans_status').on(table.status),
]);

export const training_sessions = pgTable('training_sessions', {
  id: serial('id').primaryKey(),
  plan_id: integer('plan_id').notNull().references(() => training_plans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  notes: text('notes'),
  type: text('type'),
});

export const training_exercises = pgTable('training_exercises', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id').notNull().references(() => training_sessions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull().default('main'),
  target_sets: integer('target_sets'),
  target_reps: text('target_reps'),
  notes: text('notes'),
  sort_order: integer('sort_order').notNull().default(0),
  description: text('description'),
  type: text('type').default('strength'),
  target_duration_seconds: integer('target_duration_seconds'),
  target_distance_meters: doublePrecision('target_distance_meters'),
  target_pace: text('target_pace'),
});

export const workout_logs = pgTable('workout_logs', {
  id: serial('id').primaryKey(),
  plan_id: integer('plan_id').notNull().references(() => training_plans.id),
  session_id: integer('session_id').notNull().references(() => training_sessions.id),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at'),
  notes: text('notes'),
}, (table) => [
  index('idx_workout_logs_plan_id').on(table.plan_id),
  index('idx_workout_logs_session_id').on(table.session_id),
]);

export const workout_sets = pgTable('workout_sets', {
  id: serial('id').primaryKey(),
  workout_log_id: integer('workout_log_id').notNull().references(() => workout_logs.id, { onDelete: 'cascade' }),
  exercise_id: integer('exercise_id').notNull().references(() => training_exercises.id),
  set_number: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: doublePrecision('weight'),
  completed: boolean('completed').default(false),
  notes: text('notes'),
  duration_seconds: doublePrecision('duration_seconds'),
  distance_meters: doublePrecision('distance_meters'),
}, (table) => [
  index('idx_workout_sets_log_id').on(table.workout_log_id),
  index('idx_workout_sets_exercise_id').on(table.exercise_id),
]);
