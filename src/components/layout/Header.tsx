import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHealthKitSyncState } from '../../context/HealthKitSyncContext';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'PERFORMANCE', subtitle: 'FLOW GENERAL' },
  '/sports': { title: 'ANÁLISIS DE DEPORTES', subtitle: 'BIOMETRIC PERFORMANCE OVERVIEW' },
  '/sleep': { title: 'SLEEP INTELLIGENCE', subtitle: "LAST NIGHT'S ANALYSIS" },
  '/wellness': { title: 'WELLNESS', subtitle: 'HOME / SPORTS / SLEEP / WELLNESS' },
  '/training': { title: 'TRAINING PLANS', subtitle: 'PLANES PERSONALIZADOS' },
  '/coach': { title: 'AI COACH', subtitle: 'DRIFT AI' },
};

const formatDate = () => {
  const d = new Date();
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
};

export const Header: React.FC = () => {
  const location = useLocation();
  const pathKey = Object.keys(pageTitles)
    .filter(k => k !== '/')
    .find(k => location.pathname === k || location.pathname.startsWith(k + '/'))
    ?? (pageTitles[location.pathname] ? location.pathname : '/');
  const page = pageTitles[pathKey] || pageTitles['/'];
  const { isAuthenticated, logout } = useAuth();
  const hkSync = useHealthKitSyncState();

  return (
    <header className="flex items-center justify-between px-4 py-3 lg:px-8 lg:py-5 bg-surface-low/80 backdrop-blur-sm sticky top-0 z-40">
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{page.subtitle}</p>
        <h2 className="font-display text-headline-md text-on-surface font-bold tracking-tight">{page.title}</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* HealthKit sync status badge — solo visible en iOS nativo */}
        {hkSync.status === 'syncing' && (
          <div className="hidden md:flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-xl">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-yellow-400"></div>
            <span className="font-label text-label-sm text-on-surface-variant">SYNC HK</span>
          </div>
        )}
        {hkSync.status === 'error' && (
          <button
            onClick={hkSync.retry}
            className="hidden md:flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-xl hover:bg-surface-container/70 transition-all"
            title={hkSync.error ?? 'Error sincronizando HealthKit — tap para reintentar'}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
            <span className="font-label text-label-sm text-red-400">HK ERROR</span>
          </button>
        )}
        {hkSync.status === 'error' && (
          <button
            onClick={hkSync.retry}
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-surface-container"
            title={hkSync.error ?? 'Error sincronizando HealthKit'}
          >
            <span className="text-sm">⚠️</span>
          </button>
        )}
        {isAuthenticated && (
          <button
            onClick={logout}
            className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-xl hover:bg-surface-container/70 transition-all cursor-pointer"
            title="Cerrar sesión"
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary"></div>
            <span className="font-label text-label-sm text-on-surface-variant">CONECTADO</span>
            <span className="font-label text-label-sm text-on-surface-variant opacity-60">⏏</span>
          </button>
        )}
        {/* Mobile logout icon */}
        {isAuthenticated && (
          <button
            onClick={logout}
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface transition-all"
            title="Cerrar sesión"
          >
            <span className="text-base">⏏</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="font-label text-label-sm text-on-surface-variant">{formatDate()}</span>
        </div>
      </div>
    </header>
  );
};
