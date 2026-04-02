import React from 'react';
import type { Recommendation } from '../hooks/useInsights';

const TYPE_CONFIG = {
  recovery: { color: '#ff7439', label: 'RECUPERACIÓN', icon: '◈' },
  training: { color: '#22d3a5', label: 'ENTRENAMIENTO', icon: '◆' },
  sleep: { color: '#6a9cff', label: 'SUEÑO', icon: '◉' },
  plan: { color: '#f3ffca', label: 'PLAN', icon: '◇' },
};

const PRIORITY_DOT = {
  high: 'bg-[#ff7439]',
  medium: 'bg-[#f3ffca]',
  low: 'bg-on-surface-variant',
};

const RecommendationItem: React.FC<{ rec: Recommendation }> = ({ rec }) => {
  const config = TYPE_CONFIG[rec.type];
  return (
    <div className="flex gap-3 p-4 bg-surface-container rounded-xl">
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <span className="text-lg leading-none" style={{ color: config.color }}>{config.icon}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[rec.priority]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-label text-[10px] tracking-widest uppercase" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
        <p className="font-display text-sm font-bold text-on-surface mb-1">{rec.title}</p>
        <p className="font-label text-xs text-on-surface-variant leading-relaxed">{rec.description}</p>
      </div>
    </div>
  );
};

interface InsightsCardProps {
  recommendations: Recommendation[];
  loading: boolean;
}

export const InsightsCard: React.FC<InsightsCardProps> = ({ recommendations, loading }) => {
  if (loading) {
    return (
      <div className="bg-surface-low rounded-xl p-5 lg:p-6 animate-pulse">
        <div className="h-3 bg-surface-container rounded w-24 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-surface-container rounded-xl" />
          <div className="h-16 bg-surface-container rounded-xl" />
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="bg-surface-low rounded-xl p-5 lg:p-6">
      <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        INSIGHTS
      </p>
      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <RecommendationItem key={i} rec={rec} />
        ))}
      </div>
    </div>
  );
};
