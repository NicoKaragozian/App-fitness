import { useState, useEffect, useRef, useCallback } from 'react';
import { stripMarkdown } from '../utils/stripMarkdown';

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current.onstart = null;
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const plain = stripMarkdown(text);
    if (!plain.trim()) return;

    const utterance = new SpeechSynthesisUtterance(plain);
    utteranceRef.current = utterance;
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => { setSpeaking(false); utteranceRef.current = null; };
    utterance.onerror = () => { setSpeaking(false); utteranceRef.current = null; };
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
    utteranceRef.current = null;
  }, [supported]);

  return { speak, stop, speaking, supported };
}
