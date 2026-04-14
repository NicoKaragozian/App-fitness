import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api/client';

export interface NutritionLog {
  id: number;
  date: string;
  logged_at: string;
  meal_slot: string | null;
  meal_name: string | null;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  image_path: string | null;
  ai_model: string | null;
  ai_confidence: string | null;
}

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroTargets {
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
}

export interface FoodAnalysis {
  meal_name: string;
  description: string;
  items: { name: string; estimated_grams: number }[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  confidence: 'low' | 'medium' | 'high';
  notes: string;
  image_path: string;
}

export function useNutrition(date?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = date || today;

  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [totals, setTotals] = useState<MacroTotals>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [targets, setTargets] = useState<MacroTargets>({ daily_calorie_target: 2000, daily_protein_g: 150, daily_carbs_g: 250, daily_fat_g: 65 });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del analisis de foto
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStream, setAnalysisStream] = useState('');
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ logs: NutritionLog[]; totals: MacroTotals; targets: MacroTargets; hasProfile: boolean }>(
        `/nutrition/logs?date=${targetDate}`
      );
      setLogs(data.logs);
      setTotals(data.totals);
      setTargets(data.targets);
      setHasProfile(data.hasProfile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Analisis de foto con Claude Vision (streaming SSE)
  const analyzeMeal = useCallback(async (file: File): Promise<void> => {
    setAnalyzing(true);
    setAnalysisStream('');
    setAnalysisResult(null);
    setAnalysisError(null);

    abortRef.current = new AbortController();

    const formData = new FormData();
    formData.append('image', file);

    let imagePath = '';
    let accumulatedText = '';

    try {
      const response = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            // Parsear el JSON acumulado
            try {
              let jsonStr = accumulatedText.trim();
              if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
              }
              const parsed = JSON.parse(jsonStr);
              setAnalysisResult({ ...parsed, image_path: imagePath });
            } catch {
              setAnalysisError('No se pudo parsear la respuesta de Claude. Intentá de nuevo.');
            }
            break;
          }

          try {
            const json = JSON.parse(data);
            if (json.image_path) {
              imagePath = json.image_path;
            } else if (json.token) {
              accumulatedText += json.token;
              setAnalysisStream(prev => prev + json.token);
            } else if (json.error) {
              setAnalysisError(json.error);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAnalysisError(err.message || 'Error al analizar la imagen');
      }
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    abortRef.current?.abort();
    setAnalyzing(false);
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisStream('');
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  const saveMealLog = useCallback(async (data: {
    date: string;
    meal_slot?: string;
    meal_name?: string;
    description?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    image_path?: string;
    ai_model?: string;
    ai_confidence?: string;
    raw_ai_response?: string;
  }) => {
    const result = await apiFetch<{ id: number }>('/nutrition/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await fetchLogs();
    return result;
  }, [fetchLogs]);

  const editLog = useCallback(async (id: number, data: Partial<NutritionLog>) => {
    await apiFetch(`/nutrition/logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    await fetchLogs();
  }, [fetchLogs]);

  const deleteLog = useCallback(async (id: number) => {
    await apiFetch(`/nutrition/logs/${id}`, { method: 'DELETE' });
    await fetchLogs();
  }, [fetchLogs]);

  return {
    logs, totals, targets, hasProfile, loading, error,
    analyzing, analysisStream, analysisResult, analysisError,
    analyzeMeal, stopAnalysis, clearAnalysis,
    saveMealLog, editLog, deleteLog,
    refetch: fetchLogs,
  };
}
