import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

function formatDate(lang: string) {
  const d = new Date();
  if (lang === 'es') {
    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  }
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { isAuthenticated, isDemoMode, logout } = useAuth();

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'AI COACH', subtitle: t('aiCoach.subtitle').toUpperCase() },
    '/dashboard': { title: 'DASHBOARD', subtitle: 'DRIFT OVERVIEW' },
    '/sports': { title: t('sports.title').toUpperCase(), subtitle: t('sports.subtitle').toUpperCase() },
    '/training/profile': { title: t('assessment.title').toUpperCase(), subtitle: t('assessment.subtitle').toUpperCase() },
    '/training': { title: t('training.title').toUpperCase(), subtitle: t('training.subtitle').toUpperCase() },
    '/nutrition': { title: t('nutrition.title').toUpperCase(), subtitle: t('nutrition.subtitle').toUpperCase() },
    '/settings': { title: t('settings.title').toUpperCase(), subtitle: t('settings.subtitle').toUpperCase() },
    '/coach': { title: 'AI COACH', subtitle: 'DRIFT AI' },
  };

  const pathKey = Object.keys(pageTitles)
    .filter(k => k !== '/')
    .sort((a, b) => b.length - a.length)
    .find(k => location.pathname === k || location.pathname.startsWith(k + '/'))
    ?? (pageTitles[location.pathname] ? location.pathname : '/');
  const page = pageTitles[pathKey] || pageTitles['/'];

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
            title={t('nav.logout')}
          >
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDemoMode ? 'bg-yellow-400' : 'bg-primary'}`}></div>
            <span className="font-label text-label-sm text-on-surface-variant">
              {isDemoMode ? t('header.demoMode') : t('header.garminConnected')}
            </span>
            <span className="font-label text-label-sm text-on-surface-variant opacity-60">⏏</span>
          </button>
        )}
        {(isAuthenticated || isDemoMode) && (
          <button
            onClick={logout}
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface transition-all"
            title={t('nav.logout')}
          >
            <span className="text-base">⏏</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="font-label text-label-sm text-on-surface-variant">{formatDate(i18n.language)}</span>
        </div>
      </div>
    </header>
  );
};
