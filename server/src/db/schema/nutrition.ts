import { pgTable, serial, text, integer, index } from 'drizzle-orm/pg-core';
import { training_plans } from './training.js';

export const nutrition_logs = pgTable('nutrition_logs', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  logged_at: text('logged_at'),
  meal_slot: text('meal_slot'),
  meal_name: text('meal_name'),
  description: text('description'),
  calories: integer('calories'),
  protein_g: integer('protein_g'),
  carbs_g: integer('carbs_g'),
  fat_g: integer('fat_g'),
  fiber_g: integer('fiber_g'),
  image_path: text('image_path'),
  ai_model: text('ai_model'),
  ai_confidence: text('ai_confidence'),
  raw_ai_response: text('raw_ai_response'),
}, (table) => [
  index('idx_nutrition_logs_date').on(table.date),
]);

export const nutrition_plans = pgTable('nutrition_plans', {
  id: serial('id').primaryKey(),
  training_plan_id: integer('training_plan_id').references(() => training_plans.id),
  title: text('title'),
  daily_calories: integer('daily_calories'),
  daily_protein_g: integer('daily_protein_g'),
  daily_carbs_g: integer('daily_carbs_g'),
  daily_fat_g: integer('daily_fat_g'),
  strategy: text('strategy'),
  rationale: text('rationale'),
  ai_model: text('ai_model'),
  raw_ai_response: text('raw_ai_response'),
  created_at: text('created_at'),
});

export const nutrition_plan_meals = pgTable('nutrition_plan_meals', {
  id: serial('id').primaryKey(),
  plan_id: integer('plan_id').notNull().references(() => nutrition_plans.id, { onDelete: 'cascade' }),
  slot: text('slot'),
  name: text('name'),
  description: text('description'),
  calories: integer('calories'),
  protein_g: integer('protein_g'),
  carbs_g: integer('carbs_g'),
  fat_g: integer('fat_g'),
  option_number: integer('option_number').default(1),
});
