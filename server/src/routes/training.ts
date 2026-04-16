import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { buildTrainingContext } from '../ai/context.js';
import { getPrompt } from '../ai/prompts.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured } from '../ai/providers/index.js';
import { modelNameFor } from '../ai/config.js';

const router = Router();

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

// Saves an AIPlan to DB and returns the inserted ID
export function savePlanToDB(plan: AIPlan, rawContent: string, modelName?: string): number {
  const insertPlan = db.prepare(
    'INSERT INTO training_plans (title, objective, frequency, ai_model, raw_ai_response) VALUES (?,?,?,?,?)'
  );
  const insertSession = db.prepare(
    'INSERT INTO training_sessions (plan_id, name, type, sort_order, notes) VALUES (?,?,?,?,?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO training_exercises (session_id, name, type, category, target_sets, target_reps, target_duration_seconds, target_distance_meters, target_pace, notes, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  );

  let savedPlanId!: number;
  const save = db.transaction(() => {
    const planResult = insertPlan.run(
      plan.title,
      plan.objective ?? null,
      plan.frequency ?? null,
      modelName ?? 'unknown',
      rawContent,
    );
    savedPlanId = planResult.lastInsertRowid as number;

    (plan.sessions ?? []).forEach((session, si) => {
      const sessionResult = insertSession.run(savedPlanId, session.name, session.type ?? null, si, session.notes ?? null);
      const sessionId = sessionResult.lastInsertRowid as number;

      (session.exercises ?? []).forEach((ex, ei) => {
        const reps = ex.reps != null ? String(ex.reps) : null;
        const sets = typeof ex.sets === 'number' ? ex.sets : null;
        insertExercise.run(
          sessionId,
          ex.name,
          ex.type ?? 'strength',
          ex.category ?? 'main',
          sets,
          reps,
          ex.duration_seconds ?? null,
          ex.distance_meters ?? null,
          ex.pace ?? null,
          ex.notes ?? null,
          ei,
        );
      });
    });
  });
  save();
  return savedPlanId;
}

// POST /api/training/generate — Generate plan via AI with streaming SSE
// Emits "analysis" tokens for user feedback, then JSON plan at the end.
// SSE Protocol:
//   data: {"token":"..."}                         — analysis text (visible to the user)
//   data: {"plan":{...},"recommendations":"..."}  — plan saved, before [DONE]
//   data: {"error":"..."}                         — if JSON parse fails
//   data: [DONE]                                  — end of stream
router.post('/generate', async (req: Request, res: Response) => {
  const { goal } = req.body as { goal: string };
  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    res.status(400).json({ error: '"goal" field is required' });
    return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` });
    return;
  }

  const lang = pickLanguageFromReq(req);
  const context = buildTrainingContext(goal.trim());
  const systemPrompt = `${getPrompt('training_plan', lang)}\n\nUser data:\n${context}`;
  const userMessage = `Generate my personalized training plan. Goal: ${goal.trim()}`;
  const modelName = modelNameFor(provider.name);

  await provider.streamGenerate(systemPrompt, userMessage, res, {
    maxTokens: 4096,
    beforeDone: (fullContent) => {
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
        const savedPlanId = savePlanToDB(plan, fullContent, modelName);
        const fullPlan = getPlanById(savedPlanId);
        res.write(`data: ${JSON.stringify({ plan: fullPlan, recommendations: plan.recommendations ?? null })}\n\n`);
      } catch (err: any) {
        console.error('[training] Error parsing AI response:', err.message);
        res.write(`data: ${JSON.stringify({ error: `AI did not return valid JSON: ${err.message}` })}\n\n`);
      }
    },
  });
});

// Helpers to read full plan
export function getPlanById(id: number) {
  const plan = db.prepare('SELECT * FROM training_plans WHERE id = ?').get(id) as any;
  if (!plan) return null;

  const sessions = db.prepare(
    'SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY sort_order'
  ).all(id) as any[];

  plan.sessions = sessions.map((s: any) => {
    const exercises = db.prepare(
      'SELECT * FROM training_exercises WHERE session_id = ? ORDER BY sort_order'
    ).all(s.id) as any[];
    return { ...s, exercises };
  });

  return plan;
}

// GET /api/training/plans — List plans
router.get('/plans', (_req: Request, res: Response) => {
  const plans = db.prepare(
    'SELECT * FROM training_plans ORDER BY created_at DESC'
  ).all() as any[];

  const result = plans.map((p: any) => {
    const sessionCount = (db.prepare('SELECT COUNT(*) as c FROM training_sessions WHERE plan_id = ?').get(p.id) as any).c;
    const lastWorkout = db.prepare(
      'SELECT completed_at FROM workout_logs WHERE plan_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1'
    ).get(p.id) as any;
    const workoutCount = (db.prepare('SELECT COUNT(*) as c FROM workout_logs WHERE plan_id = ? AND completed_at IS NOT NULL').get(p.id) as any).c;
    const sessionTypes = (db.prepare('SELECT DISTINCT type FROM training_sessions WHERE plan_id = ? AND type IS NOT NULL').all(p.id) as any[]).map((r: any) => r.type as string);
    return { ...p, sessionCount, lastWorkout: lastWorkout?.completed_at ?? null, workoutCount, sessionTypes };
  });

  res.json(result);
});

// GET /api/training/plans/:id — Plan completo
router.get('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const plan = getPlanById(id);
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
  res.json(plan);
});

// PUT /api/training/plans/:id — Update plan (title, status)
router.put('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { title, objective, frequency, status } = req.body as any;
  db.prepare(`
    UPDATE training_plans SET
      title = COALESCE(?, title),
      objective = COALESCE(?, objective),
      frequency = COALESCE(?, frequency),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title ?? null, objective ?? null, frequency ?? null, status ?? null, id);
  res.json({ ok: true });
});

