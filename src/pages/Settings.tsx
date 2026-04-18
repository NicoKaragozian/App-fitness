import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { useAIProvider } from '../hooks/useAIProvider';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import { useSession } from '../lib/authClient';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { provider, setProvider } = useAIProvider();
  const { garminConnected, refreshStatus, isDemoMode } = useAuth();
  const { data: session } = useSession();
  const [syncLoading, setSyncLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [disconnectMsg, setDisconnectMsg] = useState('');

  const handleSyncGarmin = async () => {
    setSyncLoading(true);
    setSyncMsg('');
    try {
      await apiFetch('/auth/sync-garmin', { method: 'POST' });
      setSyncMsg('Sync started successfully.');
      await refreshStatus();
    } catch (err: any) {
      setSyncMsg(err.message || 'Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('This will disconnect Garmin and delete all synced data. Are you sure?')) return;
    setDisconnectLoading(true);
    setDisconnectMsg('');
    try {
      await apiFetch('/auth/garmin-disconnect', { method: 'DELETE' });
      setDisconnectMsg('Garmin disconnected successfully.');
      await refreshStatus();
    } catch (err: any) {
      setDisconnectMsg(err.message || 'Disconnect failed');
    } finally {
      setDisconnectLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-lg mx-auto space-y-6">

      {/* Language */}
      <div className="bg-surface-low rounded-xl p-5 space-y-4">
        <div>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">{t('settings.language')}</p>
          <p className="text-xs text-on-surface-variant mt-1">{t('settings.languageDesc')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-3 rounded-xl font-label text-sm tracking-widest uppercase transition-all border ${
              language === 'en'
                ? 'bg-primary text-surface border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface'
            }`}
          >
            🇬🇧 {t('settings.english')}
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`flex-1 py-3 rounded-xl font-label text-sm tracking-widest uppercase transition-all border ${
              language === 'es'
                ? 'bg-primary text-surface border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface'
            }`}
          >
            🇦🇷 {t('settings.spanish')}
          </button>
        </div>
      </div>

      {/* AI Provider */}
      <div className="bg-surface-low rounded-xl p-5 space-y-4">
        <div>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">{t('settings.aiProvider')}</p>
          <p className="text-xs text-on-surface-variant mt-1">{t('settings.aiProviderDesc')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setProvider('gemma')}
            className={`flex-1 py-3 rounded-xl font-label text-sm tracking-widest uppercase transition-all border ${
              provider === 'gemma'
                ? 'bg-primary text-surface border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface'
            }`}
          >
            ◉ Gemma
          </button>
          <button
            onClick={() => setProvider('claude')}
            className={`flex-1 py-3 rounded-xl font-label text-sm tracking-widest uppercase transition-all border ${
              provider === 'claude'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-blue-500/30 hover:text-on-surface'
            }`}
          >
            ◈ Claude
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <p className="text-xs text-on-surface-variant">{t('settings.gemmaDesc')}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
            <p className="text-xs text-on-surface-variant">{t('settings.claudeDesc')}</p>
          </div>
        </div>
      </div>

      {/* Profile link */}
      <div className="bg-surface-low rounded-xl p-5 space-y-3">
        <div>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">{t('settings.profile')}</p>
          <p className="text-xs text-on-surface-variant mt-1">{t('settings.profileDesc')}</p>
        </div>
        <button
          onClick={() => navigate('/training/profile')}
          className="font-label text-sm text-primary tracking-wide hover:opacity-70 transition-opacity"
        >
          {t('settings.editProfile')}
        </button>
      </div>

      {/* Garmin Connection */}
      {!isDemoMode && (
        <div className="bg-surface-low rounded-xl p-5 space-y-4">
          <div>
            <p className="font-label text-label-sm text-primary tracking-widest uppercase">Garmin Connect</p>
            <p className="text-xs text-on-surface-variant mt-1">Manage your Garmin data synchronization</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${garminConnected ? 'bg-green-500' : 'bg-on-surface-variant/30'}`} />
            <span className="font-body text-sm text-on-surface">
              {garminConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {garminConnected ? (
            <div className="space-y-2">
              <button
                onClick={handleSyncGarmin}
                disabled={syncLoading}
                className="w-full bg-surface-container border border-outline-variant/30 text-on-surface font-display font-bold text-sm py-2.5 rounded-xl tracking-widest uppercase hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
              >
                {syncLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Syncing...
                  </span>
                ) : 'Sync Now'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnectLoading}
                className="w-full bg-red-950/20 border border-red-900/30 text-red-400 font-display font-bold text-sm py-2.5 rounded-xl tracking-widest uppercase hover:border-red-900/60 transition-colors disabled:opacity-50"
              >
                {disconnectLoading ? 'Disconnecting...' : 'Disconnect Garmin'}
              </button>
              {syncMsg && <p className="text-xs text-on-surface-variant">{syncMsg}</p>}
              {disconnectMsg && <p className="text-xs text-on-surface-variant">{disconnectMsg}</p>}
            </div>
          ) : (
            <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-4">
              <p className="font-body text-sm text-on-surface-variant mb-2">To connect Garmin, run:</p>
              <code className="text-primary text-xs">
                npx tsx server/src/get-tokens.ts --email {session?.user?.email || 'your@email.com'}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Account info */}
      {!isDemoMode && session?.user && (
        <div className="bg-surface-low rounded-xl p-5 space-y-2">
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">Account</p>
          <p className="font-body text-sm text-on-surface-variant">{session.user.name}</p>
          <p className="font-body text-xs text-on-surface-variant/60">{session.user.email}</p>
        </div>
      )}
    </div>
  );
};
