import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  tokenLogin: () => Promise<void>;
  enterDemoMode: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isDemoMode: false,
  isSyncing: false,
  lastSync: null,
  tokenLogin: async () => {},
  enterDemoMode: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem('drift_demo') === '1');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const fetchStatus = useCallback(async () => {
    const data = await apiFetch<{ authenticated: boolean; syncing: boolean; lastSync: string | null }>('/auth/status');
    setIsAuthenticated(data.authenticated);
    setIsSyncing(data.syncing);
    setLastSync(data.lastSync);
    return data.authenticated;
  }, []);

  // Carga inicial
  useEffect(() => {
    if (isDemoMode) {
      setChecked(true);
      return;
    }
    fetchStatus()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [isDemoMode, fetchStatus]);

  // Poll every 3 seconds while not authenticated (for auto-detect tokens)
  useEffect(() => {
    if (!checked || isAuthenticated || isDemoMode) return;
    const id = setInterval(() => {
      fetchStatus().catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [checked, isAuthenticated, isDemoMode, fetchStatus]);

  const tokenLogin = useCallback(async () => {
    await apiFetch('/auth/token-login', { method: 'POST' });
    setIsAuthenticated(true);
    setIsDemoMode(false);
    localStorage.removeItem('drift_demo');
  }, []);

  const enterDemoMode = useCallback(() => {
    localStorage.setItem('drift_demo', '1');
    setIsDemoMode(true);
  }, []);

  const logout = useCallback(() => {
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setLastSync(null);
    localStorage.removeItem('drift_demo');
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isDemoMode, isSyncing, lastSync, tokenLogin, enterDemoMode, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
