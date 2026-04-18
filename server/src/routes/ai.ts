import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import sharp from 'sharp';
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import db from '../db/client.js';
import {
  user_profile, training_plans, training_sessions, workout_logs,
  nutrition_logs, sleep, hrv, stress, daily_summary, activities,
} from '../db/schema/index.js';
import { handleAnalyze } from '../ai/index.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured, getProvider } from '../ai/providers/index.js';
import { getAssessmentContext } from '../ai/context.js';
import { getPrompt } from '../ai/prompts.js';
import { UPLOAD_DIR } from '../lib/upload-dir.js';
import type { AIMessage, AIContentBlock } from '../ai/providers/types.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

const agentUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${sanitized}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { cb(null, file.mimetype.startsWith('image/')); },
});

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function toBase64(filePath: string, mimetype: string) {
  if (SUPPORTED_IMAGE_TYPES.has(mimetype)) {
    const base64 = fs.readFileSync(filePath).toString('base64');
    return { base64, mediaType: mimetype };
  }
  const jpegBuffer = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();
  return { base64: jpegBuffer.toString('base64'), mediaType: 'image/jpeg' };
}

const ACTIVITY_KW = ['activity', 'activities', 'training', 'workout', 'sport', 'tennis', 'surf', 'kite', 'wingfoil', 'windsurf', 'gym', 'running', 'walking', 'exercise', 'session', 'sessions', 'performance', 'speed', 'distance', 'calorie', 'heart rate', 'avg hr', 'bpm', 'cycling', 'swimming', 'hiking'];
const SLEEP_KW = ['sleep', 'sleeping', 'slept', 'rest', 'sleep hours', 'deep', 'rem', 'sleep score', 'sleep quality', 'woke up', 'bedtime'];
const WELLNESS_KW = ['stress', 'hrv', 'variability', 'wellness', 'steps', 'recovery', 'readiness', 'resting hr', 'resting heart rate'];
const NUTRITION_KW = ['food', 'ate', 'lunch', 'dinner', 'breakfast', 'snack', 'diet', 'nutrition', 'protein', 'calories', 'macros', 'carbs', 'carbohydrates', 'fat', 'fiber', 'body weight', 'lose weight', 'gain weight', 'nutrition plan', 'meal'];

function detectNeeds(message: string) {
  const lower = message.toLowerCase();
  const needsActivities = ACTIVITY_KW.some(kw => lower.includes(kw));
  const needsSleep = SLEEP_KW.some(kw => lower.includes(kw));
  const needsWellness = WELLNESS_KW.some(kw => lower.includes(kw));
  const needsNutrition = NUTRITION_KW.some(kw => lower.includes(kw));
  const anyDetected = needsActivities || needsSleep || needsWellness || needsNutrition;
  return {
    activities: !anyDetected || needsActivities,
    sleep: !anyDetected || needsSleep,
    wellness: !anyDetected || needsWellness,
    nutrition: !anyDetected || needsNutrition,
  };
}

