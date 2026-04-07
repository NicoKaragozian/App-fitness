import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface PlanItem {
  id: number;
  day: string;
  sport: string;
  detail: string;
  completed: number;
  plan_id?: number | null;
  session_id?: number | null;
}

export function usePlan() {
  const [data, setData] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    try {
      const items = await apiFetch<PlanItem[]>('/plan');
      setData(items);
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const addPlanItem = async (item: Partial<PlanItem>) => {
    const newItem = await apiFetch<PlanItem>('/plan', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    setData(prev => [...prev, newItem]);
  };

  const updatePlanItem = async (id: number, updates: Partial<PlanItem>) => {
    // Optimistic update
    setData(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      await apiFetch(`/plan/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (e) {
      // Revert if error
      fetchPlan();
    }
  };

  const deletePlanItem = async (id: number) => {
    setData(prev => prev.filter(p => p.id !== id));
    try {
      await apiFetch(`/plan/${id}`, { method: 'DELETE' });
    } catch (e) {
      fetchPlan();
    }
  };

  return { data, loading, addPlanItem, updatePlanItem, deletePlanItem };
}
