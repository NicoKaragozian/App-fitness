import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { claudeVisionStream, claudeChat, isClaudeConfigured } from '../ai/claude.js';
import { PROMPTS } from '../ai/prompts.js';
import { buildNutritionPlanContext } from '../ai/nutrition-context.js';
import { UPLOAD_DIR } from '../index.js';

const router = Router();

// Defaults de macros si no hay user_profile
const DEFAULT_TARGETS = {
  daily_calorie_target: 2000,
  daily_protein_g: 150,
  daily_carbs_g: 250,
  daily_fat_g: 65,
};

function getMacroTargets(): typeof DEFAULT_TARGETS {
  const profile = db.prepare('SELECT daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g FROM user_profile WHERE id = 1').get() as any;
  if (profile?.daily_calorie_target) {
    return {
      daily_calorie_target: profile.daily_calorie_target,
      daily_protein_g: profile.daily_protein_g,
      daily_carbs_g: profile.daily_carbs_g,
      daily_fat_g: profile.daily_fat_g,
    };
  }
  return DEFAULT_TARGETS;
}

// Configuracion de multer
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan imágenes'));
    }
  },
});

function getImageMediaType(mimetype: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const map: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/gif': 'image/gif',
  };
  return map[mimetype] || 'image/jpeg';
}

// POST /api/nutrition/analyze — Analisis de foto con Claude Vision (streaming SSE)
router.post('/analyze', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió ninguna imagen' });
    return;
  }

  if (!isClaudeConfigured()) {
    fs.unlink(req.file.path, () => {});
    res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurado en server/.env' });
    return;
  }

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = imageBuffer.toString('base64');
    const mediaType = getImageMediaType(req.file.mimetype);
    const imagePath = path.basename(req.file.path);

    await claudeVisionStream(
      PROMPTS.food_vision,
      'Analizá esta imagen de comida y devolvé el JSON con los macronutrientes estimados.',
      imageBase64,
      mediaType,
      imagePath,
      res
    );
  } catch (err: any) {
    console.error('[nutrition] analyze error:', err.message);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
});

