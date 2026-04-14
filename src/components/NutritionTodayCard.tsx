import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';

interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface MacroTargets {
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
}

function MiniBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(1, value / target) * 100 : 0;
  return (
    <div className="h-1 bg-surface-variant rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export const NutritionTodayCard: React.FC = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [totals, setTotals] = useState<MacroTotals | null>(null);
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ totals: MacroTotals; targets: MacroTargets; logs: any[] }>(`/nutrition/logs?date=${today}`)
      .then(data => {
        setTotals(data.totals);
        setTargets(data.targets);
        setLogCount(data.logs.length);
      })
      .catch(() => {}) // silent — module may not be active
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) {
    return <div className="h-24 bg-surface-container rounded-2xl animate-pulse" />;
  }

  if (!totals || !targets) return null;

  const macros = [
    { label: 'KCAL', value: totals.calories, target: targets.daily_calorie_target, color: '#f3ffca' },
    { label: 'PROT', value: totals.protein_g, target: targets.daily_protein_g, color: '#6a9cff' },
    { label: 'CARBS', value: totals.carbs_g, target: targets.daily_carbs_g, color: '#ff7439' },
    { label: 'FAT', value: totals.fat_g, target: targets.daily_fat_g, color: '#22d3a5' },
  ];

  return (
    <button
      onClick={() => navigate('/nutrition')}
      className="w-full bg-surface-low rounded-2xl p-4 text-left hover:bg-surface-container/40 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">◈</span>
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Nutrition today</p>
        </div>
        {logCount === 0 ? (
          <span className="font-label text-label-sm text-primary tracking-wider">+ Log meal</span>
        ) : (
          <span className="font-label text-label-sm text-on-surface-variant tracking-wider">{logCount} meal{logCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {logCount === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No meals logged</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {macros.map(({ label, value, target, color }) => (
            <div key={label}>
              <div className="flex items-baseline gap-0.5 mb-1">
                <span className="font-display text-sm font-bold text-on-surface">{value}</span>
                <span className="font-label text-[0.55rem] text-on-surface-variant">/{target}</span>
              </div>
              <MiniBar value={value} target={target} color={color} />
              <p className="font-label text-[0.55rem] text-on-surface-variant tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </button>
  );
};
