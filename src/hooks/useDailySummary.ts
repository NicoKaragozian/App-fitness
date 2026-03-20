import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface DailySummary {
  steps: number;
  calories: number;
  bodyBattery: number;
  restingHR: number;
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
        // Fallback to mock
        setData({ steps: 12400, calories: 2100, bodyBattery: 78, restingHR: 48 });
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
