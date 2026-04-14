// ai/claude.ts — Claude API provider (Anthropic)
// Unified AI provider for the entire app: nutrition, AI Coach, Training Plans, and analysis.

import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic(); // Reads ANTHROPIC_API_KEY from env automatically
  }
  return _client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Anthropic API error handling
function handleAnthropicError(err: any): { status: number; message: string } {
  if (err?.status === 401) {
    return { status: 401, message: 'Invalid Claude API key. Check ANTHROPIC_API_KEY in server/.env' };
  }
  if (err?.status === 429) {
    return { status: 429, message: 'Claude API rate limit reached. Wait a few seconds and try again.' };
  }
  if (err?.status === 529) {
    return { status: 503, message: 'Claude API is overloaded. Try again in a moment.' };
  }
  return { status: 502, message: `Claude API error: ${err?.message || 'unknown'}` };
}

// Non-streaming call — for nutrition plan generation (JSON mode)
export async function claudeChat(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<string> {
  if (!isClaudeConfigured()) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY not configured in server/.env'), { status: 503 });
  }
  const client = getClient();
  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = message.content[0];
    if (block.type !== 'text') throw new Error('Unexpected Claude response (not text)');
    return block.text;
  } catch (err: any) {
    const { status, message } = handleAnthropicError(err);
    throw Object.assign(new Error(message), { status });
  }
}

// Multi-turn streaming — for AI Coach chat and AI Analyze
// Emits SSE to Express res:
//   data: {"token":"..."}    (response tokens)
//   data: [DONE]             (end of stream)
// The beforeDone callback allows the caller to inject additional events before [DONE].
// Returns the accumulated content (useful for caching in analyze).
export async function claudeStreamChat(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  res: Response,
  options: { maxTokens?: number; beforeDone?: (fullContent: string) => void } = {}
): Promise<string> {
  const { maxTokens = 4096, beforeDone } = options;

  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
    return '';
  }

  const client = getClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullContent = '';

  try {
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
      }
    }

    if (beforeDone) {
      beforeDone(fullContent);
    }

    res.write('data: [DONE]\n\n');
  } catch (err: any) {
    console.error('[claude] Stream chat error:', err.message);
    const { status, message } = handleAnthropicError(err);
    res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }

  return fullContent;
}

// Single-message streaming — for plan generation (training, etc.)
// Variant of claudeStreamChat for a single user message (not multi-turn array).
export async function claudeStreamGenerate(
  systemPrompt: string,
  userMessage: string,
  res: Response,
  options: { maxTokens?: number; beforeDone?: (fullContent: string) => void } = {}
): Promise<string> {
  return claudeStreamChat(systemPrompt, [{ role: 'user', content: userMessage }], res, options);
}

// Vision streaming — for food photo analysis
// Emits SSE to Express res in the same format as AI Coach:
//   data: {"image_path":"xxx"}   (first event — filename to save)
//   data: {"token":"..."}        (analysis tokens)
//   data: [DONE]                 (end of stream)
// The frontend accumulates tokens and on [DONE] parses the complete JSON.
export async function claudeVisionStream(
  systemPrompt: string,
  userMessage: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  imagePath: string,
  res: Response
): Promise<void> {
  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
    return;
  }
  const client = getClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // First event: inform the frontend of the saved image path
  res.write(`data: ${JSON.stringify({ image_path: imagePath })}\n\n`);

  try {
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: userMessage,
            },
          ],
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
  } catch (err: any) {
    console.error('[claude] Vision stream error:', err.message);
    const { status, message } = handleAnthropicError(err);
    res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }
}
