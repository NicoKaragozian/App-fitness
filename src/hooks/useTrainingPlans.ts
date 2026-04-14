import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface TrainingPlanSummary {
  id: number;
  title: string;
  objective: string | null;
  frequency: string | null;
  status: 'active' | 'archived';
  ai_model: string | null;
  created_at: string;
  updated_at: string;
  sessionCount: number;
  lastWorkout: string | null;
  workoutCount: number;
}

export function useTrainingPlans() {
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await apiFetch<TrainingPlanSummary[]>('/training/plans');
      setPlans(data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const generatePlan = useCallback(async (goal: string): Promise<{ plan: TrainingPlanSummary; recommendations: string | null }> => {
    const data = await apiFetch<{ plan: TrainingPlanSummary; recommendations: string | null }>('/training/generate', {
      method: 'POST',
      body: JSON.stringify({ goal }),
    });
    await fetchPlans();
    return data;
  }, [fetchPlans]);

  const archivePlan = useCallback(async (id: number) => {
    await apiFetch(`/training/plans/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'archived' }) });
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
  }, []);

  const deletePlan = useCallback(async (id: number) => {
    await apiFetch(`/training/plans/${id}`, { method: 'DELETE' });
    setPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  return { plans, loading, generatePlan, archivePlan, deletePlan, refetch: fetchPlans };
}