// POST /api/nutrition/logs — Guardar log de comida
router.post('/logs', (req: Request, res: Response) => {
  const {
    date, meal_slot, meal_name, description,
    calories, protein_g, carbs_g, fat_g, fiber_g,
    image_path, ai_model, ai_confidence, raw_ai_response,
  } = req.body;

  if (!date) {
    res.status(400).json({ error: 'date es requerido' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO nutrition_logs
      (date, logged_at, meal_slot, meal_name, description, calories, protein_g, carbs_g, fat_g, fiber_g,
       image_path, ai_model, ai_confidence, raw_ai_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date,
    new Date().toISOString(),
    meal_slot || null,
    meal_name || null,
    description || null,
    calories ?? null,
    protein_g ?? null,
    carbs_g ?? null,
    fat_g ?? null,
    fiber_g ?? null,
    image_path || null,
    ai_model || null,
    ai_confidence || null,
    raw_ai_response || null,
  );

  res.json({ id: result.lastInsertRowid });
});

// GET /api/nutrition/logs — Logs del dia + totales + targets
router.get('/logs', (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  const logs = db.prepare(
    'SELECT * FROM nutrition_logs WHERE date = ? ORDER BY logged_at'
  ).all(date);

  const totals = (logs as any[]).reduce(
    (acc, r) => ({
      calories: acc.calories + (r.calories || 0),
      protein_g: acc.protein_g + (r.protein_g || 0),
      carbs_g: acc.carbs_g + (r.carbs_g || 0),
      fat_g: acc.fat_g + (r.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const targets = getMacroTargets();
  const hasProfile = Boolean(
    db.prepare('SELECT id FROM user_profile WHERE id = 1').get()
  );

  res.json({ logs, totals, targets, hasProfile });
});

// GET /api/nutrition/logs/range — Logs por rango de fechas
router.get('/logs/range', (req: Request, res: Response) => {
  const { from, to } = req.query as { from: string; to: string };
  if (!from || !to) {
    res.status(400).json({ error: 'from y to son requeridos' });
    return;
  }

  const rows = db.prepare(`
    SELECT date,
      SUM(calories) as calories, SUM(protein_g) as protein_g,
      SUM(carbs_g) as carbs_g, SUM(fat_g) as fat_g,
      COUNT(*) as log_count
    FROM nutrition_logs
    WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date
  `).all(from, to) as any[];

  res.json({ days: rows });
});

// PUT /api/nutrition/logs/:id — Editar log
router.put('/logs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = ['meal_slot', 'meal_name', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
  const updates: string[] = [];
  const values: any[] = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE nutrition_logs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// DELETE /api/nutrition/logs/:id — Borrar log + imagen asociada
router.delete('/logs/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT image_path FROM nutrition_logs WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM nutrition_logs WHERE id = ?').run(req.params.id);

  if (row?.image_path) {
    const fullPath = path.join(UPLOAD_DIR, row.image_path);
    fs.unlink(fullPath, () => {}); // No-blocking, ignorar errores
  }

  res.json({ ok: true });
});

// POST /api/nutrition/plans/generate — Generar plan nutricional con Claude
router.post('/plans/generate', async (req: Request, res: Response) => {
  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurado en server/.env' });
    return;
  }

  const { strategy, linkedTrainingPlanId } = req.body;
  const context = buildNutritionPlanContext(strategy);

  let rawResponse: string;
  try {
    rawResponse = await claudeChat(
      PROMPTS.nutrition_plan,
      `Generá un plan nutricional con estos datos:\n\n${context}`,
      4096
    );
  } catch (err: any) {
    console.error('[nutrition] plan generation error:', err.message);
    res.status(err.status || 502).json({ error: err.message });
    return;
  }

  // Parsear JSON — intentar extraer de markdown si es necesario
  let plan: any;
  try {
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    plan = JSON.parse(jsonStr);
  } catch {
    console.error('[nutrition] plan parse error, raw:', rawResponse.slice(0, 500));
    res.status(502).json({ error: 'Claude devolvió una respuesta que no pudo ser parseada como JSON. Intentá de nuevo.' });
    return;
  }

  // Validar estructura minima
  if (!plan.meals || !Array.isArray(plan.meals) || plan.meals.length === 0) {
    res.status(502).json({ error: 'El plan generado no tiene comidas validas. Intentá de nuevo.' });
    return;
  }

  // Guardar en DB con transaccion
  const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  const insertPlan = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO nutrition_plans
        (training_plan_id, title, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g,
         strategy, rationale, ai_model, raw_ai_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      linkedTrainingPlanId || null,
      plan.title || 'Plan Nutricional',
      plan.daily_calories || null,
      plan.daily_protein_g || null,
      plan.daily_carbs_g || null,
      plan.daily_fat_g || null,
      plan.strategy || strategy || 'maintain',
      plan.rationale || null,
      CLAUDE_MODEL,
      rawResponse,
    );

    const planId = result.lastInsertRowid;

    const insertMeal = db.prepare(`
      INSERT INTO nutrition_plan_meals (plan_id, slot, name, description, calories, protein_g, carbs_g, fat_g)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const meal of plan.meals) {
      insertMeal.run(
        planId,
        meal.slot || null,
        meal.name || null,
        meal.description || null,
        meal.calories || null,
        meal.protein_g || null,
        meal.carbs_g || null,
        meal.fat_g || null,
      );
    }

    return planId;
  });

  let planId: number | bigint;
  try {
    planId = insertPlan();
  } catch (err: any) {
    console.error('[nutrition] DB insert error:', err.message);
    res.status(500).json({ error: 'Error guardando el plan en la base de datos' });
    return;
  }

  // Retornar plan completo
  const saved = db.prepare('SELECT * FROM nutrition_plans WHERE id = ?').get(planId) as any;
  const meals = db.prepare('SELECT * FROM nutrition_plan_meals WHERE plan_id = ? ORDER BY id').all(planId);
  res.json({ ...saved, meals });
});

// GET /api/nutrition/plans — Listar planes
router.get('/plans', (_req: Request, res: Response) => {
  const plans = db.prepare(`
    SELECT np.*, COUNT(npm.id) as meal_count
    FROM nutrition_plans np
    LEFT JOIN nutrition_plan_meals npm ON npm.plan_id = np.id
    GROUP BY np.id ORDER BY np.created_at DESC
  `).all();
  res.json(plans);
});

// GET /api/nutrition/plans/:id — Plan completo con comidas
router.get('/plans/:id', (req: Request, res: Response) => {
  const plan = db.prepare('SELECT * FROM nutrition_plans WHERE id = ?').get(req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Plan no encontrado' });
    return;
  }
  const meals = db.prepare('SELECT * FROM nutrition_plan_meals WHERE plan_id = ? ORDER BY id').all(req.params.id);
  res.json({ ...(plan as object), meals });
});

// DELETE /api/nutrition/plans/:id — Borrar plan (CASCADE a meals)
router.delete('/plans/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM nutrition_plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
