import { useState, useCallback, useRef } from 'react';

type AnalyzeMode = 'session' | 'sleep' | 'wellness' | 'sport' | 'monthly' | 'daily';

interface AnalysisState {
  content: string;
  loading: boolean;
  error: string | null;
  cached: boolean;
  generatedAt: string | null;
}

export function useAIAnalysis(mode: AnalyzeMode, payload: Record<string, string> = {}) {
  const [state, setState] = useState<AnalysisState>({
    content: '',
    loading: false,
    error: null,
    cached: false,
    generatedAt: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (force = false) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ content: '', loading: true, error: null, cached: false, generatedAt: null });

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, payload, force }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        setState(s => ({ ...s, loading: false, error: err.error || `Error ${res.status}` }));
        return;
      }

      // Cached response = JSON
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setState({
          content: data.content,
          loading: false,
          error: null,
          cached: true,
          generatedAt: data.generatedAt,
        });
        return;
      }

      // Streaming response = SSE
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let generatedAt: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });

        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            if (json.token) {
              accumulated += json.token;
              setState(s => ({ ...s, content: accumulated }));
            }
            if (json.done) {
              generatedAt = json.generatedAt ?? null;
            }
          } catch { /* skip */ }
        }
      }

      setState(s => ({ ...s, loading: false, cached: false, generatedAt }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState(s => ({ ...s, loading: false, error: err.message || 'Error de conexión' }));
    }
  }, [mode, JSON.stringify(payload)]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState(s => ({ ...s, loading: false }));
  }, []);

  return { ...state, generate, stop };
}
