import React from 'react';
import { useSTT } from '../../hooks/useSTT';

interface STTButtonProps {
  onTranscript: (text: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

export const STTButton: React.FC<STTButtonProps> = ({
  onTranscript,
  size = 'sm',
  className = '',
  disabled = false,
}) => {
  const { start, stop, listening, supported, error } = useSTT();

  if (!supported) return null;

  const handleClick = () => {
    if (disabled) return;
    if (listening) {
      stop();
    } else {
      start({ onResult: onTranscript });
    }
  };

  const sizeClasses = size === 'md'
    ? 'w-8 h-8 rounded-xl'
    : 'w-6 h-6 rounded-lg';

  const iconSizeClasses = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  const colorClasses = error
    ? 'text-red-400 bg-red-500/10'
    : listening
    ? 'text-tertiary bg-tertiary/20 hover:bg-tertiary/30'
    : 'text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-high';

  return (
    <button
      onClick={handleClick}
      title={error ?? (listening ? 'Detener dictado' : 'Dictar por voz')}
      disabled={disabled}
      className={`flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${sizeClasses} ${colorClasses} ${className}`}
    >
      {listening ? (
        // Active: filled mic with pulse
        <svg viewBox="0 0 16 16" fill="currentColor" className={`${iconSizeClasses} animate-pulse`}>
          <rect x="5.5" y="1" width="5" height="9" rx="2.5" />
          <path d="M3 7.5a5 5 0 0 0 10 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        // Idle: outline mic
        <svg viewBox="0 0 16 16" fill="none" className={iconSizeClasses}>
          <rect x="5.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 7.5a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
};
