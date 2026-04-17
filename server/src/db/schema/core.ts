import { pgTable, serial, text, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const weekly_plan = pgTable('weekly_plan', {
  id: serial('id').primaryKey(),
  day: text('day').notNull(),
  sport: text('sport').notNull(),
  detail: text('detail'),
  completed: boolean('completed').default(false).notNull(),
  created_at: text('created_at'),
  plan_id: integer('plan_id'),
  session_id: integer('session_id'),
});

export const ai_cache = pgTable('ai_cache', {
  cache_key: text('cache_key').primaryKey(),
  mode: text('mode').notNull(),
  content: text('content').notNull(),
  model: text('model').notNull().default(''),
  created_at: text('created_at'),
}, (table) => [
  index('idx_ai_cache_mode_created').on(table.mode, table.created_at),
]);

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
});
