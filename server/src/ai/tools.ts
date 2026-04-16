// ai/tools.ts — Tool definitions + executors for the agentic loop
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { PROMPTS } from './prompts.js';
import { buildTrainingContext, buildDailyContext } from './context.js';
import { validatePlan, savePlanToDB, getPlanById } from '../routes/training.js';
import { computeInsights } from '../insights/index.js';
import { computeMacroTargets } from '../lib/macros.js';
import type { Provider } from './providers/types.js';
import { modelNameFor } from './config.js';

// ── Tool definitions (Anthropic format) ──────────────────────────────

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_profile',
    description: 'Updates the user profile with personal data, goals, and training preferences. Use this tool when the user provides information about themselves (age, weight, height, goal, sports, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'User name' },
        age: { type: 'number', description: 'Age in years' },
        sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex' },
        height_cm: { type: 'number', description: 'Height in centimeters' },
        weight_kg: { type: 'number', description: 'Weight in kilograms' },
        experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'Experience level' },
        primary_goal: { type: 'string', enum: ['strength', 'hypertrophy', 'endurance', 'fat_loss', 'sport_performance', 'maintain'], description: 'Primary goal' },
        sports: { type: 'array', items: { type: 'string' }, description: 'Sports the user practices' },
        training_days_per_week: { type: 'number', description: 'Training days per week' },
        session_duration_min: { type: 'number', description: 'Session duration in minutes' },
        equipment: { type: 'array', items: { type: 'string' }, description: 'Available equipment (full_gym, home_basic, bodyweight, bands)' },
        injuries: { type: 'string', description: 'Injuries or limitations' },
      },
      required: [],
    },
  },
  {
    name: 'generate_training_plan',
    description: 'Generates a personalized training plan based on the user profile, biometric data, and goals. Takes 10-15 seconds. Use this tool when the user asks for a training plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal: { type: 'string', description: 'Plan goal description (e.g., "run my first 10K", "tennis + gym 4 days/week", "triathlon prep", "3-day strength plan")' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'log_meal',
    description: 'Logs a meal in the daily nutrition log. Use this tool when the user tells you what they ate or wants to log a meal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        meal_name: { type: 'string', description: 'Short meal name' },
        description: { type: 'string', description: 'Description/ingredients' },
        meal_slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'], description: 'Time of day' },
        calories: { type: 'number', description: 'Estimated calories' },
        protein_g: { type: 'number', description: 'Protein in grams' },
        carbs_g: { type: 'number', description: 'Carbohydrates in grams' },
        fat_g: { type: 'number', description: 'Fat in grams' },
      },
      required: ['meal_name', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Gets the full daily briefing: sleep, HRV, stress, readiness, training plan, and nutrition. Use this tool when the user asks how they are today, requests a day summary, or wants to know their status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigates the user to a section of the app. Use this tool when the user asks to go to a specific page or after creating something (like a plan) so they can view it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        route: {
          type: 'string',
          enum: ['/dashboard', '/training', '/nutrition', '/sports'],
          description: 'App route to navigate to',
        },
      },
      required: ['route'],
    },
  },
];

// ── Tool executor dispatcher ─────────────────────────────────────────

export interface ToolResult {
  result: any;
  isError: boolean;
}

export async function executeTool(
  name: string,
  input: Record<string, any>,
  opts: { provider?: Provider } = {}
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'update_profile':
        return { result: executeUpdateProfile(input), isError: false };
      case 'generate_training_plan':
        return { result: await executeGenerateTrainingPlan(input, opts.provider), isError: false };
      case 'log_meal':
        return { result: executeLogMeal(input), isError: false };
      case 'get_daily_briefing':
        return { result: executeGetDailyBriefing(), isError: false };
      case 'navigate_to':
        return { result: { navigated: true, route: input.route }, isError: false };
      default:
        return { result: { error: `Tool "${name}" not found` }, isError: true };
    }
  } catch (err: any) {
    console.error(`[agent] Tool "${name}" error:`, err.message);
    return { result: { error: err.message }, isError: true };
  }
}

// ── Individual tool executors ────────────────────────────────────────

