import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { enterDemoMode } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // El auto-detect via polling en AuthContext se encarga de la conexión automática.
  // Este botón es un fallback manual por si el usuario quiere forzar la detección.
  const handleManualConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/token-login', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error ${res.status}`);
      }
      // Si ok, el polling de AuthContext detectará authenticated: true automáticamente
    } catch {
      setError('No se pudo conectar al servidor');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">Performance Dashboard</p>
          <h1 className="font-display text-4xl font-bold text-primary tracking-tight">DRIFT</h1>
        </div>

        {/* Instrucciones */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 mb-5 space-y-3">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
            Conectar Garmin
          </p>
          <ol className="space-y-2">
            <li className="flex gap-3">
              <span className="font-display font-bold text-primary text-sm w-5 shrink-0">1</span>
              <p className="font-body text-sm text-on-surface-variant">
                Abrí una terminal en la raíz del proyecto
              </p>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-primary text-sm w-5 shrink-0">2</span>
              <p className="font-body text-sm text-on-surface-variant">
                Corré:{' '}
                <code className="text-primary bg-surface px-1.5 py-0.5 rounded text-xs">
                  npx tsx server/src/get-tokens.ts
                </code>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-primary text-sm w-5 shrink-0">3</span>
              <p className="font-body text-sm text-on-surface-variant">
                Logueate en el browser que se abre — el dashboard carga solo
              </p>
            </li>
          </ol>
        </div>

        {/* Indicador de espera */}
        <div className="flex items-center gap-3 mb-5 px-1">
          <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse shrink-0" />
          <p className="font-label text-label-sm text-on-surface-variant/60">
            Esperando tokens...
          </p>
        </div>

        {/* Botón manual de fallback */}
        <button
          onClick={handleManualConnect}
          disabled={connecting}
          className="w-full bg-surface-container border border-outline-variant/30 text-on-surface font-display font-bold text-sm py-3 rounded-xl tracking-widest uppercase hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50 mb-3"
        >
          {connecting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              CONECTANDO...
            </span>
          ) : (
            'YA CORRÍ EL SCRIPT'
          )}
        </button>

        {error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 mb-4">
            <p className="font-label text-label-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 mt-2">
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
        <p className="font-label text-label-sm text-on-surface-variant/40 mt-2 text-center">
          Datos de ejemplo sin conexión a Garmin
        </p>
      </div>
    </div>
  );
};
