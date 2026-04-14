// ai/index.ts — Handler unificado para /api/ai/analyze

import { Request, Response } from 'express';
import db from '../db.js';
import { buildAnalyzeContext, getCacheKey, type AnalyzeMode } from './context.js';
import { PROMPTS } from './prompts.js';
import { claudeStreamChat, isClaudeConfigured } from './claude.js';

const VALID_MODES: AnalyzeMode[] = ['session', 'sleep', 'wellness', 'sport', 'monthly', 'daily'];

export async function handleAnalyze(req: Request, res: Response) {
  const { mode, payload = {}, force } = req.body as {
    mode: string;
    payload?: Record<string, string>;
    force?: boolean;
  };

  if (!mode || !VALID_MODES.includes(mode as AnalyzeMode)) {
    res.status(400).json({ error: `mode requerido. Válidos: ${VALID_MODES.join(', ')}` });
    return;
  }

  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurado en server/.env' });
    return;
  }

  const analyzeMode = mode as AnalyzeMode;
  const cacheKey = getCacheKey(analyzeMode, payload);

  // Check cache (unless force=true)
  if (!force) {
    const cached = db.prepare('SELECT content, created_at FROM ai_cache WHERE cache_key = ?').get(cacheKey) as any;
    if (cached) {
      console.log(`[ai] Cache hit: ${cacheKey}`);
      res.json({
        content: cached.content,
        cached: true,
        mode: analyzeMode,
        generatedAt: cached.created_at,
      });
      return;
    }
  }

  // Build context and prompt
  const context = buildAnalyzeContext(analyzeMode, payload);
  const systemPrompt = `${PROMPTS[analyzeMode] || PROMPTS.chat}\n\nDatos del usuario:\n${context || 'No hay datos disponibles.'}`;
  const userMessage = getDefaultUserMessage(analyzeMode, payload);

  console.log(`[ai] Analyze mode=${analyzeMode} cacheKey=${cacheKey}`);

  res.setHeader('X-AI-Mode', analyzeMode);

  await claudeStreamChat(systemPrompt, [{ role: 'user', content: userMessage }], res, {
    beforeDone: (fullContent) => {
      // Guardar en cache
      if (fullContent.length > 0) {
        db.prepare(
          'INSERT OR REPLACE INTO ai_cache (cache_key, mode, content, model, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(cacheKey, analyzeMode, fullContent, 'claude', new Date().toISOString());
        console.log(`[ai] Cached: ${cacheKey} (${fullContent.length} chars)`);
      }
      res.write(`data: ${JSON.stringify({ done: true, cached: false, generatedAt: new Date().toISOString() })}\n\n`);
    },
  });
}

// Generate a natural user message for each mode so the LLM has a clear "question"
function getDefaultUserMessage(mode: AnalyzeMode, payload: Record<string, string>): string {
  switch (mode) {
    case 'session': return 'Analizá esta sesión de entrenamiento.';
    case 'sleep': return `Analizá mis patrones de sueño (${payload.period || 'semanal'}).`;
    case 'wellness': return `Analizá mi estrés y recuperación (${payload.period || 'semanal'}).`;
    case 'sport': return 'Analizá mi progreso en este deporte.';
    case 'monthly': return `Hacé un resumen de mi mes${payload.month ? ` (${payload.month})` : ''}.`;
    case 'daily': return 'Dame un briefing de cómo estoy hoy.';
    default: return 'Analizá mis datos.';
  }
}
