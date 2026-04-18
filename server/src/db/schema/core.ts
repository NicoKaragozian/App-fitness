import { pgTable, serial, text, integer, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const weekly_plan = pgTable('weekly_plan', {
  id: serial('id').primaryKey(),
  day: text('day').notNull(),
  sport: text('sport').notNull(),
  detail: text('detail'),
  completed: boolean('completed').default(false).notNull(),
  created_at: text('created_at'),
  plan_id: integer('plan_id'),
  session_id: integer('session_id'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// ai_cache: cache_key remains text PK; routes prefix key with userId for isolation
export const ai_cache = pgTable('ai_cache', {
  cache_key: text('cache_key').primaryKey(),
  mode: text('mode').notNull(),
  content: text('content').notNull(),
  model: text('model').notNull().default(''),
  created_at: text('created_at'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_ai_cache_mode_created').on(table.mode, table.created_at),
  index('idx_ai_cache_user_key').on(table.user_id, table.cache_key),
]);

// sport_groups: id is text slug; user_id + id together identify a group uniquely
// New sport groups created via seed use user-prefixed ids to avoid PK collision
export const sport_groups = pgTable('sport_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  color: text('color').notNull().default('#6a9cff'),
  icon: text('icon').notNull().default('◎'),
  sport_types: jsonb('sport_types').notNull().$type<string[]>(),
  metrics: jsonb('metrics').notNull().$type<string[]>(),
  chart_metrics: jsonb('chart_metrics').notNull().default([]).$type<{ dataKey: string; name: string; type: string }[]>(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_sport_groups_user_id').on(table.user_id),
]);
