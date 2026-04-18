import { useState, useEffect } from 'react';

export interface AuthFeatures {
  google: boolean;
}

/**
 * Server-driven flags for OAuth (e.g. hide Google when GOOGLE_* env is unset).
 */
export function useAuthFeatures(): { features: AuthFeatures | null; loading: boolean } {
  const [features, setFeatures] = useState<AuthFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/meta/auth-features', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('auth-features');
        return res.json() as Promise<AuthFeatures>;
      })
      .then((data) => {
        if (!cancelled) {
          setFeatures({ google: Boolean(data?.google) });
        }
      })
      .catch(() => {
        if (!cancelled) setFeatures({ google: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { features, loading };
}
