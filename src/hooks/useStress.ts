import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface StressData {
  data: Array<{ stress: number; day?: string; week?: string; date?: string }>;
  weeklyAvg: number;
  monthlyAvg: number;
}

export function useStress(period: string) {
  const [data, setData] = useState<StressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<StressData>(`/health/stress?period=${period}`)
      .then(setData)
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
