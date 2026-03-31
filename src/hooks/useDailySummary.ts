import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface DailySummary {
  steps: number | null;
  calories: number | null;
  bodyBattery: number | null;
  restingHR: number | null;
  sleepScore: number | null;
}

export function useDailySummary() {
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    apiFetch<DailySummary>('/health/summary')
      .then(setData)
      .catch((err) => {
        setError(err);
        setData({ steps: null, calories: null, bodyBattery: null, restingHR: null, sleepScore: null });
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
