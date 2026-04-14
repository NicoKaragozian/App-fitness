import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export interface NutritionPlanMeal {
  id: number;
  plan_id: number;
  slot: string | null;
  name: string | null;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface NutritionPlan {
  id: number;
  training_plan_id: number | null;
  title: string | null;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  strategy: string | null;
  rationale: string | null;
  ai_model: string | null;
  created_at: string;
  meal_count?: number;
  meals?: NutritionPlanMeal[];
}

export function useNutritionPlan() {
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await apiFetch<NutritionPlan[]>('/nutrition/plans');
      setPlans(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const generatePlan = useCallback(async (strategy?: string, linkedTrainingPlanId?: number) => {
    setGenerating(true);
    setError(null);
    try {
      const plan = await apiFetch<NutritionPlan>('/nutrition/plans/generate', {
        method: 'POST',
        body: JSON.stringify({ strategy, linkedTrainingPlanId }),
      });
      await fetchPlans();
      return plan;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [fetchPlans]);

  const fetchPlanDetail = useCallback(async (id: number) => {
    return apiFetch<NutritionPlan & { meals: NutritionPlanMeal[] }>(`/nutrition/plans/${id}`);
  }, []);

  const deletePlan = useCallback(async (id: number) => {
    await apiFetch(`/nutrition/plans/${id}`, { method: 'DELETE' });
    await fetchPlans();
  }, [fetchPlans]);

  const activePlan = plans[0] || null;

  return { plans, activePlan, loading, generating, error, generatePlan, fetchPlanDetail, deletePlan, refetch: fetchPlans };
}