// DELETE /api/training/plans/:id — Delete plan
router.delete('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  // workout_logs doesn't have ON DELETE CASCADE, must delete before (its sets are deleted via CASCADE)
  db.transaction(() => {
    db.prepare('DELETE FROM workout_logs WHERE plan_id = ?').run(id);
    db.prepare('DELETE FROM training_plans WHERE id = ?').run(id);
  })();
  res.json({ ok: true });
});

// PUT /api/training/exercises/:id — Edit exercise targets
router.put('/exercises/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { name, type, target_sets, target_reps, target_duration_seconds, target_distance_meters, target_pace, notes, category } = req.body as any;
  db.prepare(`
    UPDATE training_exercises SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      target_sets = COALESCE(?, target_sets),
      target_reps = COALESCE(?, target_reps),
      target_duration_seconds = COALESCE(?, target_duration_seconds),
      target_distance_meters = COALESCE(?, target_distance_meters),
      target_pace = COALESCE(?, target_pace),
      notes = COALESCE(?, notes),
      category = COALESCE(?, category)
    WHERE id = ?
  `).run(name ?? null, type ?? null, target_sets ?? null, target_reps ?? null, target_duration_seconds ?? null, target_distance_meters ?? null, target_pace ?? null, notes ?? null, category ?? null, id);
  res.json({ ok: true });
});

// POST /api/training/workouts — Start workout
router.post('/workouts', (req: Request, res: Response) => {
  const { planId, sessionId } = req.body as { planId: number; sessionId: number };
  if (!planId || !sessionId) { res.status(400).json({ error: 'planId and sessionId required' }); return; }
  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO workout_logs (plan_id, session_id, started_at) VALUES (?,?,?)'
  ).run(planId, sessionId, now);
  res.json({ workoutId: result.lastInsertRowid });
});

// PUT /api/training/workouts/:id — Finish workout
router.put('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { notes } = req.body as any;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE workout_logs SET completed_at = ?, notes = COALESCE(?, notes) WHERE id = ?'
  ).run(now, notes ?? null, id);
  res.json({ ok: true });
});

// GET /api/training/workouts — Workout history
router.get('/workouts', (req: Request, res: Response) => {
  const { planId, sessionId } = req.query as any;
  let query = 'SELECT wl.*, ts.name as session_name FROM workout_logs wl JOIN training_sessions ts ON ts.id = wl.session_id WHERE 1=1';
  const params: any[] = [];
  if (planId) { query += ' AND wl.plan_id = ?'; params.push(parseInt(planId)); }
  if (sessionId) { query += ' AND wl.session_id = ?'; params.push(parseInt(sessionId)); }
  query += ' ORDER BY wl.started_at DESC';
  const logs = db.prepare(query).all(...params) as any[];
  res.json(logs);
});

// GET /api/training/workouts/:id — Workout detail with its sets
router.get('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const log = db.prepare('SELECT * FROM workout_logs WHERE id = ?').get(id) as any;
  if (!log) { res.status(404).json({ error: 'Workout not found' }); return; }
  const sets = db.prepare(`
    SELECT ws.*, te.name as exercise_name, te.sort_order as exercise_sort_order
    FROM workout_sets ws
    LEFT JOIN training_exercises te ON te.id = ws.exercise_id
    WHERE ws.workout_log_id = ?
    ORDER BY te.sort_order, ws.set_number
  `).all(id) as any[];
  res.json({ ...log, sets });
});

