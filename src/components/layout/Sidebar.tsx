import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isDemoMode, logout } = useAuth();

  const navItems = [
    { path: '/', label: t('nav.aiCoach'), icon: '◎' },
    { path: '/dashboard', label: t('nav.dashboard'), icon: '◉' },
    { path: '/sports', label: t('nav.sports'), icon: '⚡' },
    { path: '/training', label: t('nav.training'), icon: '▣' },
    { path: '/nutrition', label: t('nav.nutrition'), icon: '◈' },
  ];

  const statusLabel = isDemoMode ? t('nav.demo') : isAuthenticated ? t('nav.connected') : t('nav.disconnected');
  const statusColor = isDemoMode ? 'bg-yellow-400' : isAuthenticated ? 'bg-primary' : 'bg-red-400';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-48 bg-surface-low flex-col py-8 px-5 z-50">
        <div className="mb-10">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">Dashboard</p>
          <h1 className="font-display text-primary text-lg font-bold tracking-tight">DRIFT</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-body text-sm ${
                  isActive
                    ? 'bg-surface-container text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {/* Settings link */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-label text-label-sm tracking-wider uppercase ${
                isActive
                  ? 'bg-surface-container text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
              }`
            }
          >
            <span>⚙</span>
            <span>{t('nav.settings')}</span>
          </NavLink>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse`}></div>
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{statusLabel}</span>
          </div>
          {(isAuthenticated || isDemoMode) && (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50 transition-all font-label text-label-sm tracking-wider uppercase"
            >
              <span>⏏</span>
              <span>{t('nav.logout')}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="flex lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface-low/95 backdrop-blur-sm border-t border-outline-variant/20 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-label text-[0.6rem] tracking-wider uppercase">{item.label}</span>
          </NavLink>
        ))}
        {/* Settings in mobile nav */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          <span className="text-lg">⚙</span>
          <span className="font-label text-[0.6rem] tracking-wider uppercase">{t('nav.settings')}</span>
        </NavLink>
      </nav>
    </>
  );
};
