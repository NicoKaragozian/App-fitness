import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface HrvData {
  nightlyAvg: number;
  status: string;
  history: Array<{ day: string | number; hrv: number }>;
}

export function useHrv(period: string) {
  const [data, setData] = useState<HrvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<HrvData>(`/health/hrv?period=${period}`)
      .then(setData)
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
