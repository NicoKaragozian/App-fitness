import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface ExerciseHistoryEntry {
  date: string;
  type?: 'strength' | 'cardio' | 'timed';
  sets: { set: number; reps: number | null; weight: number | null; duration_seconds?: number | null; distance_meters?: number | null }[];
  maxWeight: number;
  totalReps: number;
  totalDistance?: number;
  totalDuration?: number;
  bestPace?: string | null;
  setsCompleted?: number;
}

export function useExerciseHistory(exerciseId: number | null) {
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (exerciseId == null) return;
    setLoading(true);
    apiFetch<ExerciseHistoryEntry[]>(`/training/exercises/${exerciseId}/history`)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  return { history, loading };
}
