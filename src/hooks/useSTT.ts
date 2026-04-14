import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSTTOptions {
  onResult?: (finalText: string) => void;
}

interface UseSTTReturn {
  start: (options?: UseSTTOptions) => void;
  stop: () => void;
  listening: boolean;
  supported: boolean;
  error: string | null;
}

const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permiso de micrófono denegado',
  'no-speech': 'No se detectó voz',
  'network': 'Error de red',
  'audio-capture': 'No se pudo acceder al micrófono',
  'service-not-allowed': 'Servicio de voz no permitido',
};

export function useSTT(): UseSTTReturn {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const onResultRef = useRef<((text: string) => void) | undefined>(undefined);

  const supported = !!getSpeechRecognition();

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const createRecognition = useCallback((opts?: UseSTTOptions) => {
    const SR = getSpeechRecognition();
    if (!SR) return null;

    onResultRef.current = opts?.onResult;

    const recognition = new SR();
    recognition.lang = 'es-AR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text && onResultRef.current) {
            onResultRef.current(text);
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return;
      const msg = ERROR_MESSAGES[event.error] ?? `Error: ${event.error}`;
      setError(msg);
      setListening(false);
      listeningRef.current = false;
      // Clear error after 3s
      setTimeout(() => setError(null), 3000);
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't stopped (Chrome cuts off after ~60s)
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          listeningRef.current = false;
        }
      } else {
        setListening(false);
      }
    };

    return recognition;
  }, []);

  const start = useCallback((opts?: UseSTTOptions) => {
    if (!supported) return;
    setError(null);

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = createRecognition(opts);
    if (!recognition) return;

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);

    try {
      recognition.start();
    } catch {
      setListening(false);
      listeningRef.current = false;
    }
  }, [supported, createRecognition]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  return { start, stop, listening, supported, error };
}
