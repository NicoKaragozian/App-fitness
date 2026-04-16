// hooks/useAIProvider.ts — Global AI provider toggle (gemma | claude)
// Persisted in localStorage. Defaults to 'gemma'.

import { useState, useCallback } from 'react';

export type ProviderName = 'gemma' | 'claude';

const STORAGE_KEY = 'drift_ai_provider';

function readStoredProvider(): ProviderName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'claude' || stored === 'gemma') return stored;
  } catch {}
  return 'gemma';
}

export function useAIProvider() {
  const [provider, setProviderState] = useState<ProviderName>(readStoredProvider);

  const setProvider = useCallback((name: ProviderName) => {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {}
    setProviderState(name);
  }, []);

  return { provider, setProvider };
}
