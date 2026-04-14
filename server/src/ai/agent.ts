// ai/agent.ts — Agentic streaming loop with Claude tool_use
import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';
import { AGENT_TOOLS, executeTool } from './tools.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

function handleAnthropicError(err: any): { status: number; message: string } {
  if (err?.status === 401) return { status: 401, message: 'API key de Claude invalida.' };
  if (err?.status === 429) return { status: 429, message: 'Rate limit de Claude alcanzado. Esperá unos segundos.' };
  if (err?.status === 529) return { status: 503, message: 'Claude API sobrecargada.' };
  return { status: 502, message: `Error de Claude: ${err?.message || 'desconocido'}` };
}

/**
 * Agentic streaming loop.
 * Streams text tokens via SSE while handling tool_use calls in a loop (max iterations).
 *
 * SSE protocol:
 *   {"token":"..."}                                    — text delta
 *   {"tool_call":{"id":"...","name":"...","input":{}}} — tool invoked
 *   {"tool_result":{"id":"...","name":"...","result":{}}} — tool done
 *   {"error":"..."}                                    — error
 *   [DONE]                                             — end of stream
 */
export async function claudeStreamAgent(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  res: Response,
  options: { maxTokens?: number; maxIterations?: number } = {}
): Promise<void> {
  const { maxTokens = 4096, maxIterations = 5 } = options;
  const client = getClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools: AGENT_TOOLS,
      });

      // Stream text deltas to client in real-time
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
        }
      }

      // Get the complete final message with parsed tool_use blocks
      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason === 'tool_use') {
        // Extract tool_use blocks from the response
        const toolUseBlocks = finalMessage.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        // Append the full assistant message (text + tool_use blocks) to conversation
        messages.push({ role: 'assistant', content: finalMessage.content });

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          // Notify frontend that a tool is being called
          res.write(`data: ${JSON.stringify({
            tool_call: { id: toolUse.id, name: toolUse.name, input: toolUse.input }
          })}\n\n`);

          // Execute the tool
          const { result, isError } = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>
          );

          // Notify frontend of the result
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

        // Append tool results as user message for next iteration
        messages.push({ role: 'user', content: toolResults });

        // Continue the loop — Claude will process tool results and respond
        continue;
      }

      // stop_reason is 'end_turn' or 'max_tokens' — we're done
      break;
    }
  } catch (err: any) {
    console.error('[agent] Stream error:', err.message);
    const { status, message } = handleAnthropicError(err);
    res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
