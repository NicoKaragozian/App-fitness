import { Router } from 'express';
import type { Request, Response } from 'express';
import { eq, desc, asc, and, sql, count } from 'drizzle-orm';
import db from '../db/client.js';
import {
  training_plans, training_sessions, training_exercises,
  workout_logs, workout_sets,
} from '../db/schema/index.js';
import { buildTrainingContext } from '../ai/context.js';
import { getPrompt } from '../ai/prompts.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured } from '../ai/providers/index.js';
import { modelNameFor } from '../ai/config.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

export interface AIExercise {
  name: string;
  type?: 'strength' | 'cardio' | 'timed';
  category?: string;
  sets?: number;
  reps?: string | number;
  duration_seconds?: number;
  distance_meters?: number;
  pace?: string;
  notes?: string;
}

export interface AISession {
  name: string;
  type?: string;
  notes?: string;
  exercises?: AIExercise[];
}

export interface AIPlan {
  title: string;
  objective?: string;
  frequency?: string;
  recommendations?: string;
  sessions?: AISession[];
}

export function validatePlan(obj: any): AIPlan {
  if (typeof obj !== 'object' || obj === null) throw new Error('Response is not a JSON object');
  if (!obj.title) throw new Error('Missing "title" field');
  if (!Array.isArray(obj.sessions) || obj.sessions.length === 0) throw new Error('Missing "sessions" array');
  return obj as AIPlan;
}

export async function savePlanToDB(plan: AIPlan, rawContent: string, modelName: string | undefined, userId: string): Promise<number> {
  return await db.transaction(async (tx) => {
    const [planRow] = await tx.insert(training_plans).values({
      title: plan.title,
      objective: plan.objective ?? null,
      frequency: plan.frequency ?? null,
      ai_model: modelName ?? 'unknown',
      raw_ai_response: rawContent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: userId,
    }).returning({ id: training_plans.id });

    const planId = planRow.id;

    for (let si = 0; si < (plan.sessions ?? []).length; si++) {
      const session = plan.sessions![si];
      const [sessionRow] = await tx.insert(training_sessions).values({
        plan_id: planId,
        name: session.name,
        type: session.type ?? null,
        sort_order: si,
        notes: session.notes ?? null,
        user_id: userId,
      }).returning({ id: training_sessions.id });

      const sessionId = sessionRow.id;
      for (let ei = 0; ei < (session.exercises ?? []).length; ei++) {
        const ex = session.exercises![ei];
        const reps = ex.reps != null ? String(ex.reps) : null;
        const sets = typeof ex.sets === 'number' ? ex.sets : null;
        await tx.insert(training_exercises).values({
          session_id: sessionId,
          name: ex.name,
          type: ex.type ?? 'strength',
          category: ex.category ?? 'main',
          target_sets: sets,
          target_reps: reps,
          target_duration_seconds: ex.duration_seconds ?? null,
          target_distance_meters: ex.distance_meters ?? null,
          target_pace: ex.pace ?? null,
          notes: ex.notes ?? null,
          sort_order: ei,
          user_id: userId,
        });
      }
    }

    return planId;
  });
}

export async function getPlanById(id: number, userId: string) {
  const [plan] = await db.select().from(training_plans)
    .where(and(eq(training_plans.id, id), eq(training_plans.user_id, userId)));
  if (!plan) return null;

  const sessions = await db.select().from(training_sessions)
    .where(and(eq(training_sessions.plan_id, id), eq(training_sessions.user_id, userId)))
    .orderBy(asc(training_sessions.sort_order));

  return {
    ...plan,
    sessions: await Promise.all(sessions.map(async (s) => {
      const exercises = await db.select().from(training_exercises)
        .where(and(eq(training_exercises.session_id, s.id), eq(training_exercises.user_id, userId)))
        .orderBy(asc(training_exercises.sort_order));
      return { ...s, exercises };
    })),
  };
}

