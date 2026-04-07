import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { TrainingSession } from './useTrainingPlan';

export interface WorkoutSet {
  id?: number;
  exerciseId: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
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
  ): Promise<number> => {
    const data = await apiFetch<{ setId: number }>(`/training/workouts/${workoutId}/sets`, {
      method: 'POST',
      body: JSON.stringify({ exerciseId, setNumber, reps, weight, completed: true }),
    });
    return data.setId;
  }, []);

  const updateSet = useCallback(async (setId: number, reps: number | null, weight: number | null, completed = true) => {
    await apiFetch(`/training/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify({ reps, weight, completed }),
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

// Hook para obtener el último peso usado por ejercicio en un session
export function useLastWeights(sessionId: number | null) {
  const [lastWeights, setLastWeights] = useState<Record<number, number>>({});

  useEffect(() => {
    if (sessionId == null) return;
    apiFetch<WorkoutLog[]>(`/training/workouts?sessionId=${sessionId}`)
      .then(logs => {
        if (logs.length === 0) return;
        // Tomar el workout más reciente completado
        const completed = logs.filter(l => l.completed_at).sort((a, b) =>
          new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
        );
        if (completed.length === 0) return;
        const lastLog = completed[0];
        return apiFetch<WorkoutLog>(`/training/workouts/${lastLog.id}`);
      })
      .then(detail => {
        if (!detail) return;
        const weights: Record<number, number> = {};
        for (const set of detail.sets ?? []) {
          if (set.weight != null && set.weight > 0) {
            weights[set.exerciseId] = set.weight;
          }
        }
        setLastWeights(weights);
      })
      .catch(() => {});
  }, [sessionId]);

  return lastWeights;
}
