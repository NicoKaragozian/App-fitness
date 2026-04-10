// Abstraction layer for LLM API calls
// Provider: Groq (OpenAI-compatible API)
// Swap provider by changing GROQ_BASE_URL and updating auth headers

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

function requireApiKey(): string {
  // Leemos en tiempo de ejecución (no en carga del módulo) para que dotenv ya haya corrido
  const key = process.env.GROQ_API_KEY || '';
  if (!key) {
    throw new Error('GROQ_API_KEY no está configurado. Agregalo en server/.env');
  }
  return key;
}

// Streaming chat — returns the raw Response for SSE forwarding
// Response body is OpenAI SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
export async function chatStream(
  messages: { role: string; content: string }[],
  model: string = DEFAULT_MODEL
): Promise<globalThis.Response> {
  const apiKey = requireApiKey();
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  return res;
}

// Non-streaming chat with JSON mode — returns content string
export async function chatJSON(
  messages: { role: string; content: string }[],
  model: string = DEFAULT_MODEL
): Promise<string> {
  const apiKey = requireApiKey();
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// Non-streaming chat — returns content string (no JSON mode)
export async function chatCompletion(
  messages: { role: string; content: string }[],
  model: string = DEFAULT_MODEL
): Promise<string> {
  const apiKey = requireApiKey();
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}
