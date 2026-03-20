import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  login: (email: string, password: string) => Promise<void>;
  enterDemoMode: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isDemoMode: false,
  isSyncing: false,
  lastSync: null,
  login: async () => {},
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

  useEffect(() => {
    if (isDemoMode) {
      setChecked(true);
      return;
    }
    apiFetch<{ authenticated: boolean; syncing: boolean; lastSync: string | null }>('/auth/status')
      .then((data) => {
        setIsAuthenticated(data.authenticated);
        setIsSyncing(data.syncing);
        setLastSync(data.lastSync);
      })
      .catch(() => {
        // Server not available - stay unauthenticated
      })
      .finally(() => setChecked(true));
  }, [isDemoMode]);

  const login = useCallback(async (email: string, password: string) => {
    setIsSyncing(true);
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setIsAuthenticated(true);
      setIsDemoMode(false);
      localStorage.removeItem('drift_demo');
    } finally {
      setIsSyncing(false);
    }
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
    <AuthContext.Provider value={{ isAuthenticated, isDemoMode, isSyncing, lastSync, login, enterDemoMode, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
