import { createContext, useContext } from 'react';

export interface HealthKitSyncState {
  status: 'idle' | 'syncing' | 'done' | 'error' | 'unsupported';
  lastSync: Date | null;
  error: string | null;
  retry: () => void;
}

export const HealthKitSyncContext = createContext<HealthKitSyncState>({
  status: 'idle',
  lastSync: null,
  error: null,
  retry: () => {},
});

export const useHealthKitSyncState = () => useContext(HealthKitSyncContext);
