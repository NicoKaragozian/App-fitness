// ai/nutrition-context.ts — Context builders for nutrition (async, Drizzle)

import { desc, eq, and, gte, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { user_profile } from '../db/schema/profile.js';
import { training_plans, training_sessions } from '../db/schema/training.js';
import { activities as activitiesTable } from '../db/schema/garmin.js';
import { nutrition_logs, nutrition_plans, nutrition_plan_meals } from '../db/schema/nutrition.js';

function parseDietPrefs(raw: unknown): string {
  if (!raw) return 'none';
  if (Array.isArray(raw)) return raw.length > 0 ? raw.join(', ') : 'none';
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, any>;
    const lines: string[] = [];
    if (r.diet_type) lines.push(`Diet type: ${r.diet_type}`);
    if (r.allergies?.length > 0) lines.push(`Allergies/intolerances: ${r.allergies.join(', ')}`);
    if (r.excluded_foods) lines.push(`Excluded foods: ${r.excluded_foods}`);
    if (r.preferred_foods) lines.push(`Preferred foods (incorporate, not use exclusively): ${r.preferred_foods}`);
    if (r.meals_per_day) lines.push(`Meals per day: ${r.meals_per_day}`);
    return lines.length > 0 ? '\n' + lines.map(l => `  - ${l}`).join('\n') : 'none';
  }
  return 'none';
}

