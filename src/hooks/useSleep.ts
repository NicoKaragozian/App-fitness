import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface SleepEntry {
  day: string | number;
  hours: number;
  score: number;
  hrv: number;
}

export function useSleep(period: string) {
  const [data, setData] = useState<SleepEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<SleepEntry[]>(`/health/sleep?period=${period}`)
      .then(setData)
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