// DELETE /api/training/workouts/:id — Delete workout log (CASCADE to sets)
router.delete('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  db.prepare('DELETE FROM workout_logs WHERE id = ?').run(id);
  res.json({ ok: true });
});

// POST /api/training/workouts/:id/sets — Log a set
router.post('/workouts/:id/sets', (req: Request, res: Response) => {
  const workoutId = parseInt(req.params.id as string);
  if (isNaN(workoutId)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const { exerciseId, setNumber, reps, weight, completed, notes, duration_seconds, distance_meters } = req.body as any;
  if (!exerciseId || setNumber == null) {
    res.status(400).json({ error: 'exerciseId and setNumber required' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO workout_sets (workout_log_id, exercise_id, set_number, reps, weight, completed, notes, duration_seconds, distance_meters) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(workoutId, exerciseId, setNumber, reps ?? null, weight ?? null, completed ? 1 : 0, notes ?? null, duration_seconds ?? null, distance_meters ?? null);
  res.json({ setId: result.lastInsertRowid });
});

// PUT /api/training/sets/:id — Update a set
router.put('/sets/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const body = req.body as any;
  const updates: string[] = [];
  const params: any[] = [];
  if ('reps' in body) { updates.push('reps = ?'); params.push(body.reps ?? null); }
  if ('weight' in body) { updates.push('weight = ?'); params.push(body.weight ?? null); }
  if ('completed' in body) { updates.push('completed = ?'); params.push(body.completed ? 1 : 0); }
  if ('notes' in body) { updates.push('notes = ?'); params.push(body.notes ?? null); }
  if ('duration_seconds' in body) { updates.push('duration_seconds = ?'); params.push(body.duration_seconds ?? null); }
  if ('distance_meters' in body) { updates.push('distance_meters = ?'); params.push(body.distance_meters ?? null); }
  if (updates.length === 0) { res.json({ ok: true }); return; }
  params.push(id);
  db.prepare(`UPDATE workout_sets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

// DELETE /api/training/sets/:id — Delete an individual set
router.delete('/sets/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  db.prepare('DELETE FROM workout_sets WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/training/exercises/:id/history — Progressive overload history (adapts to exercise type)
router.get('/exercises/:id/history', (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const exercise = db.prepare('SELECT type FROM training_exercises WHERE id = ?').get(exerciseId) as { type: string } | undefined;
  const exType = exercise?.type ?? 'strength';

  const rows = db.prepare(`
    SELECT ws.set_number, ws.reps, ws.weight, ws.duration_seconds, ws.distance_meters, ws.completed, wl.started_at, wl.id as workout_log_id
    FROM workout_sets ws
    JOIN workout_logs wl ON wl.id = ws.workout_log_id
    WHERE ws.exercise_id = ? AND ws.completed = 1
    ORDER BY wl.started_at ASC, ws.set_number ASC
  `).all(exerciseId) as any[];

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
      const setsCompleted = w.sets.length;
      return { ...base, totalDuration, setsCompleted, maxWeight: 0, totalReps: 0 };
    }
    // strength (default)
    return {
      ...base,
      maxWeight: Math.max(...w.sets.map((s: any) => s.weight ?? 0)),
      totalReps: w.sets.reduce((sum: number, s: any) => sum + (s.reps ?? 0), 0),
    };
  });

  res.json(history);
});

// POST /api/training/exercises/:id/describe — Generate description of how to perform the exercise
router.post('/exercises/:id/describe', async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const exercise = db.prepare('SELECT * FROM training_exercises WHERE id = ?').get(exerciseId) as any;
  if (!exercise) { res.status(404).json({ error: 'Exercise not found' }); return; }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` });
    return;
  }

  const systemPrompt = 'Respond in English. Be concise and technically precise.';
  const prompt = `Explain in 2-3 short, clear sentences how to correctly perform the exercise "${exercise.name}". Include: starting position, main movement, and the target muscle. No bullets, no titles, just running text.`;

  let description: string;
  try {
    description = (await provider.chat(systemPrompt, prompt, 512)).trim();
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Error generating description' });
    return;
  }

  // Save to DB
  db.prepare('UPDATE training_exercises SET description = ? WHERE id = ?').run(description, exerciseId);

  res.json({ description });
});

export default router;
