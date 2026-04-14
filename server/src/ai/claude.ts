// ai/claude.ts — Claude API provider (Anthropic)
// Usado exclusivamente para el modulo de nutricion.
// El resto de la app (AI Coach, training plans) sigue usando Ollama.

import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic(); // Lee ANTHROPIC_API_KEY del env automaticamente
  }
  return _client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Manejo de errores de la API de Anthropic
function handleAnthropicError(err: any): { status: number; message: string } {
  if (err?.status === 401) {
    return { status: 401, message: 'API key de Claude invalida. Verificá ANTHROPIC_API_KEY en server/.env' };
  }
  if (err?.status === 429) {
    return { status: 429, message: 'Limite de la API de Claude alcanzado. Esperá unos segundos e intentá de nuevo.' };
  }
  if (err?.status === 529) {
    return { status: 503, message: 'La API de Claude está sobrecargada. Intentá de nuevo en unos momentos.' };
  }
  return { status: 502, message: `Error de Claude API: ${err?.message || 'desconocido'}` };
}

// Llamada no-streaming — para generacion de planes nutricionales (JSON mode)
export async function claudeChat(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<string> {
  if (!isClaudeConfigured()) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY no configurado en server/.env'), { status: 503 });
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
    if (block.type !== 'text') throw new Error('Respuesta inesperada de Claude (no es texto)');
    return block.text;
  } catch (err: any) {
    const { status, message } = handleAnthropicError(err);
    throw Object.assign(new Error(message), { status });
  }
}

// Streaming con vision — para analisis de fotos de comida
// Emite SSE al res de Express en formato identico al AI Coach:
//   data: {"image_path":"xxx"}   (primer evento — filename para guardar)
//   data: {"token":"..."}        (tokens del analisis)
//   data: [DONE]                 (fin del stream)
// El frontend acumula los tokens y al recibir [DONE] parsea el JSON completo.
export async function claudeVisionStream(
  systemPrompt: string,
  userMessage: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  imagePath: string,
  res: Response
): Promise<void> {
  if (!isClaudeConfigured()) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurado en server/.env' });
    return;
  }
  const client = getClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Primer evento: informar al frontend el path de la imagen ya guardada
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
