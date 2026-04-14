import { Router, Request, Response } from 'express';
import db from '../db.js';
import { handleAnalyze } from '../ai/index.js';
import { claudeStreamChat, isClaudeConfigured } from '../ai/claude.js';

const router = Router();

// Keywords para detectar qué contexto cargar
const ACTIVITY_KW = ['actividad', 'actividades', 'entreno', 'entrenamiento', 'deporte', 'tenis', 'tennis', 'surf', 'kite', 'wingfoil', 'windsurf', 'gym', 'carrera', 'running', 'caminata', 'ejercicio', 'sesión', 'sesiones', 'rendimiento', 'velocidad', 'distancia', 'caloría', 'frecuencia cardíaca', 'fc prom', 'bpm', 'sport', 'activity', 'cycling', 'ciclismo', 'natación', 'swimming', 'hiking'];
const SLEEP_KW = ['sueño', 'dormir', 'dormí', 'descanso', 'sleep', 'horas de sueño', 'profundo', 'rem', 'score sueño', 'calidad del sueño', 'desperté', 'hora de dormir'];
const WELLNESS_KW = ['estrés', 'estres', 'stress', 'hrv', 'variabilidad', 'bienestar', 'wellness', 'pasos', 'steps', 'recuperación', 'readiness', 'fc reposo', 'frecuencia en reposo'];
const NUTRITION_KW = ['comida', 'comí', 'como', 'almuerzo', 'cena', 'desayuno', 'merienda', 'snack', 'dieta', 'nutrición', 'nutricion', 'proteína', 'proteina', 'calorías', 'calorias', 'macros', 'carbohidratos', 'carbos', 'grasa', 'fibra', 'peso corporal', 'bajar de peso', 'subir de peso', 'plan nutricional', 'meal', 'food', 'nutrition'];

