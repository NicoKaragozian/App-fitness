import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface ChartMetricConfig {
  dataKey: string;
  name: string;
  type: 'bar' | 'line';
}

export interface SportGroup {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  metrics: string[];
  chartMetrics: ChartMetricConfig[];
  sortOrder: number;
  data: Record<string, number>;
}

export interface ActivitiesData {
  groups: SportGroup[];
  others: Array<{ name: string; sessions: number; distance?: number; duration?: number }>;
  volumeHistory: Array<Record<string, number | string>>;
  chartData: Record<string, Array<Record<string, number | string>>>;
  trainingReadiness: number | null;
  recentSessions: Array<{
    sport: string;
    date: string;
    distance: number;
    hr: number;
    calories: number;
    duration: number;
  }>;
}

export function useActivities(period: string) {
  const [data, setData] = useState<ActivitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<ActivitiesData>(`/activities?period=${period}`)
      .then(setData)
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
