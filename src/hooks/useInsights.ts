import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface Recommendation {
  type: 'recovery' | 'training' | 'sleep' | 'plan';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dataPoints: Record<string, number | string | undefined>;
}

interface InsightsData {
  recommendations: Recommendation[];
  stats: {
    sleep: { current: number | null; baseline: number | null; trend: string };
    hrv: { current: number | null; baseline: number | null; trend: string; status: string | null };
    stress: { current: number | null; baseline: number | null; trend: string };
    restingHR: { current: number | null; avg7d: number | null; trend: string };
    trainingLoad: { last3d: number; last7d: number };
  };
}

export function useInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<InsightsData>('/insights')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
