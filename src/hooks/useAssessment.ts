import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

const DEMO_ASSESSMENT_KEY = 'drift_demo_assessment';

function isDemoMode(): boolean {
  try {
    return localStorage.getItem('drift_demo') === '1';
  } catch {
    return false;
  }
}

export interface Assessment {
  id: number;
  name: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  fitness_level: string | null;
  goals: string | null;          // JSON array string
  goals_other: string | null;
  sport_practice: string | null;
  sport_name: string | null;
  available_days: string | null; // JSON array string
  session_duration: number | null;
  equipment: string | null;      // JSON array string
  equipment_other: string | null;
  injuries_limitations: string | null;
  training_preferences: string | null;
  past_injuries_detail: string | null;
  time_constraints: string | null;
  short_term_goals: string | null;
  long_term_goals: string | null;
  special_considerations: string | null;
  updated_at: string | null;
}

export function useAssessment() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAssessment = useCallback(async () => {
    try {
      if (isDemoMode()) {
        const raw = localStorage.getItem(DEMO_ASSESSMENT_KEY);
        if (raw) setAssessment(JSON.parse(raw) as Assessment);
        else setAssessment(null);
        return;
      }
      const data = await apiFetch<Assessment | null>('/assessment');
      setAssessment(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssessment(); }, [fetchAssessment]);

  const save = useCallback(async (data: Record<string, any>) => {
    if (isDemoMode()) {
      const raw = localStorage.getItem(DEMO_ASSESSMENT_KEY);
      const prev = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : { id: 1 };
      const merged = {
        ...prev,
        ...data,
        updated_at: new Date().toISOString(),
      } as Assessment;
      localStorage.setItem(DEMO_ASSESSMENT_KEY, JSON.stringify(merged));
      setAssessment(merged);
      return merged;
    }
    const result = await apiFetch<Assessment>('/assessment', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setAssessment(result);
    return result;
  }, []);

  return { assessment, loading, save, refetch: fetchAssessment };
}
