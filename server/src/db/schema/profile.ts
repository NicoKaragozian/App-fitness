import { pgTable, integer, text, boolean, doublePrecision, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

// user_id is the real identifier per-user; integer id kept for backward compat with existing rows
export const user_profile = pgTable('user_profile', {
  id: integer('id').primaryKey(),
  has_wearable: boolean('has_wearable').default(false),
  name: text('name'),
  age: integer('age'),
  sex: text('sex'),
  height_cm: integer('height_cm'),
  weight_kg: doublePrecision('weight_kg'),
  experience_level: text('experience_level'),
  primary_goal: text('primary_goal'),
  secondary_goals: jsonb('secondary_goals').$type<string[]>(),
  sports: jsonb('sports').$type<string[]>(),
  training_days_per_week: integer('training_days_per_week'),
  session_duration_min: integer('session_duration_min'),
  equipment: jsonb('equipment').$type<string[]>(),
  injuries: text('injuries'),
  dietary_preferences: jsonb('dietary_preferences'),
  daily_calorie_target: integer('daily_calorie_target'),
  daily_protein_g: integer('daily_protein_g'),
  daily_carbs_g: integer('daily_carbs_g'),
  daily_fat_g: integer('daily_fat_g'),
  onboarded_at: text('onboarded_at'),
  updated_at: text('updated_at'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_user_profile_user_id').on(table.user_id),
]);

export const user_assessment = pgTable('user_assessment', {
  id: integer('id').primaryKey(),
  name: text('name'),
  age: integer('age'),
  height: doublePrecision('height'),
  weight: doublePrecision('weight'),
  fitness_level: text('fitness_level'),
  goals: jsonb('goals').$type<string[]>(),
  goals_other: text('goals_other'),
  sport_practice: text('sport_practice'),
  sport_name: text('sport_name'),
  available_days: jsonb('available_days').$type<string[]>(),
  session_duration: integer('session_duration'),
  equipment: jsonb('equipment').$type<string[]>(),
  equipment_other: text('equipment_other'),
  injuries_limitations: text('injuries_limitations'),
  training_preferences: text('training_preferences'),
  past_injuries_detail: text('past_injuries_detail'),
  time_constraints: text('time_constraints'),
  short_term_goals: text('short_term_goals'),
  long_term_goals: text('long_term_goals'),
  special_considerations: text('special_considerations'),
  updated_at: text('updated_at'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_user_assessment_user_id').on(table.user_id),
]);
