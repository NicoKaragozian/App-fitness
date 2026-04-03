import { Router, Request, Response } from 'express';
import db from '../db.js';
import { handleAnalyze } from '../ai/index.js';

const router = Router();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Keywords para detectar qué contexto cargar
const ACTIVITY_KW = ['actividad', 'actividades', 'entreno', 'entrenamiento', 'deporte', 'tenis', 'tennis', 'surf', 'kite', 'wingfoil', 'windsurf', 'gym', 'carrera', 'running', 'caminata', 'ejercicio', 'sesión', 'sesiones', 'rendimiento', 'velocidad', 'distancia', 'caloría', 'frecuencia cardíaca', 'fc prom', 'bpm', 'sport', 'activity', 'cycling', 'ciclismo', 'natación', 'swimming', 'hiking'];
const SLEEP_KW = ['sueño', 'dormir', 'dormí', 'descanso', 'sleep', 'horas de sueño', 'profundo', 'rem', 'score sueño', 'calidad del sueño', 'desperté', 'hora de dormir'];
const WELLNESS_KW = ['estrés', 'estres', 'stress', 'hrv', 'variabilidad', 'bienestar', 'wellness', 'pasos', 'steps', 'recuperación', 'readiness', 'fc reposo', 'frecuencia en reposo'];

function detectNeeds(message: string): { activities: boolean; sleep: boolean; wellness: boolean } {
  const lower = message.toLowerCase();
  const needsActivities = ACTIVITY_KW.some(kw => lower.includes(kw));
  const needsSleep = SLEEP_KW.some(kw => lower.includes(kw));
  const needsWellness = WELLNESS_KW.some(kw => lower.includes(kw));
  // Si no se detectó nada específico, traer todo (primera pregunta genérica)
  const anyDetected = needsActivities || needsSleep || needsWellness;
  return {
    activities: !anyDetected || needsActivities,
    sleep: !anyDetected || needsSleep,
    wellness: !anyDetected || needsWellness,
  };
}

function buildContext(needs: ReturnType<typeof detectNeeds>): string {
  const sections: string[] = [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
      sections.push(`## Sueño (últimas 3 semanas)\nFecha | Score | Total | Profundo | REM\n${lines.join('\n')}`);
    }
  }

  if (needs.wellness) {
    const hrv = (db.prepare(`
      SELECT date, nightly_avg, status FROM hrv
      WHERE date >= ? AND nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff) as any[]);
    const stress = (db.prepare(`
      SELECT date, avg_stress FROM stress
      WHERE date >= ? AND avg_stress IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff) as any[]);
    const summary = (db.prepare(`
      SELECT date, steps, resting_hr FROM daily_summary
      WHERE date >= ? AND steps IS NOT NULL ORDER BY date DESC LIMIT 14
    `).all(cutoff) as any[]);

    if (hrv.length > 0) {
      const lines = hrv.map(h => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(1)}ms | estado:${h.status || '-'}`);
      sections.push(`## HRV (2 semanas)\n${lines.join('\n')}`);
    }
    if (stress.length > 0) {
      const lines = stress.map(s => `${s.date} | estrés:${s.avg_stress}`);
      sections.push(`## Estrés promedio\n${lines.join('\n')}`);
    }
    if (summary.length > 0) {
      const lines = summary.map(s => `${s.date} | pasos:${s.steps} | FC.reposo:${s.resting_hr ?? '-'}bpm`);
      sections.push(`## Actividad diaria\n${lines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

// Valida que el nombre de modelo sea seguro (solo chars válidos de Ollama)
function isValidModelName(name: string): boolean {
  return typeof name === 'string' && /^[a-zA-Z0-9._:\-/]+$/.test(name) && name.length < 100;
}

router.post('/chat', async (req: Request, res: Response) => {
  const { messages, model: requestedModel } = req.body as { messages: { role: string; content: string }[]; model?: string };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages requerido' });
    return;
  }

  const model = (requestedModel && isValidModelName(requestedModel)) ? requestedModel : OLLAMA_MODEL;

  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  console.log(`[ai] modelo: ${model}`);
  const needs = detectNeeds(lastUser?.content || '');
  const context = buildContext(needs);

  const systemPrompt = `Eres Drift AI, el coach personal de fitness de este usuario. Analizás sus datos biométricos y de entrenamiento reales para dar recomendaciones concretas, directas y personalizadas. Respondés siempre en español. Usás kilómetros para distancias, km/h para velocidades, y formato Xh Xm para duraciones. Cuando los datos no apoyan una conclusión, lo decís claramente en vez de inventar.

${context ? `Datos del usuario:\n${context}` : 'Aún no hay datos disponibles en la base de datos.'}`;

  let ollamaRes: globalThis.Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
    });
  } catch (err: any) {
    console.error('[ai] No se pudo conectar a Ollama:', err.message);
    res.status(503).json({ error: 'Ollama no está corriendo. Inicialo con: ollama serve' });
    return;
  }

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text();
    console.error('[ai] Ollama error:', errText);
    // Si el modelo no existe, dar instrucciones claras
    if (ollamaRes.status === 404 || errText.includes('not found')) {
      res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
    } else {
      res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
    }
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = ollamaRes.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            res.write(`data: ${JSON.stringify({ token: json.message.content })}\n\n`);
          }
          if (json.done) {
            res.write('data: [DONE]\n\n');
          }
        } catch { /* skip */ }
      }
    }
  } catch (err: any) {
    console.error('[ai] Stream error:', err.message);
  } finally {
    res.end();
  }
});

// POST /api/ai/analyze — Unified contextual analysis endpoint
router.post('/analyze', handleAnalyze);

export default router;
