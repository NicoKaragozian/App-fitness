import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { ChartMetricConfig } from './useActivities';

export interface SportGroupConfig {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  sportTypes: string[];
  metrics: string[];
  chartMetrics: ChartMetricConfig[];
  sortOrder: number;
}

export interface CreateGroupPayload {
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  sportTypes: string[];
  metrics: string[];
  chartMetrics: ChartMetricConfig[];
}

export function useSportGroups() {
  const [groups, setGroups] = useState<SportGroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroups = useCallback(() => {
    setLoading(true);
    apiFetch<SportGroupConfig[]>('/sport-groups')
      .then(setGroups)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = async (payload: CreateGroupPayload): Promise<SportGroupConfig> => {
    const created = await apiFetch<SportGroupConfig>('/sport-groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    fetchGroups();
    return created;
  };

  const updateGroup = async (id: string, payload: Partial<CreateGroupPayload>): Promise<SportGroupConfig> => {
    const updated = await apiFetch<SportGroupConfig>(`/sport-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    fetchGroups();
    return updated;
  };

  const deleteGroup = async (id: string): Promise<void> => {
    await apiFetch(`/sport-groups/${id}`, { method: 'DELETE' });
    fetchGroups();
  };

  const reorderGroups = async (orderedIds: string[]): Promise<void> => {
    await apiFetch('/sport-groups/reorder', {
      method: 'PUT',
      body: JSON.stringify({ order: orderedIds }),
    });
    fetchGroups();
  };

  return { groups, loading, error, refetch: fetchGroups, createGroup, updateGroup, deleteGroup, reorderGroups };
}
