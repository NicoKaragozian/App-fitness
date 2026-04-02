import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import type { ChartMetricConfig } from './useActivities';

export interface GroupConfig {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  metrics: string[];
  chartMetrics: ChartMetricConfig[];
}

export interface ActivityItem {
  id: string;
  date: string;
  sportType: string;
  duration: number;
  distance: number;
  maxSpeed: number | null;
  avgHr: number | null;
  calories: number | null;
}

export interface ActivityDetailData {
  group?: GroupConfig;
  activities: ActivityItem[];
  stats: {
    totalSessions: number;
    totalDistance?: number;
    totalDuration: number;
    totalCalories: number;
    avgDuration: number;
    avgHr?: number | null;
  };
  personalBests: {
    longestSession: { date: string; value: number; unit: string } | null;
    longestDistance: { date: string; value: number; unit: string } | null;
    highestSpeed: { date: string; value: number; unit: string } | null;
    mostCalories: { date: string; value: number; unit: string } | null;
  };
}

export function useActivityDetail(category: string, period: string = 'total') {
  const [data, setData] = useState<ActivityDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<ActivityDetailData>(`/activities/category/${category}?period=${period}`)
      .then(setData)
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [category, period]);

  return { data, loading, error };
}
