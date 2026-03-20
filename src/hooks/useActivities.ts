import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface ActivitiesData {
  sports: {
    waterSports: Record<string, unknown>;
    tennis: Record<string, unknown>;
    gym: Record<string, unknown>;
    others: Array<{ name: string; sessions: number; distance?: number; duration?: number }>;
  };
  volumeHistory: Array<{ month: string; water: number; tennis: number; gym: number }>;
  trainingReadiness: number;
  recentSession: {
    sport: string;
    location: string;
    distance: number;
    speed: string;
    hr: number;
    duration: number;
  } | null;
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
