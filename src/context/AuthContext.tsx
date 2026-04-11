import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  username: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Verificar sesión al cargar
  useEffect(() => {
    apiFetch<{ authenticated: boolean }>('/auth/status')
      .then(data => {
        if (data.authenticated) {
          // Obtener el username
          return apiFetch<{ username: string }>('/users/me').then(me => {
            setIsAuthenticated(true);
            setUsername(me.username);
          });
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  // Escuchar evento de 401 desde apiFetch — hace logout limpio sin recargar la página
  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(false);
      setUsername(null);
    };
    window.addEventListener('drift:unauthorized', handler);
    return () => window.removeEventListener('drift:unauthorized', handler);
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const data = await apiFetch<{ username: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: user, password }),
    });
    setIsAuthenticated(true);
    setUsername(data.username);
  }, []);

  const register = useCallback(async (user: string, password: string, inviteCode?: string) => {
    const data = await apiFetch<{ username: string }>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ username: user, password, inviteCode }),
    });
    setIsAuthenticated(true);
    setUsername(data.username);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/users/logout', { method: 'POST' }).catch(() => {});
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