function executeUpdateProfile(input: Record<string, any>): any {
  // Read current profile to merge (avoid nullifying existing fields)
  const current = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any || {};
  const now = new Date().toISOString();

  // Merge: only override fields that were explicitly provided
  const merged: any = {
    has_wearable: current.has_wearable ?? 0,
    name: input.name ?? current.name ?? null,
    age: input.age ?? current.age ?? null,
    sex: input.sex ?? current.sex ?? null,
    height_cm: input.height_cm ?? current.height_cm ?? null,
    weight_kg: input.weight_kg ?? current.weight_kg ?? null,
    experience_level: input.experience_level ?? current.experience_level ?? null,
    primary_goal: input.primary_goal ?? current.primary_goal ?? null,
    secondary_goals: input.secondary_goals ? JSON.stringify(input.secondary_goals) : (current.secondary_goals || '[]'),
    sports: input.sports ? JSON.stringify(input.sports) : (current.sports || '[]'),
    training_days_per_week: input.training_days_per_week ?? current.training_days_per_week ?? null,
    session_duration_min: input.session_duration_min ?? current.session_duration_min ?? null,
    equipment: input.equipment ? JSON.stringify(input.equipment) : (current.equipment || '[]'),
    injuries: input.injuries ?? current.injuries ?? null,
    dietary_preferences: current.dietary_preferences || '[]',
  };

  // Auto-compute macros if we have enough data and no manual targets
  let macros = {
    daily_calorie_target: current.daily_calorie_target ?? null,
    daily_protein_g: current.daily_protein_g ?? null,
    daily_carbs_g: current.daily_carbs_g ?? null,
    daily_fat_g: current.daily_fat_g ?? null,
  };

  if (merged.sex && merged.age && merged.weight_kg && merged.height_cm) {
    const computed = computeMacroTargets({
      sex: merged.sex,
      age: merged.age,
      weight_kg: merged.weight_kg,
      height_cm: merged.height_cm,
      training_days_per_week: merged.training_days_per_week || 3,
      primary_goal: merged.primary_goal || 'maintain',
    });
    macros = computed;
  }

  db.prepare(`
    INSERT INTO user_profile (
      id, has_wearable, name, age, sex, height_cm, weight_kg,
      experience_level, primary_goal, secondary_goals, sports, training_days_per_week,
      session_duration_min, equipment, injuries, dietary_preferences,
      daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g,
      onboarded_at, updated_at
    ) VALUES (
      1, @has_wearable, @name, @age, @sex, @height_cm, @weight_kg,
      @experience_level, @primary_goal, @secondary_goals, @sports, @training_days_per_week,
      @session_duration_min, @equipment, @injuries, @dietary_preferences,
      @daily_calorie_target, @daily_protein_g, @daily_carbs_g, @daily_fat_g,
      COALESCE((SELECT onboarded_at FROM user_profile WHERE id=1), @now), @now
    )
    ON CONFLICT(id) DO UPDATE SET
      has_wearable=excluded.has_wearable, name=excluded.name, age=excluded.age,
      sex=excluded.sex, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg,
      experience_level=excluded.experience_level, primary_goal=excluded.primary_goal,
      secondary_goals=excluded.secondary_goals, sports=excluded.sports,
      training_days_per_week=excluded.training_days_per_week,
      session_duration_min=excluded.session_duration_min, equipment=excluded.equipment,
      injuries=excluded.injuries, dietary_preferences=excluded.dietary_preferences,
      daily_calorie_target=excluded.daily_calorie_target,
      daily_protein_g=excluded.daily_protein_g, daily_carbs_g=excluded.daily_carbs_g,
      daily_fat_g=excluded.daily_fat_g, updated_at=excluded.updated_at
  `).run({
    ...merged,
    daily_calorie_target: macros.daily_calorie_target,
    daily_protein_g: macros.daily_protein_g,
    daily_carbs_g: macros.daily_carbs_g,
    daily_fat_g: macros.daily_fat_g,
    now,
  });

  // Return what was updated
  const updatedFields = Object.keys(input).filter(k => input[k] != null);
  const updated = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  return { updated_fields: updatedFields, profile: updated };
}