async function buildContext(needs: ReturnType<typeof detectNeeds>, userId: string): Promise<string> {
  const sections: string[] = [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profile] = await db.select().from(user_profile).where(eq(user_profile.user_id, userId));
  if (profile) {
    const sportsArr = (profile.sports as string[] | null) || [];
    const equipArr = (profile.equipment as string[] | null) || [];
    const dietArr = profile.dietary_preferences;
    const dietary = Array.isArray(dietArr) ? dietArr.join(', ') : (dietArr ? JSON.stringify(dietArr) : 'none');
    sections.push(`## User profile
- Name: ${profile.name || '-'} | Age: ${profile.age || '-'} | Sex: ${profile.sex || '-'}
- Build: ${profile.height_cm || '-'}cm / ${profile.weight_kg || '-'}kg
- Experience: ${profile.experience_level || '-'} | Goal: ${profile.primary_goal || '-'}
- Sports: ${sportsArr.join(', ') || '-'}
- Training: ${profile.training_days_per_week || '-'} days/week, ~${profile.session_duration_min || '-'}min/session
- Equipment: ${equipArr.join(', ') || '-'}
- Injuries: ${profile.injuries || 'none'}
- Dietary preferences: ${dietary}
- Targets: ${profile.daily_calorie_target || '-'}kcal | prot:${profile.daily_protein_g || '-'}g | carbs:${profile.daily_carbs_g || '-'}g | fat:${profile.daily_fat_g || '-'}g`);
  }

  const [activePlan] = await db.select({
    id: training_plans.id,
    title: training_plans.title,
    objective: training_plans.objective,
    frequency: training_plans.frequency,
  }).from(training_plans)
    .where(and(eq(training_plans.user_id, userId), eq(training_plans.status, 'active')))
    .orderBy(desc(training_plans.id)).limit(1);

  if (activePlan) {
    const sessions = await db.select({ name: training_sessions.name })
      .from(training_sessions).where(eq(training_sessions.plan_id, activePlan.id)).orderBy(training_sessions.sort_order);
    sections.push(`## Active training plan
- "${activePlan.title}" | ${activePlan.frequency || '-'}
- Objective: ${activePlan.objective || '-'}
- Sessions: ${sessions.map(s => s.name).join(', ') || '-'}`);

    const [lastWorkout] = await db.select({
      started_at: workout_logs.started_at,
      session_name: training_sessions.name,
    })
      .from(workout_logs)
      .innerJoin(training_sessions, eq(training_sessions.id, workout_logs.session_id))
      .where(and(eq(workout_logs.user_id, userId), eq(workout_logs.plan_id, activePlan.id)))
      .orderBy(desc(workout_logs.started_at))
      .limit(1);

    if (lastWorkout) {
      sections.push(`## Last completed workout
- Session: "${lastWorkout.session_name}" | Date: ${lastWorkout.started_at?.slice(0, 10) || '-'}`);
    }
  }

  const assessmentCtx = await getAssessmentContext(userId);
  if (assessmentCtx) sections.push(assessmentCtx);

  if (needs.activities) {
    const rows = await db.select({
      sport_type: activities.sport_type,
      start_time: activities.start_time,
      duration: activities.duration,
      distance: activities.distance,
      calories: activities.calories,
      avg_hr: activities.avg_hr,
      max_speed: activities.max_speed,
    }).from(activities)
      .where(and(eq(activities.user_id, userId), gte(activities.start_time, cutoff + 'T00:00:00')))
      .orderBy(desc(activities.start_time))
      .limit(40);

    if (rows.length > 0) {
      const lines = rows.map(a => {
        const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
        const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
        const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
        return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${dist} | maxSpeed:${spd} | HR:${a.avg_hr || '-'}bpm | ${a.calories || '-'}kcal`;
      });
      sections.push(`## Recent activities (30 days)\nDate | Sport | Duration | Distance | MaxSpeed | AvgHR | Calories\n${lines.join('\n')}`);
    }
  }

  if (needs.sleep) {
    const rows = await db.select({
      date: sleep.date,
      score: sleep.score,
      duration_seconds: sleep.duration_seconds,
      deep_seconds: sleep.deep_seconds,
      rem_seconds: sleep.rem_seconds,
    }).from(sleep)
      .where(and(eq(sleep.user_id, userId), sql`${sleep.date} >= ${cutoff} AND ${sleep.score} IS NOT NULL`))
      .orderBy(desc(sleep.date))
      .limit(21);

    if (rows.length > 0) {
      const lines = rows.map(s => {
        const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
        const deep = s.deep_seconds ? `${Math.round(s.deep_seconds / 60)}min` : '-';
        const rem = s.rem_seconds ? `${Math.round(s.rem_seconds / 60)}min` : '-';
        return `${s.date} | score:${s.score} | total:${dur} | deep:${deep} | REM:${rem}`;
      });
      sections.push(`## Sleep (last 3 weeks)\nDate | Score | Total | Deep | REM\n${lines.join('\n')}`);
    }
  }

  if (needs.wellness) {
    const hrvRows = await db.select({ date: hrv.date, nightly_avg: hrv.nightly_avg, status: hrv.status })
      .from(hrv).where(and(eq(hrv.user_id, userId), sql`${hrv.date} >= ${cutoff14d} AND ${hrv.nightly_avg} IS NOT NULL`)).orderBy(desc(hrv.date)).limit(14);
    const stressRows = await db.select({ date: stress.date, avg_stress: stress.avg_stress })
      .from(stress).where(and(eq(stress.user_id, userId), sql`${stress.date} >= ${cutoff14d} AND ${stress.avg_stress} IS NOT NULL`)).orderBy(desc(stress.date)).limit(14);
    const summaryRows = await db.select({ date: daily_summary.date, steps: daily_summary.steps, resting_hr: daily_summary.resting_hr })
      .from(daily_summary).where(and(eq(daily_summary.user_id, userId), sql`${daily_summary.date} >= ${cutoff14d} AND ${daily_summary.steps} IS NOT NULL`)).orderBy(desc(daily_summary.date)).limit(14);

    if (hrvRows.length > 0) {
      sections.push(`## HRV (2 weeks)\n${hrvRows.map(h => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(1)}ms | status:${h.status || '-'}`).join('\n')}`);
    }
    if (stressRows.length > 0) {
      sections.push(`## Average stress\n${stressRows.map(s => `${s.date} | stress:${s.avg_stress}`).join('\n')}`);
    }
    if (summaryRows.length > 0) {
      sections.push(`## Daily activity\n${summaryRows.map(s => `${s.date} | steps:${s.steps} | resting HR:${s.resting_hr ?? '-'}bpm`).join('\n')}`);
    }
  }

  if (needs.nutrition) {
    const nutritionRows = await db.select({
      date: nutrition_logs.date,
      cals: sql<number>`SUM(${nutrition_logs.calories})`,
      prot: sql<number>`SUM(${nutrition_logs.protein_g})`,
      carbs: sql<number>`SUM(${nutrition_logs.carbs_g})`,
      fat: sql<number>`SUM(${nutrition_logs.fat_g})`,
      meals: sql<number>`COUNT(*)`,
    })
      .from(nutrition_logs)
      .where(and(eq(nutrition_logs.user_id, userId), gte(nutrition_logs.date, cutoff7d)))
      .groupBy(nutrition_logs.date)
      .orderBy(desc(nutrition_logs.date))
      .limit(7);

    if (nutritionRows.length > 0) {
      const lines = nutritionRows.map(r =>
        `${r.date} | ${r.meals} meals | ${r.cals || 0}kcal | prot:${r.prot || 0}g | carbs:${r.carbs || 0}g | fat:${r.fat || 0}g`
      );
      sections.push(`## Nutrition (last 7 days)\nDate | Meals | Calories | Protein | Carbs | Fat\n${lines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

// POST /api/ai/chat
router.post('/chat', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages required' }); return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const lang = pickLanguageFromReq(req);
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const needs = detectNeeds(lastUser?.content || '');
  const context = await buildContext(needs, userId);

  const langRule = lang === 'es'
    ? 'CRÍTICO: Responde siempre en castellano únicamente, sin importar el idioma del mensaje del usuario o los datos del perfil.'
    : 'CRITICAL: Always respond in English only — never use Spanish or any other language, regardless of the language used in the user\'s message or in the profile data.';

  const systemPrompt = `You are DRIFT AI, this user's personal fitness coach. You analyze their real biometric and training data to provide concrete, direct, and personalized recommendations. ${langRule} You use kilometers for distances, km/h for speeds, and Xh Xm format for durations. When data doesn't support a conclusion, you say so clearly.

${context ? `User data:\n${context}` : 'No data available yet in the database.'}`;

  const aiMessages: AIMessage[] = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  await provider.streamChat({ systemPrompt, messages: aiMessages, res });
});

// POST /api/ai/analyze
router.post('/analyze', handleAnalyze);

// POST /api/ai/agent
router.post('/agent', agentUpload.single('image'), async (req: Request, res: Response) => {
  const userId = req.userId!;
  let rawMessages: { role: string; content: string }[];
  if (req.file) {
    try { rawMessages = JSON.parse(req.body.messages); }
    catch { res.status(400).json({ error: 'invalid messages' }); return; }
  } else {
    rawMessages = req.body.messages;
  }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    res.status(400).json({ error: 'messages required' }); return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const sections: string[] = [];

  const [profile] = await db.select().from(user_profile).where(eq(user_profile.user_id, userId));
  if (profile) {
    const sportsArr = (profile.sports as string[] | null) || [];
    const equipArr = (profile.equipment as string[] | null) || [];
    sections.push(`## User profile
- Name: ${profile.name || '[empty]'} | Age: ${profile.age || '[empty]'} | Sex: ${profile.sex || '[empty]'}
- Build: ${profile.height_cm || '[empty]'}cm / ${profile.weight_kg || '[empty]'}kg
- Experience: ${profile.experience_level || '[empty]'} | Goal: ${profile.primary_goal || '[empty]'}
- Sports: ${sportsArr.join(', ') || '[empty]'}
- Training: ${profile.training_days_per_week || '[empty]'} days/week, ~${profile.session_duration_min || '[empty]'}min/session
- Equipment: ${equipArr.join(', ') || '[empty]'}
- Injuries: ${profile.injuries || 'none'}
- Targets: ${profile.daily_calorie_target || '-'}kcal | prot:${profile.daily_protein_g || '-'}g | carbs:${profile.daily_carbs_g || '-'}g | fat:${profile.daily_fat_g || '-'}g`);
  } else {
    sections.push('## User profile\nNo profile configured. All fields are empty — start onboarding.');
  }

  const [activePlan] = await db.select({
    id: training_plans.id,
    title: training_plans.title,
    objective: training_plans.objective,
    frequency: training_plans.frequency,
  }).from(training_plans)
    .where(and(eq(training_plans.user_id, userId), eq(training_plans.status, 'active')))
    .orderBy(desc(training_plans.id)).limit(1);

  if (activePlan) {
    const sessionRows = await db.select({ name: training_sessions.name })
      .from(training_sessions).where(eq(training_sessions.plan_id, activePlan.id)).orderBy(training_sessions.sort_order);
    sections.push(`## Active training plan
- "${activePlan.title}" | ${activePlan.frequency || '-'}
- Objective: ${activePlan.objective || '-'}
- Sessions: ${sessionRows.map(s => s.name).join(', ') || '-'}`);
  }

  const assessmentCtx = await getAssessmentContext(userId);
  if (assessmentCtx) sections.push(assessmentCtx);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = await db.select({
    meal_slot: nutrition_logs.meal_slot,
    meal_name: nutrition_logs.meal_name,
    calories: nutrition_logs.calories,
    protein_g: nutrition_logs.protein_g,
    carbs_g: nutrition_logs.carbs_g,
    fat_g: nutrition_logs.fat_g,
  }).from(nutrition_logs)
    .where(and(eq(nutrition_logs.user_id, userId), eq(nutrition_logs.date, todayStr)))
    .orderBy(nutrition_logs.logged_at);

  if (todayLogs.length > 0) {
    const logLines = todayLogs.map(l =>
      `- ${l.meal_slot || '-'}: ${l.meal_name || '-'} | ${l.calories || 0}kcal | prot:${l.protein_g || 0}g | carbs:${l.carbs_g || 0}g | fat:${l.fat_g || 0}g`
    );
    const totals = todayLogs.reduce((acc, l) => ({
      cals: acc.cals + (l.calories || 0), prot: acc.prot + (l.protein_g || 0),
      carbs: acc.carbs + (l.carbs_g || 0), fat: acc.fat + (l.fat_g || 0),
    }), { cals: 0, prot: 0, carbs: 0, fat: 0 });
    sections.push(`## Today's nutrition (${todayLogs.length} meals logged)
${logLines.join('\n')}
**Today's total:** ${totals.cals}kcal | prot:${totals.prot}g | carbs:${totals.carbs}g | fat:${totals.fat}g`);
  } else {
    sections.push("## Today's nutrition\nNo meals logged yet.");
  }

  const agentLang = pickLanguageFromReq(req);
  const context = sections.join('\n\n');
  const systemPrompt = `${getPrompt('agent', agentLang)}\n\nCurrent user data:\n${context}`;

  const aiMessages: AIMessage[] = rawMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  if (req.file) {
    try {
      const { base64, mediaType } = await toBase64(req.file.path, req.file.mimetype);
      const imagePath = req.file.filename;
      const lastIdx = aiMessages.length - 1;
      const lastText = typeof aiMessages[lastIdx].content === 'string'
        ? (aiMessages[lastIdx].content as string)
        : 'Analyze this food image and log it.';
      const blocks: AIContentBlock[] = [
        { type: 'image', mediaType, base64 },
        { type: 'text', text: `${lastText}\n\n[Image uploaded: /uploads/${imagePath}]` },
      ];
      aiMessages[lastIdx] = { role: 'user', content: blocks };
    } catch (err: any) {
      console.error('[agent] Image processing error:', err.message);
    }
  }

  await provider.streamAgent({ systemPrompt, messages: aiMessages, res, userId });
});

export default router;