// POST /api/training/generate
router.post('/generate', async (req: Request, res: Response) => {
  const { userId } = req;
  const { goal } = req.body as { goal: string };
  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    res.status(400).json({ error: '"goal" field is required' }); return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const lang = pickLanguageFromReq(req);
  const context = await buildTrainingContext(goal.trim(), userId);
  const systemPrompt = `${getPrompt('training_plan', lang)}\n\nUser data:\n${context}`;
  const userMessage = `Generate my personalized training plan. Goal: ${goal.trim()}`;
  const modelName = modelNameFor(provider.name);

  await provider.streamGenerate(systemPrompt, userMessage, res, {
    maxTokens: 4096,
    beforeDone: async (fullContent) => {
      const DELIMITER = '---PLAN_JSON---';
      const delimIdx = fullContent.indexOf(DELIMITER);
      let jsonStr = delimIdx >= 0
        ? fullContent.slice(delimIdx + DELIMITER.length).trim()
        : fullContent.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const plan = validatePlan(parsed);
        const savedPlanId = await savePlanToDB(plan, fullContent, modelName, userId);
        const fullPlan = await getPlanById(savedPlanId, userId);
        res.write(`data: ${JSON.stringify({ plan: fullPlan, recommendations: plan.recommendations ?? null })}\n\n`);
      } catch (err: any) {
        console.error('[training] Error parsing AI response:', err.message);
        res.write(`data: ${JSON.stringify({ error: `AI did not return valid JSON: ${err.message}` })}\n\n`);
      }
    },
  });
});

// GET /api/training/plans
router.get('/plans', async (req: Request, res: Response) => {
  const { userId } = req;
  const plans = await db.select().from(training_plans)
    .where(eq(training_plans.user_id, userId))
    .orderBy(desc(training_plans.created_at));

  const result = await Promise.all(plans.map(async (p) => {
    const [{ c: sessionCount }] = await db.select({ c: count() }).from(training_sessions)
      .where(and(eq(training_sessions.plan_id, p.id), eq(training_sessions.user_id, userId)));
    const [lastWorkout] = await db.select({ completed_at: workout_logs.completed_at })
      .from(workout_logs)
      .where(and(eq(workout_logs.plan_id, p.id), eq(workout_logs.user_id, userId), sql`${workout_logs.completed_at} IS NOT NULL`))
      .orderBy(desc(workout_logs.completed_at))
      .limit(1);
    const [{ c: workoutCount }] = await db.select({ c: count() })
      .from(workout_logs)
      .where(and(eq(workout_logs.plan_id, p.id), eq(workout_logs.user_id, userId), sql`${workout_logs.completed_at} IS NOT NULL`));
    const sessionTypes = (await db.selectDistinct({ type: training_sessions.type })
      .from(training_sessions)
      .where(and(eq(training_sessions.plan_id, p.id), eq(training_sessions.user_id, userId), sql`${training_sessions.type} IS NOT NULL`)))
      .map((r) => r.type as string);

    return { ...p, sessionCount, lastWorkout: lastWorkout?.completed_at ?? null, workoutCount, sessionTypes };
  }));

  res.json(result);
});

// GET /api/training/plans/:id
router.get('/plans/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const plan = await getPlanById(id, userId);
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
  res.json(plan);
});

// PUT /api/training/plans/:id
router.put('/plans/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { title, objective, frequency, status } = req.body as any;

  const updates: Partial<typeof training_plans.$inferInsert> = { updated_at: new Date().toISOString() };
  if (title != null) updates.title = title;
  if (objective != null) updates.objective = objective;
  if (frequency != null) updates.frequency = frequency;
  if (status != null) updates.status = status;

  await db.update(training_plans).set(updates)
    .where(and(eq(training_plans.id, id), eq(training_plans.user_id, userId)));
  res.json({ ok: true });
});

// DELETE /api/training/plans/:id
router.delete('/plans/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const [plan] = await db.select({ id: training_plans.id }).from(training_plans)
    .where(and(eq(training_plans.id, id), eq(training_plans.user_id, userId)));
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

  await db.transaction(async (tx) => {
    await tx.delete(workout_logs).where(and(eq(workout_logs.plan_id, id), eq(workout_logs.user_id, userId)));
    await tx.delete(training_plans).where(and(eq(training_plans.id, id), eq(training_plans.user_id, userId)));
  });
  res.json({ ok: true });
});

// PUT /api/training/exercises/:id
router.put('/exercises/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { name, type, target_sets, target_reps, target_duration_seconds, target_distance_meters, target_pace, notes, category } = req.body as any;

  const updates: Partial<typeof training_exercises.$inferInsert> = {};
  if (name != null) updates.name = name;
  if (type != null) updates.type = type;
  if (target_sets != null) updates.target_sets = target_sets;
  if (target_reps != null) updates.target_reps = target_reps;
  if (target_duration_seconds != null) updates.target_duration_seconds = target_duration_seconds;
  if (target_distance_meters != null) updates.target_distance_meters = target_distance_meters;
  if (target_pace != null) updates.target_pace = target_pace;
  if (notes != null) updates.notes = notes;
  if (category != null) updates.category = category;

  if (Object.keys(updates).length > 0) {
    await db.update(training_exercises).set(updates)
      .where(and(eq(training_exercises.id, id), eq(training_exercises.user_id, userId)));
  }
  res.json({ ok: true });
});

