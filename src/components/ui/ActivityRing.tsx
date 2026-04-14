import React from 'react';

export const ActivityRing: React.FC<{
  value: number;
  color: string;
  label: string;
  subLabel?: string | number;
  size?: number;
}> = ({ value, color, label, subLabel, size = 120 }) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (clampedValue / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#262626" strokeWidth={10}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}66)`, transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="font-label text-label-sm text-on-surface-variant font-bold uppercase tracking-wider mt-1">{label}</span>
        {subLabel && <span className="font-display text-xs font-bold mt-0.5 opacity-90" style={{ color }}>{subLabel}</span>}
      </div>
    </div>
  );
};
