import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'DASHBOARD', subtitle: 'DRIFT OVERVIEW' },
  '/sports': { title: 'ANÁLISIS DE DEPORTES', subtitle: 'BIOMETRIC PERFORMANCE OVERVIEW' },
  '/training': { title: 'TRAINING PLANS', subtitle: 'PLANES PERSONALIZADOS' },
  '/nutrition': { title: 'NUTRICIÓN', subtitle: 'TRACKING DIARIO' },
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
  const { isAuthenticated, isDemoMode, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-4 py-3 lg:px-8 lg:py-5 bg-surface-low/80 backdrop-blur-sm sticky top-0 z-40">
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{page.subtitle}</p>
        <h2 className="font-display text-headline-md text-on-surface font-bold tracking-tight">{page.title}</h2>
      </div>
      <div className="flex items-center gap-4">
        {(isAuthenticated || isDemoMode) && (
          <button
            onClick={logout}
            className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-xl hover:bg-surface-container/70 transition-all cursor-pointer"
            title="Cerrar sesión"
          >
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDemoMode ? 'bg-yellow-400' : 'bg-primary'}`}></div>
            <span className="font-label text-label-sm text-on-surface-variant">{isDemoMode ? 'DEMO MODE' : 'GARMIN CONNECTED'}</span>
            <span className="font-label text-label-sm text-on-surface-variant opacity-60">⏏</span>
          </button>
        )}
        {/* Mobile logout icon */}
        {(isAuthenticated || isDemoMode) && (
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
