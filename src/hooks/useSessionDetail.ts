import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface HrZone {
  zone: number;
  seconds: number;
  pct: number;
}

export interface SessionDetail {
  id: string;
  name: string;
  sportType: string;
  date: string;
  startTime: string;
  locationName: string | null;
  startLat: number | null;
  startLon: number | null;
  hasPolyline: boolean;
  duration: number;
  distance: number;
  avgSpeed: number | null;
  maxSpeed: number | null;
  calories: number | null;
  avgHr: number | null;
  maxHr: number | null;
  aerobicEffect: number | null;
  anaerobicEffect: number | null;
  trainingEffectLabel: string | null;
  trainingLoad: number | null;
  differenceBodyBattery: number | null;
  hrZones: HrZone[];
  lapCount: number | null;
  garminUrl: string;
  mapUrl: string | null;
}

export function useSessionDetail(id: string | null) {
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setError(null);
    apiFetch<SessionDetail>(`/activities/${id}`)
      .then(setData)
      .catch((err) => { setError(err); setData(null); })
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}