// POST /api/training/workouts
router.post('/workouts', async (req: Request, res: Response) => {
  const { userId } = req;
  const { planId, sessionId } = req.body as { planId: number; sessionId: number };
  if (!planId || !sessionId) { res.status(400).json({ error: 'planId and sessionId required' }); return; }
  const [log] = await db.insert(workout_logs).values({
    plan_id: planId,
    session_id: sessionId,
    started_at: new Date().toISOString(),
    user_id: userId,
  }).returning({ id: workout_logs.id });
  res.json({ workoutId: log.id });
});

// PUT /api/training/workouts/:id
router.put('/workouts/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { notes } = req.body as any;
  await db.update(workout_logs).set({
    completed_at: new Date().toISOString(),
    notes: notes ?? null,
  }).where(and(eq(workout_logs.id, id), eq(workout_logs.user_id, userId)));
  res.json({ ok: true });
});

// GET /api/training/workouts
router.get('/workouts', async (req: Request, res: Response) => {
  const { userId } = req;
  const { planId, sessionId } = req.query as any;
  const conditions: any[] = [eq(workout_logs.user_id, userId)];
  if (planId) conditions.push(eq(workout_logs.plan_id, parseInt(planId)));
  if (sessionId) conditions.push(eq(workout_logs.session_id, parseInt(sessionId)));

  const logs = await db.select({
    id: workout_logs.id,
    plan_id: workout_logs.plan_id,
    session_id: workout_logs.session_id,
    started_at: workout_logs.started_at,
    completed_at: workout_logs.completed_at,
    notes: workout_logs.notes,
    session_name: training_sessions.name,
  })
    .from(workout_logs)
    .innerJoin(training_sessions, eq(training_sessions.id, workout_logs.session_id))
    .where(and(...conditions))
    .orderBy(desc(workout_logs.started_at));

  res.json(logs);
});

// GET /api/training/workouts/:id
router.get('/workouts/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const [log] = await db.select().from(workout_logs)
    .where(and(eq(workout_logs.id, id), eq(workout_logs.user_id, userId)));
  if (!log) { res.status(404).json({ error: 'Workout not found' }); return; }

  const sets = await db.select({
    id: workout_sets.id,
    workout_log_id: workout_sets.workout_log_id,
    exercise_id: workout_sets.exercise_id,
    set_number: workout_sets.set_number,
    reps: workout_sets.reps,
    weight: workout_sets.weight,
    completed: workout_sets.completed,
    notes: workout_sets.notes,
    duration_seconds: workout_sets.duration_seconds,
    distance_meters: workout_sets.distance_meters,
    exercise_name: training_exercises.name,
    exercise_sort_order: training_exercises.sort_order,
  })
    .from(workout_sets)
    .leftJoin(training_exercises, eq(training_exercises.id, workout_sets.exercise_id))
    .where(and(eq(workout_sets.workout_log_id, id), eq(workout_sets.user_id, userId)))
    .orderBy(asc(training_exercises.sort_order), asc(workout_sets.set_number));

  res.json({ ...log, sets });
});

// DELETE /api/training/workouts/:id
router.delete('/workouts/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  await db.delete(workout_logs).where(and(eq(workout_logs.id, id), eq(workout_logs.user_id, userId)));
  res.json({ ok: true });
});

