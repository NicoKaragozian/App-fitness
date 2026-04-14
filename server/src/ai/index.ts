// ai/index.ts — Unified handler for /api/ai/analyze

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
    res.status(400).json({ error: `mode required. Valid: ${VALID_MODES.join(', ')}` });
    return;
  }

  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
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
  const systemPrompt = `${PROMPTS[analyzeMode] || PROMPTS.chat}\n\nUser data:\n${context || 'No data available.'}`;
  const userMessage = getDefaultUserMessage(analyzeMode, payload);

  console.log(`[ai] Analyze mode=${analyzeMode} cacheKey=${cacheKey}`);

  res.setHeader('X-AI-Mode', analyzeMode);

  await claudeStreamChat(systemPrompt, [{ role: 'user', content: userMessage }], res, {
    beforeDone: (fullContent) => {
      // Save to cache
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
    case 'session': return 'Analyze this training session.';
    case 'sleep': return `Analyze my sleep patterns (${payload.period || 'weekly'}).`;
    case 'wellness': return `Analyze my stress and recovery (${payload.period || 'weekly'}).`;
    case 'sport': return 'Analyze my progress in this sport.';
    case 'monthly': return `Give me a monthly summary${payload.month ? ` (${payload.month})` : ''}.`;
    case 'daily': return 'Give me a briefing on how I am today.';
    default: return 'Analyze my data.';
  }
}
