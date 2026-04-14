// ai/nutrition-context.ts — Context builder for nutrition plan generation
// Queries DB and builds a string with the profile, active training plan, and recent data.

import db from '../db.js';

export function buildNutritionPlanContext(strategy?: string): string {
  const sections: string[] = [];

  // User profile
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (profile) {
    const sports = JSON.parse(profile.sports || '[]');

    // Parse preferences: support for object format (new) and array format (old)
    let dietPrefsText = 'none';
    try {
      const raw = JSON.parse(profile.dietary_preferences || 'null');
      if (Array.isArray(raw)) {
        dietPrefsText = raw.length > 0 ? raw.join(', ') : 'none';
      } else if (raw && typeof raw === 'object') {
        const lines: string[] = [];
        if (raw.diet_type) lines.push(`Diet type: ${raw.diet_type}`);
        if (raw.allergies?.length > 0) lines.push(`Allergies/intolerances: ${raw.allergies.join(', ')}`);
        if (raw.excluded_foods) lines.push(`Excluded foods: ${raw.excluded_foods}`);
        if (raw.preferred_foods) lines.push(`Preferred foods (incorporate, not use exclusively): ${raw.preferred_foods}`);
        if (raw.meals_per_day) lines.push(`Meals per day: ${raw.meals_per_day}`);
        dietPrefsText = lines.length > 0 ? '\n' + lines.map(l => `  - ${l}`).join('\n') : 'none';
      }
    } catch { /* invalid format, ignore */ }

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

  if (strategy) {
    sections.push(`## Requested strategy\n${strategy}`);
  }

  // Active training plan
  const activePlan = db.prepare(
    'SELECT tp.*, COUNT(ts.id) as session_count FROM training_plans tp LEFT JOIN training_sessions ts ON ts.plan_id = tp.id WHERE tp.status = ? GROUP BY tp.id ORDER BY tp.id DESC LIMIT 1'
  ).get('active') as any;

  if (activePlan) {
    const sessions = db.prepare('SELECT name, notes FROM training_sessions WHERE plan_id = ? ORDER BY sort_order').all(activePlan.id) as any[];
    const sessionNames = sessions.map((s: any) => s.name).join(', ');
    sections.push(`## Active training plan
Title: ${activePlan.title}
Objective: ${activePlan.objective || '-'}
Frequency: ${activePlan.frequency || '-'}
Sessions: ${sessionNames || '-'}`);
  }

  // Recent activities (7 days) to calculate training load
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, calories, avg_hr
    FROM activities WHERE start_time >= ? ORDER BY start_time DESC
  `).all(cutoff7d + 'T00:00:00') as any[];

  if (activities.length > 0) {
    const totalDur = activities.reduce((s: number, a: any) => s + (a.duration || 0), 0);
    const totalCal = activities.reduce((s: number, a: any) => s + (a.calories || 0), 0);
    const lines = activities.map((a: any) => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${a.calories || '-'}kcal`;
    });
    sections.push(`## Activities last 7 days (${activities.length} sessions)
Total trained: ${Math.round(totalDur / 60)}min | Calories burned: ${totalCal}kcal
${lines.join('\n')}`);
  }

  // Average intake last 7 days (if nutrition logs exist)
  const nutritionLogs = db.prepare(`
    SELECT date,
      SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat
    FROM nutrition_logs
    WHERE date >= ?
    GROUP BY date ORDER BY date DESC
  `).all(cutoff7d) as any[];

  if (nutritionLogs.length > 0) {
    const avgCals = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.cals || 0), 0) / nutritionLogs.length);
    const avgProt = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.prot || 0), 0) / nutritionLogs.length);
    const avgCarbs = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.carbs || 0), 0) / nutritionLogs.length);
    const avgFat = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.fat || 0), 0) / nutritionLogs.length);
    sections.push(`## Average intake last ${nutritionLogs.length} days with logs
Calories: ${avgCals}kcal | Protein: ${avgProt}g | Carbs: ${avgCarbs}g | Fat: ${avgFat}g`);
  } else {
    sections.push('## Recent intake\nNo previous nutrition logs.');
  }

  return sections.join('\n\n');
}

