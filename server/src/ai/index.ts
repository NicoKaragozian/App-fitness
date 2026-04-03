// ai/index.ts — Handler unificado para /api/ai/analyze

import { Request, Response } from 'express';
import db from '../db.js';
import { buildAnalyzeContext, getCacheKey, type AnalyzeMode } from './context.js';
import { PROMPTS } from './prompts.js';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const VALID_MODES: AnalyzeMode[] = ['session', 'sleep', 'wellness', 'sport', 'monthly', 'daily'];

function isValidModelName(name: string): boolean {
  return typeof name === 'string' && /^[a-zA-Z0-9._:\-/]+$/.test(name) && name.length < 100;
}

export async function handleAnalyze(req: Request, res: Response) {
  const { mode, payload = {}, model: requestedModel, force } = req.body as {
    mode: string;
    payload?: Record<string, string>;
    model?: string;
    force?: boolean;
  };

  if (!mode || !VALID_MODES.includes(mode as AnalyzeMode)) {
    res.status(400).json({ error: `mode requerido. Válidos: ${VALID_MODES.join(', ')}` });
    return;
  }

  const analyzeMode = mode as AnalyzeMode;
  const model = (requestedModel && isValidModelName(requestedModel)) ? requestedModel : OLLAMA_MODEL;
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

  console.log(`[ai] Analyze mode=${analyzeMode} model=${model} cacheKey=${cacheKey}`);

  // Call Ollama
  let ollamaRes: globalThis.Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: getDefaultUserMessage(analyzeMode, payload) },
        ],
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
    if (ollamaRes.status === 404 || errText.includes('not found')) {
      res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
    } else {
      res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
    }
    return;
  }

  // Stream SSE to client + accumulate for cache
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-AI-Mode', analyzeMode);

  const reader = ollamaRes.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

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
            fullContent += json.message.content;
            res.write(`data: ${JSON.stringify({ token: json.message.content })}\n\n`);
          }
          if (json.done) {
            // Store in cache
            if (fullContent.length > 0) {
              db.prepare(
                'INSERT OR REPLACE INTO ai_cache (cache_key, mode, content, model, created_at) VALUES (?, ?, ?, ?, ?)'
              ).run(cacheKey, analyzeMode, fullContent, model, new Date().toISOString());
              console.log(`[ai] Cached: ${cacheKey} (${fullContent.length} chars)`);
            }
            res.write(`data: ${JSON.stringify({ done: true, cached: false, generatedAt: new Date().toISOString() })}\n\n`);
            res.write('data: [DONE]\n\n');
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } catch (err: any) {
    console.error('[ai] Stream error:', err.message);
  } finally {
    res.end();
  }
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
