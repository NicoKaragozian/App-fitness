import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import { useSession, signOut } from '../lib/authClient';

interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  garminConnected: boolean;
  userId: string | null;
  userRole: string | null;
  enterDemoMode: () => void;
  logout: () => void;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isDemoMode: false,
  isSyncing: false,
  lastSync: null,
  garminConnected: false,
  userId: null,
  userRole: null,
  enterDemoMode: () => {},
  logout: () => {},
  refreshStatus: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending } = useSession();
  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem('drift_demo') === '1');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [garminConnected, setGarminConnected] = useState(false);

  const isAuthenticated = Boolean(session?.user) || isDemoMode;

  const fetchStatus = useCallback(async () => {
    if (!session?.user) return;
    try {
      const data = await apiFetch<{
        authenticated: boolean;
        syncing: boolean;
        lastSync: string | null;
        garminConnected: boolean;
      }>('/auth/status');
      setIsSyncing(data.syncing);
      setLastSync(data.lastSync);
      setGarminConnected(data.garminConnected);
    } catch {
      // ignore
    }
  }, [session?.user]);

  useEffect(() => {
    if (session?.user) {
      fetchStatus();
    }
  }, [session?.user, fetchStatus]);

  // Real login replaces demo: avoid demo flag + session fighting (401s, wrong UX).
  useEffect(() => {
    if (!session?.user) return;
    try {
      if (localStorage.getItem('drift_demo') === '1') {
        localStorage.removeItem('drift_demo');
        setIsDemoMode(false);
      }
    } catch {
      /* ignore */
    }
  }, [session?.user]);

  const refreshStatus = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  const enterDemoMode = useCallback(() => {
    localStorage.setItem('drift_demo', '1');
    setIsDemoMode(true);
  }, []);

  const logout = useCallback(async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      localStorage.removeItem('drift_demo');
      return;
    }
    try {
      await signOut();
      apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {
      // ignore
    }
    setIsDemoMode(false);
    setLastSync(null);
    setGarminConnected(false);
    localStorage.removeItem('drift_demo');
  }, [isDemoMode]);

  if (isPending && !isDemoMode) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isDemoMode,
      isSyncing,
      lastSync,
      garminConnected,
      userId: session?.user?.id ?? null,
      userRole: (session?.user as any)?.role ?? null,
      enterDemoMode,
      logout,
      refreshStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
