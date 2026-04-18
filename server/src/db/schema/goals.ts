import { pgTable, serial, text, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  target_date: text('target_date').notNull().default(''),
  status: text('status').notNull().default('active'),
  prerequisites: jsonb('prerequisites').default([]).$type<string[]>(),
  common_mistakes: jsonb('common_mistakes').default([]).$type<string[]>(),
  estimated_timeline: text('estimated_timeline'),
  ai_model: text('ai_model'),
  raw_ai_response: text('raw_ai_response'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_goals_status').on(table.status),
  index('idx_goals_user_id').on(table.user_id),
]);

export const goal_milestones = pgTable('goal_milestones', {
  id: serial('id').primaryKey(),
  goal_id: integer('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  week_number: integer('week_number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  target: text('target'),
  workouts: jsonb('workouts').default([]).$type<string[]>(),
  completed: boolean('completed').default(false),
  completed_at: text('completed_at'),
  sort_order: integer('sort_order').default(0),
  duration: text('duration'),
  tips: jsonb('tips').default([]).$type<string[]>(),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});
