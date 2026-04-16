// hooks/useLanguage.ts — Global language toggle (en | es)
// Persisted in localStorage. Defaults to 'en'.

import { useState, useCallback } from 'react';
import i18n from '../i18n';

export type Language = 'en' | 'es';

const STORAGE_KEY = 'drift_language';

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {}
  return 'en';
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    i18n.changeLanguage(lang);
    setLanguageState(lang);
  }, []);

  return { language, setLanguage };
}
