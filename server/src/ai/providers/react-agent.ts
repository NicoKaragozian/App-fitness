// ai/providers/react-agent.ts — ReAct loop for providers without native tool_use
// Uses fenced ```tool_call blocks in the response to invoke tools.

import type { Response } from 'express';
import type { AIMessage, Provider } from './types.js';
import { ollamaChatStream } from './ollama.js';
import { AGENT_TOOLS, executeTool } from '../tools.js';
import { AI_CONFIG } from '../config.js';

const TOOL_CALL_OPEN = '```tool_call';

// Instructions appended to the agent system prompt to teach the model the tool protocol
export const REACT_TOOL_INSTRUCTIONS = `

## TOOL USE PROTOCOL
You have access to the following tools. To use a tool, output EXACTLY this format (backticks included):

\`\`\`tool_call
{"name": "tool_name", "input": {}}
\`\`\`

Wait for the tool result before continuing. After receiving results, give your final response.

### Available tools:
${AGENT_TOOLS.map(t => `**${t.name}**: ${t.description}
Parameters: ${JSON.stringify(Object.fromEntries(
  Object.entries(t.input_schema.properties || {}).map(([k, v]: any) => [k, v.description || v.type])
))}`).join('\n\n')}

### Rules:
- Use ONE tool per response at most
- Always write your reasoning before the tool call block
- After all needed tools have been called and results received, give a final answer WITHOUT any tool call block
- If no tool is needed, just respond normally without any \`\`\`tool_call block`;

/**
 * ReAct agent loop for Gemma (or any model without native tool_use).
 * Uses Ollama non-streaming internally per iteration, fakes token streaming to SSE client.
 *
 * SSE protocol (same as Claude agent):
 *   {"token":"..."}                                       — text delta
 *   {"tool_call":{"id":"...","name":"...","input":{}}}    — tool invoked
 *   {"tool_result":{"id":"...","name":"...","result":{}}} — tool done
 *   {"error":"..."}                                       — error
 *   [DONE]                                                — end
 *
 * @param provider - The provider instance (passed to executeTool for nested AI calls)
 */
export async function reactStreamAgent(
  systemPromptBase: string,
  initialMessages: AIMessage[],
  res: Response,
  provider: Provider,
  opts: { maxTokens?: number; maxIterations?: number; userId?: string } = {}
): Promise<void> {
  const { maxTokens = 4096, maxIterations = 5, userId } = opts;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const systemPrompt = systemPromptBase + REACT_TOOL_INSTRUCTIONS;
  const messages: OllamaMsg[] = initialMessages.map(toOllamaMsg);

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let accumulated = '';
      let streamedUpTo = 0;
      let toolCallDetected = false;

      try {
        await ollamaChatStream(
          {
            model: AI_CONFIG.gemma.model,
            system: systemPrompt,
            messages,
            options: { num_predict: maxTokens },
          },
          (token) => {
            accumulated += token;
            // Don't stream tokens once we've entered a tool_call block
            if (toolCallDetected) return;
            const toolCallIdx = accumulated.indexOf(TOOL_CALL_OPEN);
            if (toolCallIdx === -1) {
              // Safe to stream this token directly
              res.write(`data: ${JSON.stringify({ token })}\n\n`);
              streamedUpTo = accumulated.length;
            } else if (toolCallIdx > streamedUpTo) {
              // Stream text up to (but not including) the tool_call marker
              const safeText = accumulated.slice(streamedUpTo, toolCallIdx);
              if (safeText.trim()) {
                res.write(`data: ${JSON.stringify({ token: safeText })}\n\n`);
              }
              streamedUpTo = accumulated.length;
              toolCallDetected = true;
            } else {
              streamedUpTo = accumulated.length;
              toolCallDetected = true;
            }
          }
        );
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ error: `Ollama error: ${err.message}`, status: err.status ?? 503 })}\n\n`);
        break;
      }

      const responseText = accumulated;

      // Parse: split reasoning text from tool_call block
      const parsed = parseReActResponse(responseText);

      // Empty response fallback
      if (!responseText.trim()) {
        console.warn('[react-agent] Gemma returned empty response, emitting fallback');
        res.write(`data: ${JSON.stringify({ token: "I'm sorry, I couldn't generate a response. Could you rephrase your message?" })}\n\n`);
        messages.push({ role: 'assistant', content: '' });
        break;
      }

      if (!parsed.toolCall) {
        // No tool call — done
        messages.push({ role: 'assistant', content: responseText });
        break;
      }

      // Emit tool_call event
      const toolId = `call_${Date.now()}_${iteration}`;
      const { name, input } = parsed.toolCall;
      res.write(`data: ${JSON.stringify({ tool_call: { id: toolId, name, input } })}\n\n`);

      // Execute the tool
      const { result, isError } = await executeTool(name, input, { provider, userId });

      // Emit tool_result event
      res.write(`data: ${JSON.stringify({ tool_result: { id: toolId, name, result } })}\n\n`);

      // Update conversation for next iteration
      messages.push({ role: 'assistant', content: responseText });
      messages.push({
        role: 'user',
        content: `\`\`\`tool_result\n${JSON.stringify(result, null, 0)}\n\`\`\`\nContinue.`,
      });

      if (isError) break;
    }
  } catch (err: any) {
    console.error('[react-agent] Error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

// ── Internal types & helpers ─────────────────────────────────────────

interface OllamaMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface ParsedReAct {
  reasoning: string;
  toolCall?: { name: string; input: Record<string, any> };
}

function parseReActResponse(text: string): ParsedReAct {
  const openIdx = text.indexOf(TOOL_CALL_OPEN);
  if (openIdx === -1) return { reasoning: text };

  const afterOpen = text.indexOf('\n', openIdx);
  if (afterOpen === -1) return { reasoning: text };

  const closeIdx = text.indexOf('\n```', afterOpen);
  if (closeIdx === -1) return { reasoning: text };

  const jsonStr = text.slice(afterOpen + 1, closeIdx).trim();
  const reasoning = text.slice(0, openIdx).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.name !== 'string') return { reasoning: text };
    return { reasoning, toolCall: { name: parsed.name, input: parsed.input ?? {} } };
  } catch {
    return { reasoning: text };
  }
}

/** Sends text as a series of small token SSE events to simulate streaming */
function fakeStreamTokens(text: string, res: Response): void {
  if (!text) return;
  const chunkSize = 8;
  for (let i = 0; i < text.length; i += chunkSize) {
    res.write(`data: ${JSON.stringify({ token: text.slice(i, i + chunkSize) })}\n\n`);
  }
}

function toOllamaMsg(msg: AIMessage): OllamaMsg {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }
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
}
