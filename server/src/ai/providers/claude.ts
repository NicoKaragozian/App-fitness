// ai/providers/claude.ts — Claude/Anthropic provider
// Refactored from ai/claude.ts and ai/agent.ts into the Provider interface.

import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';
import { AI_CONFIG } from '../config.js';
import { AGENT_TOOLS, executeTool } from '../tools.js';
import type { Provider, AIMessage, StreamOptions, AgentOptions } from './types.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

function handleError(err: any): { status: number; message: string } {
  if (err?.status === 401) return { status: 401, message: 'Invalid Claude API key. Check ANTHROPIC_API_KEY in server/.env' };
  if (err?.status === 429) return { status: 429, message: 'Claude API rate limit reached. Wait a few seconds and try again.' };
  if (err?.status === 529) return { status: 503, message: 'Claude API is overloaded. Try again in a moment.' };
  return { status: 502, message: `Claude API error: ${err?.message || 'unknown'}` };
}

function sseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

/** Convert provider AIMessage to Anthropic MessageParam */
function toAnthropicMsg(msg: AIMessage): Anthropic.MessageParam {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }
  const content: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = msg.content.map(block => {
    if (block.type === 'text') return { type: 'text', text: block.text };
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: block.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data: block.base64,
      },
    };
  });
  return { role: msg.role, content };
}

export const claudeProvider: Provider = {
  name: 'claude',

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async chat(systemPrompt, userMessage, maxTokens = 4096) {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { status: 503 });
    }
    const client = getClient();
    try {
      const message = await client.messages.create({
        model: AI_CONFIG.claude.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const block = message.content[0];
      if (block.type !== 'text') throw new Error('Unexpected Claude response (not text)');
      return block.text;
    } catch (err: any) {
      const { status, message } = handleError(err);
      throw Object.assign(new Error(message), { status });
    }
  },

  // Claude follows JSON prompts reliably — chatJSON is the same as chat
  async chatJSON(systemPrompt, userMessage, maxTokens = 4096) {
    return claudeProvider.chat(systemPrompt, userMessage, maxTokens);
  },

  async streamChat({ systemPrompt, messages, res, maxTokens = 4096, beforeDone }) {
    if (!this.isConfigured()) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
      return '';
    }
    const client = getClient();
    sseHeaders(res);
    let fullContent = '';

    try {
      const stream = client.messages.stream({
        model: AI_CONFIG.claude.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map(toAnthropicMsg),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
        }
      }

      if (beforeDone) await beforeDone(fullContent);
      res.write('data: [DONE]\n\n');
    } catch (err: any) {
      console.error('[claude] streamChat error:', err.message);
      const { status, message } = handleError(err);
      res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }

    return fullContent;
  },

  async streamGenerate(systemPrompt, userMessage, res, opts = {}) {
    return claudeProvider.streamChat({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      res,
      maxTokens: opts.maxTokens,
      beforeDone: opts.beforeDone,
    });
  },

  async visionStream(systemPrompt, userMessage, imageBase64, mediaType, imagePath, res) {
    if (!this.isConfigured()) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
      return;
    }
    const client = getClient();
    sseHeaders(res);

    // First event: inform frontend of the saved image path
    res.write(`data: ${JSON.stringify({ image_path: imagePath })}\n\n`);

    try {
      const stream = client.messages.stream({
        model: AI_CONFIG.claude.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: imageBase64,
              },
            },
            { type: 'text', text: userMessage },
          ],
        }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
    } catch (err: any) {
      console.error('[claude] visionStream error:', err.message);
      const { status, message } = handleError(err);
      res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  },

  async streamAgent({ systemPrompt, messages, res, maxTokens = 4096, maxIterations = 5, userId }: AgentOptions) {
    if (!this.isConfigured()) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
      return;
    }
    const client = getClient();
    sseHeaders(res);

    const claudeMessages: Anthropic.MessageParam[] = messages.map(toAnthropicMsg);
    let totalTextEmitted = 0;
    let totalToolsExecuted = 0;

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const stream = client.messages.stream({
          model: AI_CONFIG.claude.model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: claudeMessages,
          tools: AGENT_TOOLS,
        });

        let iterationText = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            iterationText += event.delta.text;
            totalTextEmitted += event.delta.text.length;
            res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
          }
        }

        const finalMessage = await stream.finalMessage();
        console.log(`[claude] streamAgent iteration ${iteration}: stop_reason=${finalMessage.stop_reason} text_len=${iterationText.length} content_blocks=${finalMessage.content.length}`);

        if (finalMessage.stop_reason === 'tool_use') {
          const toolUseBlocks = finalMessage.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );

          claudeMessages.push({ role: 'assistant', content: finalMessage.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            totalToolsExecuted++;
            res.write(`data: ${JSON.stringify({
              tool_call: { id: toolUse.id, name: toolUse.name, input: toolUse.input }
            })}\n\n`);

            const { result, isError } = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, any>,
              { provider: claudeProvider, userId }
            );

            res.write(`data: ${JSON.stringify({
              tool_result: { id: toolUse.id, name: toolUse.name, result }
            })}\n\n`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
              is_error: isError,
            });
          }

          claudeMessages.push({ role: 'user', content: toolResults });
          continue;
        }

        // If end_turn but completely empty response (no text, no tools), emit fallback
        if (totalTextEmitted === 0 && totalToolsExecuted === 0) {
          console.warn('[claude] streamAgent: empty end_turn response, emitting fallback');
          res.write(`data: ${JSON.stringify({ token: "I'm sorry, I couldn't generate a response. Could you rephrase your message?" })}\n\n`);
        }

        break;
      }
    } catch (err: any) {
      console.error('[claude] streamAgent error:', err.message, err.status ?? '');
      const { status, message } = handleError(err);
      res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  },
};
