import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface WorkoutSet {
  id?: number;
  exerciseId: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  completed: boolean;
}

export interface WorkoutLog {
  id: number;
  plan_id: number;
  session_id: number;
  started_at: string;
  completed_at: string | null;
  sets: (WorkoutSet & { id: number })[];
  session_name?: string;
}

export function useWorkout() {
  const startWorkout = useCallback(async (planId: number, sessionId: number): Promise<number> => {
    const data = await apiFetch<{ workoutId: number }>('/training/workouts', {
      method: 'POST',
      body: JSON.stringify({ planId, sessionId }),
    });
    return data.workoutId;
  }, []);

  const finishWorkout = useCallback(async (workoutId: number, notes?: string) => {
    await apiFetch(`/training/workouts/${workoutId}`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }, []);

  const logSet = useCallback(async (
    workoutId: number,
    exerciseId: number,
    setNumber: number,
    reps: number | null,
    weight: number | null,
    duration_seconds?: number | null,
    distance_meters?: number | null,
  ): Promise<number> => {
    const data = await apiFetch<{ setId: number }>(`/training/workouts/${workoutId}/sets`, {
      method: 'POST',
      body: JSON.stringify({ exerciseId, setNumber, reps, weight, completed: true, duration_seconds, distance_meters }),
    });
    return data.setId;
  }, []);

  const updateSet = useCallback(async (
    setId: number,
    reps: number | null,
    weight: number | null,
    completed = true,
    duration_seconds?: number | null,
    distance_meters?: number | null,
  ) => {
    await apiFetch(`/training/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify({ reps, weight, completed, duration_seconds, distance_meters }),
    });
  }, []);

  const getWorkoutHistory = useCallback(async (planId?: number, sessionId?: number): Promise<WorkoutLog[]> => {
    const params = new URLSearchParams();
    if (planId) params.set('planId', String(planId));
    if (sessionId) params.set('sessionId', String(sessionId));
    return apiFetch<WorkoutLog[]>(`/training/workouts?${params.toString()}`);
  }, []);

  const getWorkoutDetail = useCallback(async (workoutId: number): Promise<WorkoutLog> => {
    return apiFetch<WorkoutLog>(`/training/workouts/${workoutId}`);
  }, []);

  return { startWorkout, finishWorkout, logSet, updateSet, getWorkoutHistory, getWorkoutDetail };
}

export interface LastValues {
  weight: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
}

// Hook to get the last logged values per exercise in a session (weight, duration, distance)
export function useLastValues(sessionId: number | null) {
  const [lastValues, setLastValues] = useState<Record<number, LastValues>>({});

  useEffect(() => {
    if (sessionId == null) return;
    apiFetch<WorkoutLog[]>(`/training/workouts?sessionId=${sessionId}`)
      .then(logs => {
        if (logs.length === 0) return;
        const completed = logs.filter(l => l.completed_at).sort((a, b) =>
          new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
        );
        if (completed.length === 0) return;
        const lastLog = completed[0];
        return apiFetch<WorkoutLog>(`/training/workouts/${lastLog.id}`);
      })
      .then(detail => {
        if (!detail) return;
        const vals: Record<number, LastValues> = {};
        for (const set of detail.sets ?? []) {
          if (!vals[set.exerciseId]) {
            vals[set.exerciseId] = { weight: null, duration_seconds: null, distance_meters: null };
          }
          if (set.weight != null && set.weight > 0) vals[set.exerciseId].weight = set.weight;
          if (set.duration_seconds != null) vals[set.exerciseId].duration_seconds = set.duration_seconds;
          if (set.distance_meters != null) vals[set.exerciseId].distance_meters = set.distance_meters;
        }
        setLastValues(vals);
      })
      .catch(() => {});
  }, [sessionId]);

  return lastValues;
}

// Backward compat alias
export function useLastWeights(sessionId: number | null): Record<number, number> {
  const vals = useLastValues(sessionId);
  const weights: Record<number, number> = {};
  for (const [id, v] of Object.entries(vals)) {
    if (v.weight != null) weights[Number(id)] = v.weight;
  }
  return weights;
}
