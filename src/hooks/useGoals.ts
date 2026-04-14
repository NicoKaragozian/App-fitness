import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  target_date: string;
  status: 'active' | 'completed' | 'abandoned';
  ai_model: string | null;
  created_at: string;
  updated_at: string;
  milestone_count: number;
  completed_count: number;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const data = await apiFetch<Goal[]>('/goals');
      setGoals(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const generateGoal = useCallback(async (objective: string, targetDate: string) => {
    const data = await apiFetch<Goal & { milestones: any[] }>('/goals/generate', {
      method: 'POST',
      body: JSON.stringify({ objective, targetDate }),
    });
    const newGoal: Goal = {
      ...data,
      milestone_count: data.milestones?.length ?? 0,
      completed_count: 0,
    };
    setGoals(prev => [newGoal, ...prev]);
    return data;
  }, []);

  const deleteGoal = useCallback(async (id: number) => {
    await apiFetch(`/goals/${id}`, { method: 'DELETE' });
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  const updateGoalStatus = useCallback(async (id: number, status: string) => {
    const data = await apiFetch<Goal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setGoals(prev => prev.map(g => g.id === id ? { ...g, status: data.status } : g));
    return data;
  }, []);

  return { goals, loading, generateGoal, deleteGoal, updateGoalStatus, refetch: fetchGoals };
}
