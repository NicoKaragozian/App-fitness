import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { eq, asc, desc, gte, lte, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { nutrition_logs, nutrition_plans, nutrition_plan_meals, user_profile } from '../db/schema/index.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured } from '../ai/providers/index.js';
import { modelNameFor } from '../ai/config.js';
import { getPrompt } from '../ai/prompts.js';
import { buildNutritionPlanContext, buildNutritionChatContext } from '../ai/nutrition-context.js';
import { UPLOAD_DIR } from '../lib/upload-dir.js';

const router = Router();

const DEFAULT_TARGETS = {
  daily_calorie_target: 2000,
  daily_protein_g: 150,
  daily_carbs_g: 250,
  daily_fat_g: 65,
};

async function getMacroTargets(): Promise<typeof DEFAULT_TARGETS> {
  const [profile] = await db.select({
    daily_calorie_target: user_profile.daily_calorie_target,
    daily_protein_g: user_profile.daily_protein_g,
    daily_carbs_g: user_profile.daily_carbs_g,
    daily_fat_g: user_profile.daily_fat_g,
  }).from(user_profile).where(eq(user_profile.id, 1));

  if (profile?.daily_calorie_target) {
    return {
      daily_calorie_target: profile.daily_calorie_target,
      daily_protein_g: profile.daily_protein_g ?? DEFAULT_TARGETS.daily_protein_g,
      daily_carbs_g: profile.daily_carbs_g ?? DEFAULT_TARGETS.daily_carbs_g,
      daily_fat_g: profile.daily_fat_g ?? DEFAULT_TARGETS.daily_fat_g,
    };
  }
  return DEFAULT_TARGETS;
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are accepted'));
  },
});

