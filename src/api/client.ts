const BASE = '/api';

/** Returned when `drift_demo` is on and the user tries a server-only action. */
export const DEMO_MODE_API_ERROR =
  'This requires a signed-in account. Exit demo mode from Settings or log in.';

/** Paths under /api allowed while in demo (session-optional reads only). */
const DEMO_ALLOWED_API_PATH_PREFIXES: string[] = ['/auth/status'];

function getLang(): string {
  try {
    return localStorage.getItem('drift_language') || 'en';
  } catch {
    return 'en';
  }
}

function normalizeApiPath(path: string): string {
  let p = path.startsWith('/api') ? path.slice(4) : path;
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

function isDemoMode(): boolean {
  try {
    return localStorage.getItem('drift_demo') === '1';
  } catch {
    return false;
  }
}

/** Block server mutations/reads that need a real session while `drift_demo` is active. */
export function assertNotDemoBlocked(path: string): void {
  if (!isDemoMode()) return;
  const n = normalizeApiPath(path);
  const allowed = DEMO_ALLOWED_API_PATH_PREFIXES.some(
    (prefix) => n === prefix || n.startsWith(`${prefix}/`),
  );
  if (!allowed) {
    throw new Error(DEMO_MODE_API_ERROR);
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  assertNotDemoBlocked(path);
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Language': getLang(),
  };
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
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

/**
 * Authenticated `fetch` to `/api/*` (cookies). Use for SSE and non-JSON responses.
 * `path` is like `/training/generate` (same as `apiFetch`).
 */
export function apiFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  assertNotDemoBlocked(path);
  const rel = path.startsWith('/api') ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const baseHeaders: Record<string, string> = { 'X-Language': getLang() };
  const merged = {
    ...baseHeaders,
    ...(init?.headers as Record<string, string> | undefined),
  };
  return fetch(rel, {
    credentials: 'include',
    ...init,
    headers: merged,
  });
}
