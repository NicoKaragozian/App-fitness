import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import sharp from 'sharp';
import db from '../db.js';
import { handleAnalyze } from '../ai/index.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured, getProvider } from '../ai/providers/index.js';
import { getAssessmentContext } from '../ai/context.js';
import { getPrompt } from '../ai/prompts.js';
import { UPLOAD_DIR } from '../lib/upload-dir.js';
import type { AIMessage, AIContentBlock } from '../ai/providers/types.js';

const router = Router();

// Multer for agent image uploads
const agentUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${sanitized}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
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

// Keywords to detect which context to load
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

function buildContext(needs: ReturnType<typeof detectNeeds>): string {
  const sections: string[] = [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (profile) {
    const sports = JSON.parse(profile.sports || '[]').join(', ') || '-';
    const equipment = JSON.parse(profile.equipment || '[]').join(', ') || '-';
    const dietary = JSON.parse(profile.dietary_preferences || '[]').join(', ') || 'none';
    sections.push(`## User profile
- Name: ${profile.name || '-'} | Age: ${profile.age || '-'} | Sex: ${profile.sex || '-'}
- Build: ${profile.height_cm || '-'}cm / ${profile.weight_kg || '-'}kg
- Experience: ${profile.experience_level || '-'} | Goal: ${profile.primary_goal || '-'}
- Sports: ${sports}
- Training: ${profile.training_days_per_week || '-'} days/week, ~${profile.session_duration_min || '-'}min/session
- Equipment: ${equipment}
- Injuries: ${profile.injuries || 'none'}
- Dietary preferences: ${dietary}
- Targets: ${profile.daily_calorie_target || '-'}kcal | prot:${profile.daily_protein_g || '-'}g | carbs:${profile.daily_carbs_g || '-'}g | fat:${profile.daily_fat_g || '-'}g`);
  }

  const activePlan = db.prepare(
    'SELECT id, title, objective, frequency FROM training_plans WHERE status = ? ORDER BY id DESC LIMIT 1'
  ).get('active') as any;
  if (activePlan) {
    const sessions = db.prepare(
      'SELECT name FROM training_sessions WHERE plan_id = ? ORDER BY sort_order'
    ).all(activePlan.id) as any[];
    const sessionNames = sessions.map((s: any) => s.name).join(', ');
    sections.push(`## Active training plan
- "${activePlan.title}" | ${activePlan.frequency || '-'}
- Objective: ${activePlan.objective || '-'}
- Sessions: ${sessionNames || '-'}`);

    const lastWorkout = db.prepare(
      `SELECT wl.started_at, ts.name as session_name
       FROM workout_logs wl
       JOIN training_sessions ts ON ts.id = wl.session_id
       WHERE wl.plan_id = ?
       ORDER BY wl.started_at DESC LIMIT 1`
    ).get(activePlan.id) as any;
    if (lastWorkout) {
      sections.push(`## Last completed workout
- Session: "${lastWorkout.session_name}" | Date: ${lastWorkout.started_at?.slice(0, 10) || '-'}`);
    }
  }

  const assessmentCtx = getAssessmentContext();
  if (assessmentCtx) sections.push(assessmentCtx);

  if (needs.activities) {
    const rows = db.prepare(`
      SELECT sport_type, start_time, duration, distance, calories, avg_hr, max_speed
      FROM activities WHERE start_time >= ? ORDER BY start_time DESC LIMIT 40
    `).all(cutoff + 'T00:00:00') as any[];
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
    const rows = db.prepare(`
      SELECT date, score, duration_seconds, deep_seconds, rem_seconds
      FROM sleep WHERE date >= ? AND score IS NOT NULL ORDER BY date DESC LIMIT 21
    `).all(cutoff) as any[];
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
    const hrv = db.prepare(`
      SELECT date, nightly_avg, status FROM hrv
      WHERE date >= ? AND nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[];
    const stress = db.prepare(`
      SELECT date, avg_stress FROM stress
      WHERE date >= ? AND avg_stress IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[];
    const summary = db.prepare(`
      SELECT date, steps, resting_hr FROM daily_summary
      WHERE date >= ? AND steps IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[];

    if (hrv.length > 0) {
      const lines = hrv.map((h: any) => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(1)}ms | status:${h.status || '-'}`);
      sections.push(`## HRV (2 weeks)\n${lines.join('\n')}`);
    }
    if (stress.length > 0) {
      const lines = stress.map((s: any) => `${s.date} | stress:${s.avg_stress}`);
      sections.push(`## Average stress\n${lines.join('\n')}`);
    }
    if (summary.length > 0) {
      const lines = summary.map((s: any) => `${s.date} | steps:${s.steps} | resting HR:${s.resting_hr ?? '-'}bpm`);
      sections.push(`## Daily activity\n${lines.join('\n')}`);
    }
  }

  if (needs.nutrition) {
    const nutritionRows = db.prepare(`
      SELECT date,
        SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat,
        COUNT(*) as meals
      FROM nutrition_logs WHERE date >= ?
      GROUP BY date ORDER BY date DESC LIMIT 7
    `).all(cutoff7d) as any[];
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
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages required' });
    return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` });
    return;
  }

  const lang = pickLanguageFromReq(req);
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const needs = detectNeeds(lastUser?.content || '');
  const context = buildContext(needs);

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

// POST /api/ai/analyze — Unified contextual analysis endpoint
router.post('/analyze', handleAnalyze);

// POST /api/ai/agent — Agentic chat with tool use
// Accepts JSON body or multipart/form-data with optional image
router.post('/agent', agentUpload.single('image'), async (req: Request, res: Response) => {
  let rawMessages: { role: string; content: string }[];
  if (req.file) {
    try {
      rawMessages = JSON.parse(req.body.messages);
    } catch {
      res.status(400).json({ error: 'invalid messages' });
      return;
    }
  } else {
    rawMessages = req.body.messages;
  }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    res.status(400).json({ error: 'messages required' });
    return;
  }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` });
    return;
  }

  // Build slim always-on context
  const sections: string[] = [];

  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (profile) {
    const sports = JSON.parse(profile.sports || '[]').join(', ') || '-';
    const equipment = JSON.parse(profile.equipment || '[]').join(', ') || '-';
    sections.push(`## User profile
- Name: ${profile.name || '[empty]'} | Age: ${profile.age || '[empty]'} | Sex: ${profile.sex || '[empty]'}
- Build: ${profile.height_cm || '[empty]'}cm / ${profile.weight_kg || '[empty]'}kg
- Experience: ${profile.experience_level || '[empty]'} | Goal: ${profile.primary_goal || '[empty]'}
- Sports: ${sports || '[empty]'}
- Training: ${profile.training_days_per_week || '[empty]'} days/week, ~${profile.session_duration_min || '[empty]'}min/session
- Equipment: ${equipment || '[empty]'}
- Injuries: ${profile.injuries || 'none'}
- Targets: ${profile.daily_calorie_target || '-'}kcal | prot:${profile.daily_protein_g || '-'}g | carbs:${profile.daily_carbs_g || '-'}g | fat:${profile.daily_fat_g || '-'}g`);
  } else {
    sections.push('## User profile\nNo profile configured. All fields are empty — start onboarding.');
  }

  const activePlan = db.prepare(
    'SELECT id, title, objective, frequency FROM training_plans WHERE status = ? ORDER BY id DESC LIMIT 1'
  ).get('active') as any;
  if (activePlan) {
    const sessionRows = db.prepare(
      'SELECT name FROM training_sessions WHERE plan_id = ? ORDER BY sort_order'
    ).all(activePlan.id) as any[];
    sections.push(`## Active training plan
- "${activePlan.title}" | ${activePlan.frequency || '-'}
- Objective: ${activePlan.objective || '-'}
- Sessions: ${sessionRows.map((s: any) => s.name).join(', ') || '-'}`);
  }

  const assessmentCtx = getAssessmentContext();
  if (assessmentCtx) sections.push(assessmentCtx);

  // Today's nutrition
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = db.prepare(
    'SELECT meal_slot, meal_name, calories, protein_g, carbs_g, fat_g FROM nutrition_logs WHERE date = ? ORDER BY logged_at'
  ).all(todayStr) as any[];
  if (todayLogs.length > 0) {
    const logLines = todayLogs.map((l: any) =>
      `- ${l.meal_slot || '-'}: ${l.meal_name || '-'} | ${l.calories || 0}kcal | prot:${l.protein_g || 0}g | carbs:${l.carbs_g || 0}g | fat:${l.fat_g || 0}g`
    );
    const totals = todayLogs.reduce((acc: any, l: any) => ({
      cals: acc.cals + (l.calories || 0),
      prot: acc.prot + (l.protein_g || 0),
      carbs: acc.carbs + (l.carbs_g || 0),
      fat: acc.fat + (l.fat_g || 0),
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

  // Build AIMessages — handle image on last user message if present
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

  await provider.streamAgent({ systemPrompt, messages: aiMessages, res });
});

export default router;