function detectNeeds(message: string): { activities: boolean; sleep: boolean; wellness: boolean; nutrition: boolean } {
  const lower = message.toLowerCase();
  const needsActivities = ACTIVITY_KW.some(kw => lower.includes(kw));
  const needsSleep = SLEEP_KW.some(kw => lower.includes(kw));
  const needsWellness = WELLNESS_KW.some(kw => lower.includes(kw));
  const needsNutrition = NUTRITION_KW.some(kw => lower.includes(kw));
  // Si no se detectó nada específico, traer todo (primera pregunta genérica)
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

  // Siempre inyectar perfil del usuario
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (profile) {
    const sports = JSON.parse(profile.sports || '[]').join(', ') || '-';
    const equipment = JSON.parse(profile.equipment || '[]').join(', ') || '-';
    const dietary = JSON.parse(profile.dietary_preferences || '[]').join(', ') || 'ninguna';
    sections.push(`## Perfil del usuario
- Nombre: ${profile.name || '-'} | Edad: ${profile.age || '-'} | Sexo: ${profile.sex || '-'}
- Físico: ${profile.height_cm || '-'}cm / ${profile.weight_kg || '-'}kg
- Experiencia: ${profile.experience_level || '-'} | Objetivo: ${profile.primary_goal || '-'}
- Deportes: ${sports}
- Entrenamiento: ${profile.training_days_per_week || '-'} días/semana, ~${profile.session_duration_min || '-'}min/sesión
- Equipamiento: ${equipment}
- Lesiones: ${profile.injuries || 'ninguna'}
- Preferencias dietarias: ${dietary}
- Targets: ${profile.daily_calorie_target || '-'}kcal | prot:${profile.daily_protein_g || '-'}g | carbs:${profile.daily_carbs_g || '-'}g | grasa:${profile.daily_fat_g || '-'}g`);
  }

  // Siempre inyectar plan de entrenamiento activo + último workout
  const activePlan = db.prepare(
    'SELECT id, title, objective, frequency FROM training_plans WHERE status = ? ORDER BY id DESC LIMIT 1'
  ).get('active') as any;
  if (activePlan) {
    const sessions = db.prepare(
      'SELECT name FROM training_sessions WHERE plan_id = ? ORDER BY sort_order'
    ).all(activePlan.id) as any[];
    const sessionNames = sessions.map((s: any) => s.name).join(', ');
    sections.push(`## Plan de entrenamiento activo
- "${activePlan.title}" | ${activePlan.frequency || '-'}
- Objetivo: ${activePlan.objective || '-'}
- Sesiones: ${sessionNames || '-'}`);

    const lastWorkout = db.prepare(
      `SELECT wl.started_at, wl.completed_at, ts.name as session_name
       FROM workout_logs wl
       JOIN training_sessions ts ON ts.id = wl.session_id
       WHERE wl.plan_id = ?
       ORDER BY wl.started_at DESC LIMIT 1`
    ).get(activePlan.id) as any;
    if (lastWorkout) {
      const date = lastWorkout.started_at?.slice(0, 10) || '-';
      sections.push(`## Último workout completado
- Sesión: "${lastWorkout.session_name}" | Fecha: ${date}`);
    }
  }

  if (needs.activities) {
    const rows = (db.prepare(`
      SELECT sport_type, start_time, duration, distance, calories, avg_hr, max_speed
      FROM activities WHERE start_time >= ? ORDER BY start_time DESC LIMIT 40
    `).all(cutoff + 'T00:00:00') as any[]);
    if (rows.length > 0) {
      const lines = rows.map(a => {
        const date = a.start_time.slice(0, 10);
        const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
        const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
        const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
        const hr = a.avg_hr ? `${a.avg_hr}bpm` : '-';
        const kcal = a.calories ? `${a.calories}kcal` : '-';
        return `${date} | ${a.sport_type} | ${dur} | ${dist} | velMax:${spd} | FC:${hr} | ${kcal}`;
      });
      sections.push(`## Actividades recientes (30 días)\nFecha | Deporte | Duración | Distancia | VelMax | FC.Prom | Calorías\n${lines.join('\n')}`);
    }
  }

  if (needs.sleep) {
    const rows = (db.prepare(`
      SELECT date, score, duration_seconds, deep_seconds, rem_seconds
      FROM sleep WHERE date >= ? AND score IS NOT NULL ORDER BY date DESC LIMIT 21
    `).all(cutoff) as any[]);
    if (rows.length > 0) {
      const lines = rows.map(s => {
        const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
        const deep = s.deep_seconds ? `${Math.round(s.deep_seconds / 60)}min` : '-';
        const rem = s.rem_seconds ? `${Math.round(s.rem_seconds / 60)}min` : '-';
        return `${s.date} | score:${s.score} | total:${dur} | profundo:${deep} | REM:${rem}`;
      });
      // Diff vs baseline 14d
      const recent = rows.slice(0, 3);
      const baseline = rows.slice(0, 14);
      if (baseline.length >= 3 && recent[0]?.score) {
        const avgBaseline = baseline.reduce((s, r) => s + (r.score || 0), 0) / baseline.length;
        const diffPct = Math.round(((recent[0].score - avgBaseline) / avgBaseline) * 100);
        const trend = diffPct > 5 ? '↑ mejorando' : diffPct < -5 ? '↓ empeorando' : '→ estable';
        sections.push(`## Sueño (últimas 3 semanas) — tendencia: ${trend} (${diffPct > 0 ? '+' : ''}${diffPct}% vs baseline 14d)\nFecha | Score | Total | Profundo | REM\n${lines.join('\n')}`);
      } else {
        sections.push(`## Sueño (últimas 3 semanas)\nFecha | Score | Total | Profundo | REM\n${lines.join('\n')}`);
      }
    }
  }

  if (needs.wellness) {
    const hrv = (db.prepare(`
      SELECT date, nightly_avg, status FROM hrv
      WHERE date >= ? AND nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[]);
    const stress = (db.prepare(`
      SELECT date, avg_stress FROM stress
      WHERE date >= ? AND avg_stress IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[]);
    const summary = (db.prepare(`
      SELECT date, steps, resting_hr FROM daily_summary
      WHERE date >= ? AND steps IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff14d) as any[]);

    if (hrv.length > 0) {
      // Diff HRV vs baseline
      let trendNote = '';
      if (hrv.length >= 3) {
        const last = hrv[0].nightly_avg;
        const baseline14 = hrv.reduce((s: number, r: any) => s + (r.nightly_avg || 0), 0) / hrv.length;
        const diffPct = Math.round(((last - baseline14) / baseline14) * 100);
        trendNote = ` — último vs baseline: ${diffPct > 0 ? '+' : ''}${diffPct}%${Math.abs(diffPct) > 7 ? (diffPct < 0 ? ' ⚠ caída significativa' : ' ↑ buena recuperación') : ''}`;
      }
      const lines = hrv.map(h => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(1)}ms | estado:${h.status || '-'}`);
      sections.push(`## HRV (2 semanas)${trendNote}\n${lines.join('\n')}`);
    }
    if (stress.length > 0) {
      // Diff stress vs baseline
      let trendNote = '';
      if (stress.length >= 3) {
        const last = stress[0].avg_stress;
        const baseline14 = stress.reduce((s: number, r: any) => s + (r.avg_stress || 0), 0) / stress.length;
        const diffPct = Math.round(((last - baseline14) / baseline14) * 100);
        trendNote = ` — último vs baseline: ${diffPct > 0 ? '+' : ''}${diffPct}%`;
      }
      const lines = stress.map(s => `${s.date} | estrés:${s.avg_stress}`);
      sections.push(`## Estrés promedio${trendNote}\n${lines.join('\n')}`);
    }
    if (summary.length > 0) {
      const lines = summary.map(s => `${s.date} | pasos:${s.steps} | FC.reposo:${s.resting_hr ?? '-'}bpm`);
      sections.push(`## Actividad diaria\n${lines.join('\n')}`);
    }
  }

  if (needs.nutrition) {
    const nutritionRows = (db.prepare(`
      SELECT date,
        SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat,
        COUNT(*) as meals
      FROM nutrition_logs WHERE date >= ?
      GROUP BY date ORDER BY date DESC LIMIT 7
    `).all(cutoff7d) as any[]);

    if (nutritionRows.length > 0) {
      const lines = nutritionRows.map(r =>
        `${r.date} | ${r.meals} comidas | ${r.cals || 0}kcal | prot:${r.prot || 0}g | carbs:${r.carbs || 0}g | grasa:${r.fat || 0}g`
      );
      sections.push(`## Nutrición (últimos 7 días)\nFecha | Comidas | Calorías | Proteína | Carbos | Grasa\n${lines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

router.post('/chat', async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages requerido' });
    return;
  }

  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurado en server/.env' });
    return;
  }

  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const needs = detectNeeds(lastUser?.content || '');
  const context = buildContext(needs);

  const systemPrompt = `Sos DRIFT AI, el coach personal de fitness de este usuario. Analizás sus datos biométricos y de entrenamiento reales para dar recomendaciones concretas, directas y personalizadas. Respondés siempre en español. Usás kilómetros para distancias, km/h para velocidades, y formato Xh Xm para duraciones. Cuando los datos no apoyan una conclusión, lo decís claramente.

${context ? `Datos del usuario:\n${context}` : 'Aún no hay datos disponibles en la base de datos.'}`;

  const claudeMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  await claudeStreamChat(systemPrompt, claudeMessages, res);
});

// POST /api/ai/analyze — Unified contextual analysis endpoint
router.post('/analyze', handleAnalyze);

export default router;
