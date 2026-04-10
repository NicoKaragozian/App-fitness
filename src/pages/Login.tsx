import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

type Mode = 'login' | 'register';

export const Login: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsInvite, setNeedsInvite] = useState<boolean | null>(null);

  // Al cambiar a registro, chequear si hay usuarios (para saber si pedir invite code)
  const switchToRegister = async () => {
    setMode('register');
    setError('');
    try {
      const data = await apiFetch<{ hasUsers: boolean }>('/users/has-users');
      setNeedsInvite(data.hasUsers);
    } catch {
      setNeedsInvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, inviteCode || undefined);
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">
            Performance Dashboard
          </p>
          <h1 className="font-display text-4xl font-bold text-primary tracking-tight">DRIFT</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 mb-5">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg font-display font-bold text-xs tracking-widest uppercase transition-colors ${
              mode === 'login'
                ? 'bg-primary text-surface'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Ingresar
          </button>
          <button
            onClick={switchToRegister}
            className={`flex-1 py-2 rounded-lg font-display font-bold text-xs tracking-widest uppercase transition-colors ${
              mode === 'register'
                ? 'bg-primary text-surface'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 font-body text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 font-body text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50"
            />
          </div>

          {mode === 'register' && needsInvite && (
            <div>
              <input
                type="text"
                placeholder="Invite code"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 font-body text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/50 tracking-widest"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
              <p className="font-label text-label-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-primary text-surface font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                {mode === 'login' ? 'INGRESANDO...' : 'CREANDO CUENTA...'}
              </span>
            ) : (
              mode === 'login' ? 'INGRESAR' : 'CREAR CUENTA'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
