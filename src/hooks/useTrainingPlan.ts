import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface TrainingExercise {
  id: number;
  session_id: number;
  name: string;
  category: 'warmup' | 'main' | 'core' | 'cooldown';
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  sort_order: number;
}

export interface TrainingSession {
  id: number;
  plan_id: number;
  name: string;
  sort_order: number;
  notes: string | null;
  exercises: TrainingExercise[];
}

export interface TrainingPlanDetail {
  id: number;
  title: string;
  objective: string | null;
  frequency: string | null;
  status: 'active' | 'archived';
  ai_model: string | null;
  created_at: string;
  sessions: TrainingSession[];
}

export function useTrainingPlan(id: number | null) {
  const [plan, setPlan] = useState<TrainingPlanDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (id == null) return;
    setLoading(true);
    try {
      const data = await apiFetch<TrainingPlanDetail>(`/training/plans/${id}`);
      setPlan(data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const updateExercise = useCallback(async (exerciseId: number, fields: Partial<Pick<TrainingExercise, 'name' | 'target_sets' | 'target_reps' | 'notes' | 'category'>>) => {
    await apiFetch(`/training/exercises/${exerciseId}`, { method: 'PUT', body: JSON.stringify(fields) });
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => ({
          ...s,
          exercises: s.exercises.map(e => e.id === exerciseId ? { ...e, ...fields } : e),
        })),
      };
    });
  }, []);

  return { plan, loading, updateExercise, refetch: fetchPlan };
}
