import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, apiFetchRaw } from '../api/client';

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
  sessionTypes: string[];
}

export function useTrainingPlans() {
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

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

  // Generate a plan with streaming SSE. Calls onToken() each time a token arrives.
  // Resolves with { plan, recommendations } when the plan is saved in DB.
  const generatePlanStream = useCallback(async (
    goal: string,
    onToken: () => void,
    provider?: string,
  ): Promise<{ plan: TrainingPlanSummary; recommendations: string | null }> => {
    abortRef.current = new AbortController();

    const language = (() => { try { return localStorage.getItem('drift_language') || 'en'; } catch { return 'en'; } })();
    const response = await apiFetchRaw('/training/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Language': language },
      body: JSON.stringify({ goal, provider, language }),
      signal: abortRef.current.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errData.error || `Error ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const DELIMITER = '---PLAN_JSON---';
    let accumulatedThinking = '';
    let result: { plan: TrainingPlanSummary; recommendations: string | null } | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') break;

          let json: any;
          try {
            json = JSON.parse(data);
          } catch {
            continue; // SSE line is not valid JSON, skip
          }

          if (json.token !== undefined) {
            // Acumular tokens para detectar el delimitador
            const combined = accumulatedThinking + json.token;
            const delimIdx = combined.indexOf(DELIMITER);
            if (delimIdx >= 0) {
              accumulatedThinking = combined.slice(0, delimIdx);
            } else {
              accumulatedThinking = combined;
            }
            onToken();
          } else if (json.plan) {
            result = { plan: json.plan, recommendations: json.recommendations ?? null };
          } else if (json.error) {
            throw new Error(json.error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!result) throw new Error('Plan not received from server');
    await fetchPlans();
    return result;
  }, [fetchPlans]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const archivePlan = useCallback(async (id: number) => {
    await apiFetch(`/training/plans/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'archived' }) });
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
  }, []);

  const deletePlan = useCallback(async (id: number) => {
    await apiFetch(`/training/plans/${id}`, { method: 'DELETE' });
    setPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  return { plans, loading, generatePlanStream, stopGeneration, archivePlan, deletePlan, refetch: fetchPlans };
}
