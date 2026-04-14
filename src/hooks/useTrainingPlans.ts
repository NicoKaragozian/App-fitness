import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Genera un plan con streaming SSE. Llama onThinking(text) con el texto de análisis
  // progresivo que Claude emite antes del JSON (visible al usuario).
  // Resuelve con { plan, recommendations } cuando el plan está guardado en DB.
  const generatePlanStream = useCallback(async (
    goal: string,
    onThinking: (text: string) => void,
  ): Promise<{ plan: TrainingPlanSummary; recommendations: string | null }> => {
    abortRef.current = new AbortController();

    const response = await fetch('/api/training/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
      signal: abortRef.current.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
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
            continue; // línea SSE no es JSON válido, ignorar
          }

          if (json.token !== undefined) {
            // Acumular tokens hasta el delimitador; solo mostrar la parte de análisis
            const combined = accumulatedThinking + json.token;
            const delimIdx = combined.indexOf(DELIMITER);
            if (delimIdx >= 0) {
              accumulatedThinking = combined.slice(0, delimIdx);
            } else {
              accumulatedThinking = combined;
            }
            onThinking(accumulatedThinking);
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

    if (!result) throw new Error('No se recibió el plan del servidor');
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