const CLAUDE_SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function toClaudeCompatible(filePath: string, mimetype: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  if (CLAUDE_SUPPORTED.has(mimetype)) {
    const base64 = fs.readFileSync(filePath).toString('base64');
    return { base64, mediaType: mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' };
  }
  const jpegBuffer = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();
  return { base64: jpegBuffer.toString('base64'), mediaType: 'image/jpeg' };
}

// POST /api/nutrition/analyze
router.post('/analyze', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No image received' }); return; }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    fs.unlink(req.file.path, () => {});
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  try {
    const { base64: imageBase64, mediaType } = await toClaudeCompatible(req.file.path, req.file.mimetype);
    const imagePath = path.basename(req.file.path);
    const langAnalyze = pickLanguageFromReq(req);
    await provider.visionStream(
      getPrompt('food_vision', langAnalyze),
      'Analyze this food image and return the JSON with estimated macronutrients.',
      imageBase64, mediaType, imagePath, res
    );
  } catch (err: any) {
    console.error('[nutrition] analyze error:', err.message);
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/nutrition/logs
router.post('/logs', async (req: Request, res: Response) => {
  const {
    date, meal_slot, meal_name, description,
    calories, protein_g, carbs_g, fat_g, fiber_g,
    image_path, ai_model, ai_confidence, raw_ai_response,
  } = req.body;

  if (!date) { res.status(400).json({ error: 'date is required' }); return; }

  const [row] = await db.insert(nutrition_logs).values({
    date,
    logged_at: new Date().toISOString(),
    meal_slot: meal_slot || null,
    meal_name: meal_name || null,
    description: description || null,
    calories: calories ?? null,
    protein_g: protein_g ?? null,
    carbs_g: carbs_g ?? null,
    fat_g: fat_g ?? null,
    fiber_g: fiber_g ?? null,
    image_path: image_path || null,
    ai_model: ai_model || null,
    ai_confidence: ai_confidence || null,
    raw_ai_response: raw_ai_response || null,
  }).returning({ id: nutrition_logs.id });

  res.json({ id: row.id });
});

// GET /api/nutrition/logs
router.get('/logs', async (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  const logs = await db.select().from(nutrition_logs)
    .where(eq(nutrition_logs.date, date))
    .orderBy(asc(nutrition_logs.logged_at));

  const totals = logs.reduce(
    (acc, r) => ({
      calories: acc.calories + (r.calories || 0),
      protein_g: acc.protein_g + (r.protein_g || 0),
      carbs_g: acc.carbs_g + (r.carbs_g || 0),
      fat_g: acc.fat_g + (r.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const targets = await getMacroTargets();
  const [profileExists] = await db.select({ id: user_profile.id }).from(user_profile).where(eq(user_profile.id, 1));

  res.json({ logs, totals, targets, hasProfile: Boolean(profileExists) });
});

// GET /api/nutrition/logs/range
router.get('/logs/range', async (req: Request, res: Response) => {
  const { from, to } = req.query as { from: string; to: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }

  const rows = await db.select({
    date: nutrition_logs.date,
    calories: sql<number>`SUM(${nutrition_logs.calories})`,
    protein_g: sql<number>`SUM(${nutrition_logs.protein_g})`,
    carbs_g: sql<number>`SUM(${nutrition_logs.carbs_g})`,
    fat_g: sql<number>`SUM(${nutrition_logs.fat_g})`,
    log_count: sql<number>`COUNT(*)`,
  })
    .from(nutrition_logs)
    .where(sql`${nutrition_logs.date} >= ${from} AND ${nutrition_logs.date} <= ${to}`)
    .groupBy(nutrition_logs.date)
    .orderBy(asc(nutrition_logs.date));

  res.json({ days: rows });
});

// PUT /api/nutrition/logs/:id
router.put('/logs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = ['meal_slot', 'meal_name', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const;
  const updates: Partial<typeof nutrition_logs.$inferInsert> = {};

  for (const f of fields) {
    if (req.body[f] !== undefined) (updates as any)[f] = req.body[f];
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  await db.update(nutrition_logs).set(updates).where(eq(nutrition_logs.id, parseInt(id)));
  res.json({ ok: true });
});

// DELETE /api/nutrition/logs/:id
router.delete('/logs/:id', async (req: Request, res: Response) => {
  const [row] = await db.select({ image_path: nutrition_logs.image_path })
    .from(nutrition_logs).where(eq(nutrition_logs.id, parseInt(req.params.id)));
  await db.delete(nutrition_logs).where(eq(nutrition_logs.id, parseInt(req.params.id)));

  if (row?.image_path) {
    const fullPath = path.join(UPLOAD_DIR, row.image_path);
    fs.unlink(fullPath, () => {});
  }
  res.json({ ok: true });
});

// POST /api/nutrition/plans/generate
router.post('/plans/generate', async (req: Request, res: Response) => {
  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const { strategy, linkedTrainingPlanId, dietaryPreferences } = req.body;

  if (dietaryPreferences && typeof dietaryPreferences === 'object') {
    await db.insert(user_profile).values({
      id: 1,
      dietary_preferences: dietaryPreferences,
      updated_at: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: user_profile.id,
      set: { dietary_preferences: dietaryPreferences, updated_at: new Date().toISOString() },
    });
  }

  const langPlan = pickLanguageFromReq(req);
  const context = await buildNutritionPlanContext(strategy);
  const modelName = modelNameFor(provider.name);

  await provider.streamGenerate(
    getPrompt('nutrition_plan', langPlan),
    `Generate a flexible nutrition plan with this data:\n\n${context}`,
    res,
    {
      maxTokens: 8192,
      beforeDone: async (rawResponse: string) => {
        let plan: any;
        try {
          let jsonStr = rawResponse.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          }
          plan = JSON.parse(jsonStr);
        } catch {
          console.error('[nutrition] plan parse error, raw:', rawResponse.slice(0, 500));
          res.write(`data: ${JSON.stringify({ error: 'Could not parse response. Try again.' })}\n\n`);
          return;
        }

        if (!plan.meals || !Array.isArray(plan.meals) || plan.meals.length === 0) {
          res.write(`data: ${JSON.stringify({ error: 'Generated plan has no valid meals. Try again.' })}\n\n`);
          return;
        }

        try {
          const planId = await db.transaction(async (tx) => {
            const [planRow] = await tx.insert(nutrition_plans).values({
              training_plan_id: linkedTrainingPlanId || null,
              title: plan.title || 'Nutrition Plan',
              daily_calories: plan.daily_calories || null,
              daily_protein_g: plan.daily_protein_g || null,
              daily_carbs_g: plan.daily_carbs_g || null,
              daily_fat_g: plan.daily_fat_g || null,
              strategy: plan.strategy || strategy || 'maintain',
              rationale: plan.rationale || null,
              ai_model: modelName,
              raw_ai_response: rawResponse,
              created_at: new Date().toISOString(),
            }).returning({ id: nutrition_plans.id });

            const pId = planRow.id;

            for (const meal of plan.meals) {
              await tx.insert(nutrition_plan_meals).values({
                plan_id: pId,
                slot: meal.slot || null,
                option_number: meal.option_number || 1,
                name: meal.name || null,
                description: meal.description || null,
                calories: meal.calories || null,
                protein_g: meal.protein_g || null,
                carbs_g: meal.carbs_g || null,
                fat_g: meal.fat_g || null,
              });
            }

            if (plan.daily_calories && plan.daily_protein_g && plan.daily_carbs_g && plan.daily_fat_g) {
              await tx.insert(user_profile).values({
                id: 1,
                daily_calorie_target: plan.daily_calories,
                daily_protein_g: plan.daily_protein_g,
                daily_carbs_g: plan.daily_carbs_g,
                daily_fat_g: plan.daily_fat_g,
                updated_at: new Date().toISOString(),
              }).onConflictDoUpdate({
                target: user_profile.id,
                set: {
                  daily_calorie_target: plan.daily_calories,
                  daily_protein_g: plan.daily_protein_g,
                  daily_carbs_g: plan.daily_carbs_g,
                  daily_fat_g: plan.daily_fat_g,
                  updated_at: new Date().toISOString(),
                },
              });
            }

            return pId;
          });

          const [saved] = await db.select().from(nutrition_plans).where(eq(nutrition_plans.id, planId));
          const meals = await db.select().from(nutrition_plan_meals)
            .where(eq(nutrition_plan_meals.plan_id, planId))
            .orderBy(asc(nutrition_plan_meals.id));
          res.write(`data: ${JSON.stringify({ plan: { ...saved, meals }, done: true })}\n\n`);
        } catch (err: any) {
          console.error('[nutrition] DB insert error:', err.message);
          res.write(`data: ${JSON.stringify({ error: 'Error saving plan to database.' })}\n\n`);
        }
      },
    }
  );
});

// GET /api/nutrition/plans
router.get('/plans', async (_req: Request, res: Response) => {
  const plans = await db.select({
    id: nutrition_plans.id,
    training_plan_id: nutrition_plans.training_plan_id,
    title: nutrition_plans.title,
    daily_calories: nutrition_plans.daily_calories,
    daily_protein_g: nutrition_plans.daily_protein_g,
    daily_carbs_g: nutrition_plans.daily_carbs_g,
    daily_fat_g: nutrition_plans.daily_fat_g,
    strategy: nutrition_plans.strategy,
    rationale: nutrition_plans.rationale,
    ai_model: nutrition_plans.ai_model,
    created_at: nutrition_plans.created_at,
    meal_count: sql<number>`COUNT(${nutrition_plan_meals.id})`,
  })
    .from(nutrition_plans)
    .leftJoin(nutrition_plan_meals, eq(nutrition_plan_meals.plan_id, nutrition_plans.id))
    .groupBy(nutrition_plans.id)
    .orderBy(desc(nutrition_plans.created_at));

  res.json(plans);
});

// GET /api/nutrition/plans/:id
router.get('/plans/:id', async (req: Request, res: Response) => {
  const [plan] = await db.select().from(nutrition_plans).where(eq(nutrition_plans.id, parseInt(req.params.id)));
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
  const meals = await db.select().from(nutrition_plan_meals)
    .where(eq(nutrition_plan_meals.plan_id, plan.id))
    .orderBy(asc(nutrition_plan_meals.id));
  res.json({ ...plan, meals });
});

// DELETE /api/nutrition/plans/:id
router.delete('/plans/:id', async (req: Request, res: Response) => {
  await db.delete(nutrition_plans).where(eq(nutrition_plans.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

// POST /api/nutrition/chat
router.post('/chat', async (req: Request, res: Response) => {
  const { messages, date } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages required' }); return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const langChat = pickLanguageFromReq(req);
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const context = await buildNutritionChatContext(targetDate);
  const systemPrompt = `${getPrompt('nutrition_chat', langChat)}\n\nUser data:\n${context}`;

  const aiMessages = (messages as any[])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  await provider.streamChat({ systemPrompt, messages: aiMessages, res });
});

export default router;
