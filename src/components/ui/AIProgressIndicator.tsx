import React from 'react';

interface AIProgressIndicatorProps {
  progress: number;
  phase: string;
  className?: string;
}

export default function AIProgressIndicator({ progress, phase, className = '' }: AIProgressIndicatorProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="font-label text-[10px] text-primary tracking-widest uppercase">
          {phase || 'Conectando...'}
        </p>
        <span className="font-label text-[10px] text-on-surface-variant tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="h-1 w-full bg-surface-high rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