async function executeGenerateTrainingPlan(input: Record<string, any>, provider?: Provider): Promise<any> {
  if (!provider) {
    throw new Error('Provider required to generate training plan inside agent');
  }
  const goal = input.goal;
  const context = buildTrainingContext(goal);
  const systemPrompt = PROMPTS.training_plan + '\n\nUser data:\n' + context;

  // Non-streaming inner call via the active provider
  const rawContent = await provider.chat(systemPrompt, `Generate a training plan for: ${goal}`, 4096);

  // Parse the ---PLAN_JSON--- delimiter
  const marker = '---PLAN_JSON---';
  const idx = rawContent.indexOf(marker);
  if (idx === -1) {
    throw new Error('AI did not generate the plan JSON correctly (missing ---PLAN_JSON--- sentinel)');
  }

  let jsonStr = rawContent.slice(idx + marker.length).trim();
  // Strip markdown fences if present
  jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/, '');

  const planObj = JSON.parse(jsonStr);
  const plan = validatePlan(planObj);
  const planId = savePlanToDB(plan, rawContent, modelNameFor(provider.name));
  const fullPlan = getPlanById(planId);

  return {
    plan_id: planId,
    title: plan.title,
    objective: plan.objective,
    recommendations: plan.recommendations,
    sessions: (fullPlan?.sessions || []).map((s: any) => ({
      name: s.name,
      exercise_count: s.exercises?.length || 0,
    })),
  };
}

function executeLogMeal(input: Record<string, any>): any {
  const today = new Date().toISOString().slice(0, 10);

  const result = db.prepare(`
    INSERT INTO nutrition_logs
      (date, logged_at, meal_slot, meal_name, description, calories, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    today,
    new Date().toISOString(),
    input.meal_slot || null,
    input.meal_name || null,
    input.description || null,
    input.calories ?? null,
    input.protein_g ?? null,
    input.carbs_g ?? null,
    input.fat_g ?? null,
  );

  return {
    id: result.lastInsertRowid,
    date: today,
    meal_name: input.meal_name,
    meal_slot: input.meal_slot,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
  };
}

function executeGetDailyBriefing(): any {
  const { stats, recommendations } = computeInsights();
  const dailyContext = buildDailyContext();

  // Readiness score (same logic as health.ts)
  const slpScore = stats.sleep.current ?? 0;
  const stressInverse = stats.stress.current != null ? 100 - stats.stress.current : 0;

  let customHrvScore = 0;
  if (stats.hrv.current != null) {
    const hrv = stats.hrv.current;
    if (hrv <= 20) customHrvScore = 10;
    else if (hrv <= 38) customHrvScore = 10 + ((hrv - 20) / (38 - 20)) * (45 - 10);
    else if (hrv <= 99) customHrvScore = 45 + ((hrv - 38) / (99 - 38)) * (100 - 45);
    else customHrvScore = 100;
  }

  let sleepW = slpScore > 0 ? 0.4 : 0;
  let stressW = stressInverse > 0 ? 0.3 : 0;
  let hrvW = customHrvScore > 0 ? 0.3 : 0;
  const totalW = sleepW + stressW + hrvW;
  const readinessScore = totalW > 0
    ? Math.round((slpScore * sleepW + stressInverse * stressW + customHrvScore * hrvW) / totalW)
    : 0;

  const readinessLabel = readinessScore >= 85 ? 'Optimal'
    : readinessScore >= 70 ? 'Good'
    : readinessScore >= 50 ? 'Moderate'
    : 'Low';

  // Today's nutrition
  const todayStr = new Date().toISOString().slice(0, 10);
  const nutritionToday = db.prepare(`
    SELECT SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat, COUNT(*) as meals
    FROM nutrition_logs WHERE date = ?
  `).get(todayStr) as any;

  // Active plan today's session
  const activePlan = db.prepare(
    'SELECT id, title FROM training_plans WHERE status = ? ORDER BY id DESC LIMIT 1'
  ).get('active') as any;

  return {
    today: todayStr,
    readiness: { score: readinessScore, label: readinessLabel },
    sleep: {
      score: stats.sleep.current,
      trend: stats.sleep.trend,
    },
    hrv: {
      current: stats.hrv.current ? Number(stats.hrv.current.toFixed(1)) : null,
      baseline: stats.hrv.baseline ? Number(stats.hrv.baseline.toFixed(1)) : null,
      status: stats.hrv.status,
      trend: stats.hrv.trend,
    },
    stress: {
      current: stats.stress.current,
      trend: stats.stress.trend,
    },
    nutrition: nutritionToday?.meals > 0 ? {
      meals: nutritionToday.meals,
      calories: nutritionToday.cals || 0,
      protein_g: nutritionToday.prot || 0,
    } : null,
    active_plan: activePlan ? { id: activePlan.id, title: activePlan.title } : null,
    recommendations: recommendations.slice(0, 3).map((r: any) => ({
      title: r.title,
      description: r.description,
      priority: r.priority,
      type: r.type,
    })),
    // Full context string for Claude to interpret
    context: dailyContext,
  };
}
