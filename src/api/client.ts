// En builds de Capacitor, VITE_API_URL apunta al backend en Render (URL absoluta)
// En web/dev, queda vacío y '/api' funciona vía el proxy de Vite
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // envía cookies de sesión
    ...options,
  });
  if (!res.ok) {
    // 401 en cualquier endpoint → recargar para que AuthContext re-chequee la sesión
    if (res.status === 401 && !path.includes('/auth/status') && !path.includes('/users/')) {
      window.dispatchEvent(new CustomEvent('drift:unauthorized'));
    }
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || `API error: ${res.status} ${res.statusText}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}