// Context builder for nutrition chat — selected day context
export function buildNutritionChatContext(date: string): string {
  const sections: string[] = [];

  sections.push(`## Date queried\n${date}`);

  // Profile and targets
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  const targets = {
    daily_calorie_target: profile?.daily_calorie_target || 2000,
    daily_protein_g: profile?.daily_protein_g || 150,
    daily_carbs_g: profile?.daily_carbs_g || 250,
    daily_fat_g: profile?.daily_fat_g || 65,
  };

  if (profile) {
    let dietPrefsText = 'none';
    try {
      const raw = JSON.parse(profile.dietary_preferences || 'null');
      if (Array.isArray(raw)) {
        dietPrefsText = raw.length > 0 ? raw.join(', ') : 'none';
      } else if (raw && typeof raw === 'object') {
        const lines: string[] = [];
        if (raw.diet_type) lines.push(`Diet type: ${raw.diet_type}`);
        if (raw.allergies?.length > 0) lines.push(`Allergies/intolerances: ${raw.allergies.join(', ')}`);
        if (raw.excluded_foods) lines.push(`Excluded foods: ${raw.excluded_foods}`);
        if (raw.preferred_foods) lines.push(`Preferred foods: ${raw.preferred_foods}`);
        if (raw.meals_per_day) lines.push(`Meals per day: ${raw.meals_per_day}`);
        dietPrefsText = lines.length > 0 ? lines.join(' | ') : 'none';
      }
    } catch { /* ignore */ }

    sections.push(`## User profile
Weight: ${profile.weight_kg || '-'}kg | Goal: ${profile.primary_goal || '-'}
Preferences: ${dietPrefsText}`);
  }

  // Meals logged on this day
  const logs = db.prepare(
    'SELECT meal_slot, meal_name, calories, protein_g, carbs_g, fat_g, logged_at FROM nutrition_logs WHERE date = ? ORDER BY logged_at'
  ).all(date) as any[];

  if (logs.length > 0) {
    const totalCals = logs.reduce((s: number, l: any) => s + (l.calories || 0), 0);
    const totalProt = logs.reduce((s: number, l: any) => s + (l.protein_g || 0), 0);
    const totalCarbs = logs.reduce((s: number, l: any) => s + (l.carbs_g || 0), 0);
    const totalFat = logs.reduce((s: number, l: any) => s + (l.fat_g || 0), 0);

    const SLOT_EN: Record<string, string> = {
      breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
      dinner: 'Dinner', pre_workout: 'Pre-workout', post_workout: 'Post-workout',
    };

    const logLines = logs.map((l: any, i: number) => {
      const time = l.logged_at ? new Date(l.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const slot = SLOT_EN[l.meal_slot] || l.meal_slot || '';
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
    sections.push(`## Daily goals
${targets.daily_calorie_target}kcal | ${targets.daily_protein_g}g prot | ${targets.daily_carbs_g}g carbs | ${targets.daily_fat_g}g fat`);
  }

  // Active nutrition plan with its meals
  const activePlan = db.prepare(
    "SELECT id, title, strategy, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM nutrition_plans ORDER BY id DESC LIMIT 1"
  ).get() as any;

  if (activePlan) {
    const meals = db.prepare(
      'SELECT slot, option_number, name, calories, protein_g, carbs_g, fat_g FROM nutrition_plan_meals WHERE plan_id = ? ORDER BY slot, option_number'
    ).all(activePlan.id) as any[];

    const SLOT_EN: Record<string, string> = {
      breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack',
      dinner: 'Dinner', pre_workout: 'Pre-workout', post_workout: 'Post-workout',
    };

    const mealLines = meals.map((m: any) =>
      `  - ${SLOT_EN[m.slot] || m.slot} Op.${m.option_number}: ${m.name} (${m.calories}kcal | ${m.protein_g}g P | ${m.carbs_g}g C | ${m.fat_g}g F)`
    );

    sections.push(`## Active nutrition plan: "${activePlan.title}" (${activePlan.strategy})
Plan target: ${activePlan.daily_calories}kcal | ${activePlan.daily_protein_g}g prot | ${activePlan.daily_carbs_g}g carbs | ${activePlan.daily_fat_g}g fat
Available options:
${mealLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
