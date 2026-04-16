const BASE = '/api';

function getLang(): string {
  try { return localStorage.getItem('drift_language') || 'en'; } catch { return 'en'; }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Language': getLang(),
  };
  const res = await fetch(`${BASE}${path}`, {
    headers: baseHeaders,
    ...options,
    // Merge caller headers over base headers (preserves Content-Type override from callers)
    ...(options?.headers ? { headers: { ...baseHeaders, ...(options.headers as Record<string, string>) } } : {}),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || `API error: ${res.status} ${res.statusText}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}
