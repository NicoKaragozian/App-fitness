import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface ChartData {
  water_sports: Array<{ date: string; distance: number; maxSpeed: number; duration: number }>;
  tennis: Array<{ date: string; duration: number; avgHr: number; calories: number }>;
  gym: Array<{ date: string; duration: number; calories: number }>;
}

interface ActivitiesData {
  sports: {
    waterSports: Record<string, unknown>;
    tennis: Record<string, unknown>;
    gym: Record<string, unknown>;
    others: Array<{ name: string; sessions: number; distance?: number; duration?: number }>;
  };
  volumeHistory: Array<{ month: string; water: number; tennis: number; gym: number }>;
  chartData?: ChartData;
  trainingReadiness: number;
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
