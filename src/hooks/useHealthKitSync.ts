import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { requestHealthKitPermissions, fetchHealthKitData } from '../native/healthkit';
import { apiFetch } from '../api/client';

interface SyncResult {
  inserted: { activities: number; sleep: number; dailySummary: number };
}

interface SyncState {
  status: 'idle' | 'syncing' | 'done' | 'error' | 'unsupported';
  lastSync: Date | null;
  error: string | null;
}

const LAST_SYNC_KEY = 'drift_hk_last_sync';

export function useHealthKitSync() {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSync: null,
    error: null,
  });

  useEffect(() => {
    console.log('[HealthKit] isNative:', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform());
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      setState(s => ({ ...s, status: 'unsupported' }));
      return;
    }

    // No re-sincronizar si ya se hizo en las últimas 12 horas
    const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSyncStr) {
      const lastSync = new Date(lastSyncStr);
      const hoursSinceLast = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 12) {
        setState({ status: 'done', lastSync, error: null });
        return;
      }
    }

    syncHealthKit();
  }, []);

  async function syncHealthKit() {
    setState(s => ({ ...s, status: 'syncing', error: null }));
    try {
        console.log('[HealthKit] Requesting permissions...');
      const granted = await requestHealthKitPermissions();
      console.log('[HealthKit] Permissions granted:', granted);
      if (!granted) {
        setState({ status: 'error', lastSync: null, error: 'Permisos de HealthKit denegados' });
        return;
      }

      const data = await fetchHealthKitData(90);
      const result = await apiFetch<SyncResult>('/healthkit/sync', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const now = new Date();
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setState({ status: 'done', lastSync: now, error: null });
      console.log(`[HealthKit] Sync done:`, result.inserted);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setState({ status: 'error', lastSync: null, error: msg });
      console.error('[HealthKit] Sync failed:', e);
    }
  }

  return { ...state, retry: syncHealthKit };
}
