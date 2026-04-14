import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface UserProfile {
  id: number;
  has_wearable: number;
  name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  experience_level: string | null;
  primary_goal: string | null;
  secondary_goals: string | null;
  sports: string | null;
  training_days_per_week: number | null;
  session_duration_min: number | null;
  equipment: string | null;
  injuries: string | null;
  dietary_preferences: string | null;
  daily_calorie_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  onboarded_at: string | null;
  updated_at: string | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const data = await apiFetch<UserProfile | null>('/profile');
      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveProfile = async (data: Partial<UserProfile>) => {
    const updated = await apiFetch<UserProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, saveProfile, refetch: fetchProfile };
}