// POST /api/training/workouts/:id/sets
router.post('/workouts/:id/sets', async (req: Request, res: Response) => {
  const { userId } = req;
  const workoutId = parseInt(req.params.id as string);
  if (isNaN(workoutId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { exerciseId, setNumber, reps, weight, completed, notes, duration_seconds, distance_meters } = req.body as any;
  if (!exerciseId || setNumber == null) {
    res.status(400).json({ error: 'exerciseId and setNumber required' }); return;
  }
  const [s] = await db.insert(workout_sets).values({
    workout_log_id: workoutId,
    exercise_id: exerciseId,
    set_number: setNumber,
    reps: reps ?? null,
    weight: weight ?? null,
    completed: Boolean(completed),
    notes: notes ?? null,
    duration_seconds: duration_seconds ?? null,
    distance_meters: distance_meters ?? null,
    user_id: userId,
  }).returning({ id: workout_sets.id });
  res.json({ setId: s.id });
});

// PUT /api/training/sets/:id
router.put('/sets/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const body = req.body as any;

  const updates: Partial<typeof workout_sets.$inferInsert> = {};
  if ('reps' in body) updates.reps = body.reps ?? null;
  if ('weight' in body) updates.weight = body.weight ?? null;
  if ('completed' in body) updates.completed = Boolean(body.completed);
  if ('notes' in body) updates.notes = body.notes ?? null;
  if ('duration_seconds' in body) updates.duration_seconds = body.duration_seconds ?? null;
  if ('distance_meters' in body) updates.distance_meters = body.distance_meters ?? null;

  if (Object.keys(updates).length > 0) {
    await db.update(workout_sets).set(updates)
      .where(and(eq(workout_sets.id, id), eq(workout_sets.user_id, userId)));
  }
  res.json({ ok: true });
});

// DELETE /api/training/sets/:id
router.delete('/sets/:id', async (req: Request, res: Response) => {
  const { userId } = req;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  await db.delete(workout_sets)
    .where(and(eq(workout_sets.id, id), eq(workout_sets.user_id, userId)));
  res.json({ ok: true });
});

// GET /api/training/exercises/:id/history
router.get('/exercises/:id/history', async (req: Request, res: Response) => {
  const { userId } = req;
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const [exercise] = await db.select({ type: training_exercises.type }).from(training_exercises)
    .where(and(eq(training_exercises.id, exerciseId), eq(training_exercises.user_id, userId)));
  const exType = exercise?.type ?? 'strength';

  const rows = await db.select({
    set_number: workout_sets.set_number,
    reps: workout_sets.reps,
    weight: workout_sets.weight,
    duration_seconds: workout_sets.duration_seconds,
    distance_meters: workout_sets.distance_meters,
    completed: workout_sets.completed,
    started_at: workout_logs.started_at,
    workout_log_id: workout_logs.id,
  })
    .from(workout_sets)
    .innerJoin(workout_logs, eq(workout_logs.id, workout_sets.workout_log_id))
    .where(and(
      eq(workout_sets.exercise_id, exerciseId),
      eq(workout_sets.user_id, userId),
      eq(workout_sets.completed, true),
    ))
    .orderBy(asc(workout_logs.started_at), asc(workout_sets.set_number));

  const byWorkout: Record<string, { date: string; sets: any[] }> = {};
  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    const key = `${row.workout_log_id}`;
    if (!byWorkout[key]) byWorkout[key] = { date, sets: [] };
    byWorkout[key].sets.push({
      set: row.set_number,
      reps: row.reps,
      weight: row.weight,
      duration_seconds: row.duration_seconds,
      distance_meters: row.distance_meters,
    });
  }

  const history = Object.values(byWorkout).map(w => {
    const base = { date: w.date, type: exType, sets: w.sets };
    if (exType === 'cardio') {
      const totalDistance = w.sets.reduce((sum: number, s: any) => sum + (s.distance_meters ?? 0), 0);
      const totalDuration = w.sets.reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);
      const bestPace = (totalDistance > 0 && totalDuration > 0)
        ? `${Math.floor(totalDuration / 60 / (totalDistance / 1000))}:${String(Math.round((totalDuration / 60 / (totalDistance / 1000) % 1) * 60)).padStart(2, '0')}/km`
        : null;
      return { ...base, totalDistance, totalDuration, bestPace, maxWeight: 0, totalReps: 0 };
    }
    if (exType === 'timed') {
      const totalDuration = w.sets.reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);
      return { ...base, totalDuration, setsCompleted: w.sets.length, maxWeight: 0, totalReps: 0 };
    }
    return {
      ...base,
      maxWeight: Math.max(...w.sets.map((s: any) => s.weight ?? 0)),
      totalReps: w.sets.reduce((sum: number, s: any) => sum + (s.reps ?? 0), 0),
    };
  });

  res.json(history);
});

// POST /api/training/exercises/:id/describe
router.post('/exercises/:id/describe', async (req: Request, res: Response) => {
  const { userId } = req;
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const [exercise] = await db.select().from(training_exercises)
    .where(and(eq(training_exercises.id, exerciseId), eq(training_exercises.user_id, userId)));
  if (!exercise) { res.status(404).json({ error: 'Exercise not found' }); return; }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const systemPrompt = 'Respond in English. Be concise and technically precise.';
  const prompt = `Explain in 2-3 short, clear sentences how to correctly perform the exercise "${exercise.name}". Include: starting position, main movement, and the target muscle. No bullets, no titles, just running text.`;

  let description: string;
  try {
    description = (await provider.chat(systemPrompt, prompt, 512)).trim();
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Error generating description' }); return;
  }

  await db.update(training_exercises).set({ description })
    .where(and(eq(training_exercises.id, exerciseId), eq(training_exercises.user_id, userId)));
  res.json({ description });
});

export default router;
