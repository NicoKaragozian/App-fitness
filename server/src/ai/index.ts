// ai/index.ts — Unified handler for /api/ai/analyze

import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/client.js';
import { ai_cache } from '../db/schema/core.js';
import { buildAnalyzeContext, getCacheKey, type AnalyzeMode } from './context.js';
import { PROMPTS } from './prompts.js';
import { pickProviderFromReq, isAIConfigured } from './providers/index.js';

const VALID_MODES: AnalyzeMode[] = ['session', 'sleep', 'wellness', 'sport', 'monthly', 'daily'];

export async function handleAnalyze(req: Request, res: Response) {
  const userId = req.userId!;
  const { mode, payload = {}, force } = req.body as {
    mode: string;
    payload?: Record<string, string>;
    force?: boolean;
  };

  if (!mode || !VALID_MODES.includes(mode as AnalyzeMode)) {
    res.status(400).json({ error: `mode required. Valid: ${VALID_MODES.join(', ')}` });
    return;
  }

  const provider = pickProviderFromReq(req);

  if (!(await isAIConfigured(provider.name))) {
    const providerLabel = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${providerLabel} is not available. Check your setup.` });
    return;
  }

  const analyzeMode = mode as AnalyzeMode;
  const cacheKey = getCacheKey(analyzeMode, payload, userId);

  if (!force) {
    const [cached] = await db.select({ content: ai_cache.content, created_at: ai_cache.created_at })
      .from(ai_cache)
      .where(eq(ai_cache.cache_key, cacheKey))
      .limit(1);
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

  const context = await buildAnalyzeContext(analyzeMode, payload, userId);
  const systemPrompt = `${PROMPTS[analyzeMode] || PROMPTS.chat}\n\nUser data:\n${context || 'No data available.'}`;
  const userMessage = getDefaultUserMessage(analyzeMode, payload);

  console.log(`[ai] Analyze mode=${analyzeMode} provider=${provider.name} cacheKey=${cacheKey}`);

  res.setHeader('X-AI-Mode', analyzeMode);

  await provider.streamChat({
    systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    res,
    beforeDone: async (fullContent) => {
      if (fullContent.length > 0) {
        await db.insert(ai_cache).values({
          user_id: userId,
          cache_key: cacheKey,
          mode: analyzeMode,
          content: fullContent,
          model: provider.name,
          created_at: new Date().toISOString(),
        }).onConflictDoUpdate({
          target: ai_cache.cache_key,
          set: {
            content: fullContent,
            model: provider.name,
            created_at: new Date().toISOString(),
          },
        });
        console.log(`[ai] Cached: ${cacheKey} (${fullContent.length} chars)`);
      }
      res.write(`data: ${JSON.stringify({ done: true, cached: false, generatedAt: new Date().toISOString() })}\n\n`);
    },
  });
}

function getDefaultUserMessage(mode: AnalyzeMode, payload: Record<string, string>): string {
  switch (mode) {
    case 'session': return 'Analyze this training session.';
    case 'sleep': return `Analyze my sleep patterns (${payload.period || 'weekly'}).`;
    case 'wellness': return `Analyze my stress and recovery (${payload.period || 'weekly'}).`;
    case 'sport': return 'Analyze my progress in this sport.';
    case 'monthly': return `Give me a monthly summary${payload.month ? ` (${payload.month})` : ''}.`;
    case 'daily': return 'Give me a briefing on how I am today.';
    default: return 'Analyze my data.';
  }
}
