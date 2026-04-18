// ai/providers/gemma.ts — Gemma 3n E2B provider via Ollama

import type { Response } from 'express';
import { AI_CONFIG } from '../config.js';
import { isOllamaReachable, ollamaChat, ollamaChatStream } from './ollama.js';
import { reactStreamAgent } from './react-agent.js';
import type { Provider, AIMessage, StreamOptions, AgentOptions } from './types.js';

function sseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function toOllamaMessages(messages: AIMessage[]): { role: 'user' | 'assistant'; content: string; images?: string[] }[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };
    const texts: string[] = [];
    const images: string[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') texts.push(block.text);
      else if (block.type === 'image') images.push(block.base64);
    }
    return {
      role: msg.role,
      content: texts.join('\n'),
      ...(images.length > 0 ? { images } : {}),
    };
  });
}

export const gemmaProvider: Provider = {
  name: 'gemma',

  isConfigured() {
    return isOllamaReachable();
  },

  async chat(systemPrompt, userMessage, maxTokens = 4096) {
    return ollamaChat({
      model: AI_CONFIG.gemma.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      options: { num_predict: maxTokens },
    });
  },

  async chatJSON(systemPrompt, userMessage, maxTokens = 4096) {
    return ollamaChat({
      model: AI_CONFIG.gemma.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      format: 'json',
      options: { num_predict: maxTokens },
    });
  },

  async streamChat({ systemPrompt, messages, res, maxTokens = 4096, beforeDone }) {
    sseHeaders(res);
    const ollamaMsgs = toOllamaMessages(messages);
    let fullContent = '';

    try {
      fullContent = await ollamaChatStream(
        {
          model: AI_CONFIG.gemma.model,
          system: systemPrompt,
          messages: ollamaMsgs,
          options: { num_predict: maxTokens },
        },
        (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      );

      if (beforeDone) await beforeDone(fullContent);
      res.write('data: [DONE]\n\n');
    } catch (err: any) {
      console.error('[gemma] streamChat error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message, status: err.status ?? 503 })}\n\n`);
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }

    return fullContent;
  },

  async streamGenerate(systemPrompt, userMessage, res, opts = {}) {
    return gemmaProvider.streamChat({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      res,
      maxTokens: opts.maxTokens,
      beforeDone: opts.beforeDone,
    });
  },

  async visionStream(systemPrompt, userMessage, imageBase64, _mediaType, imagePath, res) {
    sseHeaders(res);

    // First event: inform frontend of the saved image path
    res.write(`data: ${JSON.stringify({ image_path: imagePath })}\n\n`);

    try {
      await ollamaChatStream(
        {
          model: AI_CONFIG.gemma.visionModel,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage, images: [imageBase64] },
          ],
          options: { num_predict: 600 },
        },
        (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      );
      res.write('data: [DONE]\n\n');
    } catch (err: any) {
      console.error('[gemma] visionStream error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message, status: err.status ?? 503 })}\n\n`);
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  },

  async streamAgent({ systemPrompt, messages, res, maxTokens = 4096, maxIterations = 5, userId }: AgentOptions) {
    await reactStreamAgent(systemPrompt, messages, res, gemmaProvider, { maxTokens, maxIterations, userId });
  },
};
