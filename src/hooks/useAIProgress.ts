import { useState, useRef, useCallback, useEffect } from 'react';

export interface AIProgressPhase {
  at: number;   // threshold de progreso (0-100) en que esta frase aparece
  label: string;
}

export interface AIProgressConfig {
  mode: 'streaming' | 'timed';
  expectedTokens?: number;      // para mode='streaming'
  estimatedDurationMs?: number; // para mode='timed' (default 12000)
  phases: AIProgressPhase[];
}

interface ProgressState {
  progress: number;
  phase: string;
  isActive: boolean;
}

export function useAIProgress() {
  const [state, setState] = useState<ProgressState>({
    progress: 0,
    phase: '',
    isActive: false,
  });

  const targetProgressRef = useRef(0);
  const tokenCountRef = useRef(0);
  const configRef = useRef<AIProgressConfig | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  const getPhaseLabel = useCallback((progress: number, phases: AIProgressPhase[]): string => {
    let label = phases[0]?.label ?? '';
    for (const p of phases) {
      if (progress >= p.at) label = p.label;
    }
    return label;
  }, []);

  // Animacion suave hacia targetProgress
  const animateProgress = useCallback(() => {
    if (!isActiveRef.current) return;

    setState(prev => {
      const target = targetProgressRef.current;
      const diff = target - prev.progress;
      if (Math.abs(diff) < 0.3) {
        return { ...prev, progress: target, phase: getPhaseLabel(target, configRef.current?.phases ?? []) };
      }
      const next = prev.progress + diff * 0.08; // velocidad de interpolacion
      return { ...prev, progress: next, phase: getPhaseLabel(next, configRef.current?.phases ?? []) };
    });

    animFrameRef.current = requestAnimationFrame(animateProgress);
  }, [getPhaseLabel]);

  const start = useCallback((config: AIProgressConfig) => {
    // Limpiar cualquier estado previo
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    configRef.current = config;
    tokenCountRef.current = 0;
    targetProgressRef.current = 0;
    isActiveRef.current = true;

    setState({
      progress: 0,
      phase: config.phases[0]?.label ?? '',
      isActive: true,
    });

    // Para modo timed: avanzar con setInterval
    if (config.mode === 'timed') {
      const duration = config.estimatedDurationMs ?? 12000;
      const intervalMs = 300;
      let elapsed = 0;

      timerRef.current = setInterval(() => {
        elapsed += intervalMs;
        // Curva logaritmica: rapido al principio, lento despues
        const ratio = elapsed / duration;
        const target = Math.min(85, 85 * (1 - Math.exp(-ratio * 3)));
        targetProgressRef.current = target;
      }, intervalMs);
    }

    animFrameRef.current = requestAnimationFrame(animateProgress);
  }, [animateProgress]);

  const onToken = useCallback(() => {
    if (!isActiveRef.current || configRef.current?.mode !== 'streaming') return;
    const expectedTokens = configRef.current?.expectedTokens ?? 2000;
    tokenCountRef.current += 1;
    const rawProgress = (tokenCountRef.current / expectedTokens) * 90;
    targetProgressRef.current = Math.min(90, rawProgress);
  }, []);

  const complete = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    targetProgressRef.current = 100;
    // Despues de llegar a 100, marcar isActive=false con un delay para que se vea
    const checkDone = () => {
      setState(prev => {
        if (prev.progress >= 99.5) {
          isActiveRef.current = false;
          return { progress: 100, phase: prev.phase, isActive: false };
        }
        return prev;
      });
      if (isActiveRef.current) {
        requestAnimationFrame(checkDone);
      }
    };
    requestAnimationFrame(checkDone);
  }, []);

  const reset = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    animFrameRef.current = null;
    timerRef.current = null;
    isActiveRef.current = false;
    targetProgressRef.current = 0;
    tokenCountRef.current = 0;
    configRef.current = null;
    setState({ progress: 0, phase: '', isActive: false });
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      isActiveRef.current = false;
    };
  }, []);

  return {
    progress: state.progress,
    phase: state.phase,
    isActive: state.isActive,
    start,
    onToken,
    complete,
    reset,
  };
}