export async function buildNutritionPlanContext(strategy?: string, userId?: string): Promise<string> {
  const sections: string[] = [];

  const profileQuery = userId
    ? db.select().from(user_profile).where(eq(user_profile.user_id, userId)).limit(1)
    : db.select().from(user_profile).limit(1);
  const [profile] = await profileQuery;

  if (profile) {
    const sports = (profile.sports as string[] | null) ?? [];
    const dietPrefsText = parseDietPrefs(profile.dietary_preferences);

    sections.push(`## User profile
Name: ${profile.name || 'N/A'}
Age: ${profile.age || '-'} years | Sex: ${profile.sex || '-'} | Height: ${profile.height_cm || '-'}cm | Weight: ${profile.weight_kg || '-'}kg
Experience level: ${profile.experience_level || '-'}
Primary goal: ${profile.primary_goal || '-'}
Sports: ${sports.join(', ') || 'not specified'}
Training days per week: ${profile.training_days_per_week || '-'}
Dietary preferences: ${dietPrefsText}
Injuries: ${profile.injuries || 'none'}
Current targets: ${profile.daily_calorie_target || '-'}kcal | Prot: ${profile.daily_protein_g || '-'}g | Carbs: ${profile.daily_carbs_g || '-'}g | Fat: ${profile.daily_fat_g || '-'}g`);
  } else {
    sections.push('## User profile\nNo profile configured. Generate a standard balanced plan.');
  }

  if (strategy) sections.push(`## Requested strategy\n${strategy}`);

  const planQuery = userId
    ? db.select({
        id: training_plans.id,
        title: training_plans.title,
        objective: training_plans.objective,
        frequency: training_plans.frequency,
      }).from(training_plans)
        .where(and(eq(training_plans.user_id, userId), eq(training_plans.status, 'active')))
        .orderBy(desc(training_plans.id))
        .limit(1)
    : db.select({
        id: training_plans.id,
        title: training_plans.title,
        objective: training_plans.objective,
        frequency: training_plans.frequency,
      }).from(training_plans)
        .where(eq(training_plans.status, 'active'))
        .orderBy(desc(training_plans.id))
        .limit(1);

  const [activePlan] = await planQuery;

  if (activePlan) {
    const sessions = await db.select({ name: training_sessions.name })
      .from(training_sessions)
      .where(eq(training_sessions.plan_id, activePlan.id))
      .orderBy(training_sessions.sort_order);
    const sessionNames = sessions.map(s => s.name).join(', ');
    sections.push(`## Active training plan
Title: ${activePlan.title}
Objective: ${activePlan.objective || '-'}
Frequency: ${activePlan.frequency || '-'}
Sessions: ${sessionNames || '-'}`);
  }

  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const actWhere = userId
    ? and(eq(activitiesTable.user_id, userId), gte(activitiesTable.start_time, `${cutoff7d}T00:00:00`))
    : gte(activitiesTable.start_time, `${cutoff7d}T00:00:00`);

  const acts = await db.select({
    sport_type: activitiesTable.sport_type,
    start_time: activitiesTable.start_time,
    duration: activitiesTable.duration,
    calories: activitiesTable.calories,
    avg_hr: activitiesTable.avg_hr,
  }).from(activitiesTable)
    .where(actWhere)
    .orderBy(desc(activitiesTable.start_time));

  if (acts.length > 0) {
    const totalDur = acts.reduce((s, a) => s + (a.duration || 0), 0);
    const totalCal = acts.reduce((s, a) => s + (a.calories || 0), 0);
    const lines = acts.map(a => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${a.calories || '-'}kcal`;
    });
    sections.push(`## Activities last 7 days (${acts.length} sessions)
Total trained: ${Math.round(totalDur / 60)}min | Calories burned: ${totalCal}kcal
${lines.join('\n')}`);
  }

  const logsWhere = userId
    ? and(eq(nutrition_logs.user_id, userId), gte(nutrition_logs.date, cutoff7d))
    : gte(nutrition_logs.date, cutoff7d);

  const dailyLogs = await db.select({
    date: nutrition_logs.date,
    cals: sql<number>`SUM(${nutrition_logs.calories})`,
    prot: sql<number>`SUM(${nutrition_logs.protein_g})`,
    carbs: sql<number>`SUM(${nutrition_logs.carbs_g})`,
    fat: sql<number>`SUM(${nutrition_logs.fat_g})`,
  }).from(nutrition_logs)
    .where(logsWhere)
    .groupBy(nutrition_logs.date)
    .orderBy(desc(nutrition_logs.date));

  if (dailyLogs.length > 0) {
    const n = dailyLogs.length;
    const avgCals = Math.round(dailyLogs.reduce((s, r) => s + (r.cals || 0), 0) / n);
    const avgProt = Math.round(dailyLogs.reduce((s, r) => s + (r.prot || 0), 0) / n);
    const avgCarbs = Math.round(dailyLogs.reduce((s, r) => s + (r.carbs || 0), 0) / n);
    const avgFat = Math.round(dailyLogs.reduce((s, r) => s + (r.fat || 0), 0) / n);
    sections.push(`## Average intake last ${n} days with logs
Calories: ${avgCals}kcal | Protein: ${avgProt}g | Carbs: ${avgCarbs}g | Fat: ${avgFat}g`);
  } else {
    sections.push('## Recent intake\nNo previous nutrition logs.');
  }

  return sections.join('\n\n');
}

// Context builder for nutrition chat — selected day context
export async function buildNutritionChatContext(date: string, userId?: string): Promise<string> {
  const sections: string[] = [];

  sections.push(`## Date queried\n${date}`);

  const profileQuery = userId
    ? db.select().from(user_profile).where(eq(user_profile.user_id, userId)).limit(1)
    : db.select().from(user_profile).limit(1);
  const [profile] = await profileQuery;

  const targets = {
    daily_calorie_target: profile?.daily_calorie_target ?? 2000,
    daily_protein_g: profile?.daily_protein_g ?? 150,
    daily_carbs_g: profile?.daily_carbs_g ?? 250,
    daily_fat_g: profile?.daily_fat_g ?? 65,
  };

  if (profile) {
    const dietPrefsText = parseDietPrefs(profile.dietary_preferences);
    sections.push(`## User profile
Weight: ${profile.weight_kg || '-'}kg | Goal: ${profile.primary_goal || '-'}
Preferences: ${dietPrefsText}`);
  }

  const logsWhere = userId
    ? and(eq(nutrition_logs.user_id, userId), eq(nutrition_logs.date, date))
    : eq(nutrition_logs.date, date);

  const logs = await db.select({
    meal_slot: nutrition_logs.meal_slot,
    meal_name: nutrition_logs.meal_name,
    calories: nutrition_logs.calories,
    protein_g: nutrition_logs.protein_g,
    carbs_g: nutrition_logs.carbs_g,
    fat_g: nutrition_logs.fat_g,
    logged_at: nutrition_logs.logged_at,
  }).from(nutrition_logs)
    .where(logsWhere)
    .orderBy(nutrition_logs.logged_at);

  const SLOT_EN: Record<string, string> = {
    breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
    dinner: 'Dinner', pre_workout: 'Pre-workout', post_workout: 'Post-workout',
  };

  if (logs.length > 0) {
    const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
    const totalProt = logs.reduce((s, l) => s + (l.protein_g || 0), 0);
    const totalCarbs = logs.reduce((s, l) => s + (l.carbs_g || 0), 0);
    const totalFat = logs.reduce((s, l) => s + (l.fat_g || 0), 0);

    const logLines = logs.map((l, i) => {
      const time = l.logged_at ? new Date(l.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const slot = SLOT_EN[l.meal_slot ?? ''] || l.meal_slot || '';
      return `${i + 1}. ${slot}${time ? ' (' + time + ')' : ''}: ${l.meal_name || 'Unnamed'} — ${l.calories || 0}kcal | ${l.protein_g || 0}g prot | ${l.carbs_g || 0}g carbs | ${l.fat_g || 0}g fat`;
    });

    const remCals = Math.max(0, targets.daily_calorie_target - totalCals);
    const remProt = Math.max(0, targets.daily_protein_g - totalProt);
    const remCarbs = Math.max(0, targets.daily_carbs_g - totalCarbs);
    const remFat = Math.max(0, targets.daily_fat_g - totalFat);

    sections.push(`## Meals logged today (${logs.length} meals)
${logLines.join('\n')}
Total consumed: ${totalCals}kcal | ${totalProt}g prot | ${totalCarbs}g carbs | ${totalFat}g fat`);

    sections.push(`## Daily goals and remaining macros
Target: ${targets.daily_calorie_target}kcal | ${targets.daily_protein_g}g prot | ${targets.daily_carbs_g}g carbs | ${targets.daily_fat_g}g fat
Remaining: ${remCals}kcal | ${remProt}g prot | ${remCarbs}g carbs | ${remFat}g fat
Progress: ${Math.round(totalCals / targets.daily_calorie_target * 100)}% cal | ${Math.round(totalProt / targets.daily_protein_g * 100)}% prot | ${Math.round(totalCarbs / targets.daily_carbs_g * 100)}% carbs | ${Math.round(totalFat / targets.daily_fat_g * 100)}% fat`);
  } else {
    sections.push(`## Meals logged today\nNo meals logged yet.`);
    sections.push(`## Daily goals\n${targets.daily_calorie_target}kcal | ${targets.daily_protein_g}g prot | ${targets.daily_carbs_g}g carbs | ${targets.daily_fat_g}g fat`);
  }

  const planQuery = userId
    ? db.select({
        id: nutrition_plans.id,
        title: nutrition_plans.title,
        strategy: nutrition_plans.strategy,
        daily_calories: nutrition_plans.daily_calories,
        daily_protein_g: nutrition_plans.daily_protein_g,
        daily_carbs_g: nutrition_plans.daily_carbs_g,
        daily_fat_g: nutrition_plans.daily_fat_g,
      }).from(nutrition_plans)
        .where(eq(nutrition_plans.user_id, userId))
        .orderBy(desc(nutrition_plans.id)).limit(1)
    : db.select({
        id: nutrition_plans.id,
        title: nutrition_plans.title,
        strategy: nutrition_plans.strategy,
        daily_calories: nutrition_plans.daily_calories,
        daily_protein_g: nutrition_plans.daily_protein_g,
        daily_carbs_g: nutrition_plans.daily_carbs_g,
        daily_fat_g: nutrition_plans.daily_fat_g,
      }).from(nutrition_plans).orderBy(desc(nutrition_plans.id)).limit(1);

  const [activePlan] = await planQuery;

  if (activePlan) {
    const meals = await db.select({
      slot: nutrition_plan_meals.slot,
      option_number: nutrition_plan_meals.option_number,
      name: nutrition_plan_meals.name,
      calories: nutrition_plan_meals.calories,
      protein_g: nutrition_plan_meals.protein_g,
      carbs_g: nutrition_plan_meals.carbs_g,
      fat_g: nutrition_plan_meals.fat_g,
    }).from(nutrition_plan_meals)
      .where(eq(nutrition_plan_meals.plan_id, activePlan.id))
      .orderBy(nutrition_plan_meals.slot, nutrition_plan_meals.option_number);

    const mealLines = meals.map(m =>
      `  - ${SLOT_EN[m.slot ?? ''] || m.slot} Op.${m.option_number}: ${m.name} (${m.calories}kcal | ${m.protein_g}g P | ${m.carbs_g}g C | ${m.fat_g}g F)`
    );

    sections.push(`## Active nutrition plan: "${activePlan.title}" (${activePlan.strategy})
Plan target: ${activePlan.daily_calories}kcal | ${activePlan.daily_protein_g}g prot | ${activePlan.daily_carbs_g}g carbs | ${activePlan.daily_fat_g}g fat
Available options:
${mealLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
