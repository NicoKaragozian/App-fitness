import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface GoalMilestone {
  id: number;
  goal_id: number;
  week_number: number;
  title: string;
  description: string | null;
  target: string | null;         // success_criteria
  workouts: string;              // JSON array of key_exercises
  duration: string | null;       // estimated phase duration
  tips: string;                  // JSON array of tips
  completed: number;             // 0 or 1
  completed_at: string | null;
  sort_order: number;
}

export interface GoalDetail {
  id: number;
  title: string;
  description: string | null;
  target_date: string;           // empty string if not set
  status: string;
  prerequisites: string;         // JSON array
  common_mistakes: string;       // JSON array
  estimated_timeline: string | null;
  ai_model: string | null;
  created_at: string;
  milestones: GoalMilestone[];
}

export function useGoal(id: number | null) {
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<GoalDetail>(`/goals/${id}`)
      .then(data => setGoal(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const toggleMilestone = useCallback(async (milestoneId: number, completed: boolean) => {
    if (!id) return;
    const data = await apiFetch<GoalMilestone>(`/goals/${id}/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    });
    setGoal(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map(m => m.id === milestoneId ? data : m),
      };
    });
  }, [id]);

  const updateStatus = useCallback(async (status: string) => {
    if (!id) return;
    const data = await apiFetch<GoalDetail>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setGoal(prev => prev ? { ...prev, status: data.status } : prev);
  }, [id]);

  return { goal, loading, toggleMilestone, updateStatus };
}
