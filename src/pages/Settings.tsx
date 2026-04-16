import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { useAIProvider } from '../hooks/useAIProvider';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { provider, setProvider } = useAIProvider();

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
    </div>
  );
};
