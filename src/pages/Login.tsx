import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login, enterDemoMode, isSyncing } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">Performance Dashboard</p>
          <h1 className="font-display text-4xl font-bold text-primary tracking-tight">DRIFT</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase block mb-1.5">
              GARMIN EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="email@garmin.com"
            />
          </div>

          <div>
            <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase block mb-1.5">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
              <p className="font-label text-label-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full bg-primary text-surface font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                SYNCING DATA...
              </span>
            ) : (
              'CONNECT GARMIN'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-outline-variant/30" />
            <span className="font-label text-label-sm text-on-surface-variant/50">O</span>
            <div className="flex-1 h-px bg-outline-variant/30" />
          </div>
          <button
            onClick={enterDemoMode}
            className="w-full bg-surface-container border border-outline-variant/20 text-on-surface-variant font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:text-on-surface hover:border-outline-variant/50 transition-colors"
          >
            DEMO MODE
          </button>
          <p className="font-label text-label-sm text-on-surface-variant/40 mt-2">
            Datos de ejemplo sin conexión a Garmin
          </p>
        </div>

        <p className="font-label text-label-sm text-on-surface-variant/40 text-center mt-6">
          Tus credenciales se usan solo para conectar con Garmin Connect
        </p>
      </div>
    </div>
  );
};
