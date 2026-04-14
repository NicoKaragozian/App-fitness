import React from 'react';
import { useTTS } from '../../hooks/useTTS';

interface TTSButtonProps {
  text: string;
  className?: string;
}

export const TTSButton: React.FC<TTSButtonProps> = ({ text, className = '' }) => {
  const { speak, stop, speaking, supported } = useTTS();

  if (!supported) return null;

  return (
    <button
      onClick={() => speaking ? stop() : speak(text)}
      title={speaking ? 'Detener' : 'Leer en voz alta'}
      className={`flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${
        speaking
          ? 'text-primary bg-primary/20 hover:bg-primary/30'
          : 'text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-high'
      } ${className}`}
    >
      {speaking ? (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 animate-pulse">
          <rect x="2" y="5" width="2" height="6" rx="1" />
          <rect x="5" y="3" width="2" height="10" rx="1" />
          <rect x="8" y="5" width="2" height="6" rx="1" />
          <rect x="11" y="2" width="2" height="12" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <path d="M3 5.5H1.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5H3l3 2.5V3L3 5.5z" fill="currentColor" />
          <path d="M8 5a3.5 3.5 0 0 1 0 6M10 3.5a6 6 0 0 1 0 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
};
