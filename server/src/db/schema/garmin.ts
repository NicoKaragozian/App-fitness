import { pgTable, serial, text, integer, doublePrecision, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  garmin_id: text('garmin_id'),
  sport_type: text('sport_type').notNull(),
  category: text('category').notNull(),
  start_time: text('start_time').notNull(),
  duration: integer('duration'),
  distance: doublePrecision('distance'),
  calories: integer('calories'),
  avg_hr: integer('avg_hr'),
  max_speed: doublePrecision('max_speed'),
  raw_json: text('raw_json'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_activities_start_time').on(table.start_time),
  index('idx_activities_user_id').on(table.user_id),
  uniqueIndex('idx_activities_user_garmin').on(table.user_id, table.garmin_id),
]);

export const sleep = pgTable('sleep', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  score: integer('score'),
  duration_seconds: integer('duration_seconds'),
  deep_seconds: integer('deep_seconds'),
  light_seconds: integer('light_seconds'),
  rem_seconds: integer('rem_seconds'),
  awake_seconds: integer('awake_seconds'),
  raw_json: text('raw_json'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_sleep_user_date').on(table.user_id, table.date),
]);

export const hrv = pgTable('hrv', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  nightly_avg: doublePrecision('nightly_avg'),
  status: text('status'),
  raw_json: text('raw_json'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_hrv_user_date').on(table.user_id, table.date),
]);

export const stress = pgTable('stress', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  avg_stress: integer('avg_stress'),
  max_stress: integer('max_stress'),
  raw_json: text('raw_json'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_stress_user_date').on(table.user_id, table.date),
]);

export const daily_summary = pgTable('daily_summary', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  steps: integer('steps'),
  calories: integer('calories'),
  body_battery: integer('body_battery'),
  resting_hr: integer('resting_hr'),
  raw_json: text('raw_json'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_daily_summary_user_date').on(table.user_id, table.date),
]);

export const sync_log = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  sync_type: text('sync_type').notNull(),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at'),
  status: text('status').default('running'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});
