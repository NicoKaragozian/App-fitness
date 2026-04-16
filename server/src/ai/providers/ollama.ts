// ai/providers/ollama.ts — Low-level Ollama /api/chat client
// Handles streaming NDJSON, JSON mode, and vision (images array).

import { AI_CONFIG } from '../config.js';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 strings (no data: prefix)
}

interface OllamaChatOptions {
  model?: string;
  system?: string;
  messages: OllamaMessage[];
  images?: string[]; // attached to last user message
  format?: 'json';
  stream?: boolean;
  options?: { num_predict?: number };
}

// Cache reachability check (30s TTL) to avoid pinging on every request
let _reachableCache: { value: boolean; ts: number } | null = null;

export async function isOllamaReachable(): Promise<boolean> {
  const now = Date.now();
  if (_reachableCache && now - _reachableCache.ts < 30_000) {
    return _reachableCache.value;
  }
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${AI_CONFIG.gemma.url}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const ok = res.ok;
    _reachableCache = { value: ok, ts: now };
    return ok;
  } catch {
    _reachableCache = { value: false, ts: now };
    return false;
  }
}

/** Invalidate the reachability cache (call after any connection error) */
export function invalidateReachabilityCache() {
  _reachableCache = null;
}

/** Non-streaming Ollama chat — returns complete text response */
export async function ollamaChat(opts: OllamaChatOptions): Promise<string> {
  const { model = AI_CONFIG.gemma.model, system, messages, images, format, options } = opts;

  const msgs = buildMessages(system, messages, images);

  const body: Record<string, any> = { model, messages: msgs, stream: false };
  if (format) body.format = format;
  if (options) body.options = options;

  const res = await fetch(`${AI_CONFIG.gemma.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Ollama error ${res.status}: ${text}`), { status: 502 });
  }

  const json = await res.json() as any;
  return json.message?.content ?? '';
}

/** Streaming Ollama chat — calls onToken for each token, returns full response */
export async function ollamaChatStream(
  opts: OllamaChatOptions,
  onToken: (token: string) => void,
  onError?: (err: Error) => void
): Promise<string> {
  const { model = AI_CONFIG.gemma.model, system, messages, images, options } = opts;
  const msgs = buildMessages(system, messages, images);

  const body: Record<string, any> = { model, messages: msgs, stream: true };
  if (options) body.options = options;

  let res: globalThis.Response;
  try {
    res = await fetch(`${AI_CONFIG.gemma.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    invalidateReachabilityCache();
    throw Object.assign(new Error(`Ollama connection error: ${err.message}`), { status: 503 });
  }

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Ollama error ${res.status}: ${text}`), { status: 502 });
  }

  if (!res.body) throw Object.assign(new Error('Ollama returned no body'), { status: 502 });

  let fullContent = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as any;
          const token = chunk.message?.content ?? '';
          if (token) {
            fullContent += token;
            onToken(token);
          }
        } catch {
          // Ignore malformed JSON lines
        }
      }
    }
  } catch (err: any) {
    if (onError) onError(err);
  }

  return fullContent;
}

// ── Internal helpers ──────────────────────────────────────────────────

function buildMessages(
  system: string | undefined,
  messages: OllamaMessage[],
  extraImages?: string[]
): OllamaMessage[] {
  const out: OllamaMessage[] = [];
  if (system) {
    out.push({ role: 'system', content: system });
  }
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    // Attach extra images to the last user message
    if (extraImages?.length && i === messages.length - 1 && msg.role === 'user') {
      out.push({ ...msg, images: [...(msg.images ?? []), ...extraImages] });
    } else {
      out.push(msg);
    }
  }
  return out;
}
