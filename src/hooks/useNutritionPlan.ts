import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api/client';

export interface DietaryPreferences {
  diet_type: string;
  allergies: string[];
  excluded_foods: string;
  preferred_foods: string;
  meals_per_day: number;
}

export interface NutritionPlanMeal {
  id: number;
  plan_id: number;
  slot: string | null;
  option_number: number;
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
  const [generationStream, setGenerationStream] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const generatePlan = useCallback(async (strategy?: string, linkedTrainingPlanId?: number, dietaryPreferences?: DietaryPreferences, onToken?: () => void) => {
    setGenerating(true);
    setGenerationStream('');
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const response = await fetch('/api/nutrition/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, linkedTrainingPlanId, dietaryPreferences }),
        signal: ctrl.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const json = JSON.parse(data);
            if (json.token) {
              setGenerationStream(prev => prev + json.token);
              onToken?.();
            }
            if (json.error) {
              throw new Error(json.error);
            }
          } catch (parseErr: any) {
            if (parseErr.message && parseErr.message !== 'Unexpected token') {
              throw parseErr;
            }
          }
        }
      }

      await fetchPlans();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        throw err;
      }
    } finally {
      setGenerating(false);
      setGenerationStream('');
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

  return { plans, activePlan, loading, generating, generationStream, error, generatePlan, fetchPlanDetail, deletePlan, refetch: fetchPlans };
}
