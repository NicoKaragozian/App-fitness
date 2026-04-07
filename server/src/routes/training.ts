import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { buildTrainingContext } from '../ai/context.js';
import { PROMPTS } from '../ai/prompts.js';

const router = Router();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

function isValidModelName(name: string): boolean {
  return typeof name === 'string' && /^[a-zA-Z0-9._:\-/]+$/.test(name) && name.length < 100;
}

interface AIExercise {
  name: string;
  category?: string;
  sets?: number;
  reps?: string | number;
  notes?: string;
}

interface AISession {
  name: string;
  notes?: string;
  exercises?: AIExercise[];
}

interface AIPlan {
  title: string;
  objective?: string;
  frequency?: string;
  recommendations?: string;
  sessions?: AISession[];
}

function validatePlan(obj: any): AIPlan {
  if (typeof obj !== 'object' || obj === null) throw new Error('Respuesta no es un objeto JSON');
  if (!obj.title) throw new Error('Falta el campo "title"');
  if (!Array.isArray(obj.sessions) || obj.sessions.length === 0) throw new Error('Falta el array "sessions"');
  return obj as AIPlan;
}

// POST /api/training/generate — Generar plan via AI
router.post('/generate', async (req: Request, res: Response) => {
  const { goal, model: requestedModel } = req.body as { goal: string; model?: string };
  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    res.status(400).json({ error: 'Se requiere el campo "goal"' });
    return;
  }

  const model = (requestedModel && isValidModelName(requestedModel)) ? requestedModel : OLLAMA_MODEL;
  const context = buildTrainingContext(goal.trim());
  const systemPrompt = `${PROMPTS.training_plan}\n\nDatos del usuario:\n${context}`;

  let ollamaRes: globalThis.Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generá mi plan de entrenamiento personalizado. Objetivo: ${goal.trim()}` },
        ],
        stream: false,
        format: 'json',
      }),
    });
  } catch (err: any) {
    console.error('[training] No se pudo conectar a Ollama:', err.message);
    res.status(503).json({ error: 'Ollama no está corriendo. Inicialo con: ollama serve' });
    return;
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text();
    console.error('[training] Ollama error:', errText);
    if (ollamaRes.status === 404 || errText.includes('not found')) {
      res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
    } else {
      res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
    }
    return;
  }

  let rawContent: string;
  let plan: AIPlan;
  try {
    const ollamaData = await ollamaRes.json() as any;
    rawContent = ollamaData.message?.content ?? '';
    const parsed = JSON.parse(rawContent);
    plan = validatePlan(parsed);
  } catch (err: any) {
    console.error('[training] Error parseando respuesta de Ollama:', err.message);
    res.status(502).json({ error: `El modelo no devolvió un JSON válido: ${err.message}` });
    return;
  }

  // Guardar en DB dentro de una transacción
  const insertPlan = db.prepare(
    'INSERT INTO training_plans (title, objective, frequency, ai_model, raw_ai_response) VALUES (?,?,?,?,?)'
  );
  const insertSession = db.prepare(
    'INSERT INTO training_sessions (plan_id, name, sort_order, notes) VALUES (?,?,?,?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO training_exercises (session_id, name, category, target_sets, target_reps, notes, sort_order) VALUES (?,?,?,?,?,?,?)'
  );

  let savedPlanId: number;
  const save = db.transaction(() => {
    const planResult = insertPlan.run(
      plan.title,
      plan.objective ?? null,
      plan.frequency ?? null,
      model,
      rawContent,
    );
    savedPlanId = planResult.lastInsertRowid as number;

    (plan.sessions ?? []).forEach((session, si) => {
      const sessionResult = insertSession.run(savedPlanId, session.name, si, session.notes ?? null);
      const sessionId = sessionResult.lastInsertRowid as number;

      (session.exercises ?? []).forEach((ex, ei) => {
        const reps = ex.reps != null ? String(ex.reps) : null;
        const sets = typeof ex.sets === 'number' ? ex.sets : null;
        insertExercise.run(
          sessionId,
          ex.name,
          ex.category ?? 'main',
          sets,
          reps,
          ex.notes ?? null,
          ei,
        );
      });
    });
  });

  save();

  // Devolver plan completo con IDs
  const fullPlan = getPlanById(savedPlanId!);
  res.json({ plan: fullPlan, recommendations: plan.recommendations ?? null });
});

// Helpers para leer plan completo
function getPlanById(id: number) {
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

// GET /api/training/plans — Listar planes
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
    return { ...p, sessionCount, lastWorkout: lastWorkout?.completed_at ?? null, workoutCount };
  });

  res.json(result);
});

// GET /api/training/plans/:id — Plan completo
router.get('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const plan = getPlanById(id);
  if (!plan) { res.status(404).json({ error: 'Plan no encontrado' }); return; }
  res.json(plan);
});

// PUT /api/training/plans/:id — Actualizar plan (título, status)
router.put('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
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

// DELETE /api/training/plans/:id — Borrar plan
router.delete('/plans/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  db.prepare('DELETE FROM training_plans WHERE id = ?').run(id);
  res.json({ ok: true });
});

// PUT /api/training/exercises/:id — Editar targets de ejercicio
router.put('/exercises/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const { name, target_sets, target_reps, notes, category } = req.body as any;
  db.prepare(`
    UPDATE training_exercises SET
      name = COALESCE(?, name),
      target_sets = COALESCE(?, target_sets),
      target_reps = COALESCE(?, target_reps),
      notes = COALESCE(?, notes),
      category = COALESCE(?, category)
    WHERE id = ?
  `).run(name ?? null, target_sets ?? null, target_reps ?? null, notes ?? null, category ?? null, id);
  res.json({ ok: true });
});

// POST /api/training/workouts — Iniciar workout
router.post('/workouts', (req: Request, res: Response) => {
  const { planId, sessionId } = req.body as { planId: number; sessionId: number };
  if (!planId || !sessionId) { res.status(400).json({ error: 'planId y sessionId requeridos' }); return; }
  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO workout_logs (plan_id, session_id, started_at) VALUES (?,?,?)'
  ).run(planId, sessionId, now);
  res.json({ workoutId: result.lastInsertRowid });
});

// PUT /api/training/workouts/:id — Finalizar workout
router.put('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const { notes } = req.body as any;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE workout_logs SET completed_at = ?, notes = COALESCE(?, notes) WHERE id = ?'
  ).run(now, notes ?? null, id);
  res.json({ ok: true });
});

// GET /api/training/workouts — Historial de workouts
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

// GET /api/training/workouts/:id — Detalle de un workout con sus sets
router.get('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const log = db.prepare('SELECT * FROM workout_logs WHERE id = ?').get(id) as any;
  if (!log) { res.status(404).json({ error: 'Workout no encontrado' }); return; }
  const sets = db.prepare(`
    SELECT ws.*, te.name as exercise_name, te.sort_order as exercise_sort_order
    FROM workout_sets ws
    LEFT JOIN training_exercises te ON te.id = ws.exercise_id
    WHERE ws.workout_log_id = ?
    ORDER BY te.sort_order, ws.set_number
  `).all(id) as any[];
  res.json({ ...log, sets });
});

// DELETE /api/training/workouts/:id — Borrar workout log (CASCADE a sets)
router.delete('/workouts/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  db.prepare('DELETE FROM workout_logs WHERE id = ?').run(id);
  res.json({ ok: true });
});

// POST /api/training/workouts/:id/sets — Logear un set
router.post('/workouts/:id/sets', (req: Request, res: Response) => {
  const workoutId = parseInt(req.params.id as string);
  if (isNaN(workoutId)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const { exerciseId, setNumber, reps, weight, completed, notes } = req.body as any;
  if (!exerciseId || setNumber == null) {
    res.status(400).json({ error: 'exerciseId y setNumber requeridos' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO workout_sets (workout_log_id, exercise_id, set_number, reps, weight, completed, notes) VALUES (?,?,?,?,?,?,?)'
  ).run(workoutId, exerciseId, setNumber, reps ?? null, weight ?? null, completed ? 1 : 0, notes ?? null);
  res.json({ setId: result.lastInsertRowid });
});

// PUT /api/training/sets/:id — Actualizar un set
router.put('/sets/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  const body = req.body as any;
  const updates: string[] = [];
  const params: any[] = [];
  if ('reps' in body) { updates.push('reps = ?'); params.push(body.reps ?? null); }
  if ('weight' in body) { updates.push('weight = ?'); params.push(body.weight ?? null); }
  if ('completed' in body) { updates.push('completed = ?'); params.push(body.completed ? 1 : 0); }
  if ('notes' in body) { updates.push('notes = ?'); params.push(body.notes ?? null); }
  if (updates.length === 0) { res.json({ ok: true }); return; }
  params.push(id);
  db.prepare(`UPDATE workout_sets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

// DELETE /api/training/sets/:id — Borrar un set individual
router.delete('/sets/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return; }
  db.prepare('DELETE FROM workout_sets WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/training/exercises/:id/history — Historial de peso/reps para progressive overload
router.get('/exercises/:id/history', (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  // Buscar todos los sets completados de este ejercicio, ordenados por fecha
  const rows = db.prepare(`
    SELECT ws.set_number, ws.reps, ws.weight, ws.completed, wl.started_at, wl.id as workout_log_id
    FROM workout_sets ws
    JOIN workout_logs wl ON wl.id = ws.workout_log_id
    WHERE ws.exercise_id = ? AND ws.completed = 1
    ORDER BY wl.started_at ASC, ws.set_number ASC
  `).all(exerciseId) as any[];

  // Agrupar por workout (fecha)
  const byWorkout: Record<string, { date: string; sets: { set: number; reps: number | null; weight: number | null }[] }> = {};
  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    const key = `${row.workout_log_id}`;
    if (!byWorkout[key]) byWorkout[key] = { date, sets: [] };
    byWorkout[key].sets.push({ set: row.set_number, reps: row.reps, weight: row.weight });
  }

  const history = Object.values(byWorkout).map(w => ({
    date: w.date,
    sets: w.sets,
    maxWeight: Math.max(...w.sets.map(s => s.weight ?? 0)),
    totalReps: w.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
  }));

  res.json(history);
});

// POST /api/training/exercises/:id/describe — Generar descripción de cómo hacer el ejercicio
router.post('/exercises/:id/describe', async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.id as string);
  if (isNaN(exerciseId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const exercise = db.prepare('SELECT * FROM training_exercises WHERE id = ?').get(exerciseId) as any;
  if (!exercise) { res.status(404).json({ error: 'Ejercicio no encontrado' }); return; }

  const { model: requestedModel } = req.body as { model?: string };
  const model = (requestedModel && isValidModelName(requestedModel)) ? requestedModel : OLLAMA_MODEL;

  const prompt = `Explicá en 2-3 oraciones cortas y claras cómo se ejecuta correctamente el ejercicio "${exercise.name}". Incluí: posición inicial, movimiento principal, y el músculo que trabaja. Sin bullets, sin títulos, solo texto corrido. Respondé en español.`;

  let ollamaRes: globalThis.Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
  } catch (err: any) {
    res.status(503).json({ error: 'Ollama no está corriendo. Inicialo con: ollama serve' });
    return;
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text();
    if (ollamaRes.status === 404 || errText.includes('not found')) {
      res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
    } else {
      res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
    }
    return;
  }

  const data = await ollamaRes.json() as any;
  const description = (data.message?.content ?? '').trim();

  // Guardar en DB
  db.prepare('UPDATE training_exercises SET description = ? WHERE id = ?').run(description, exerciseId);

  res.json({ description });
});

export default router;
