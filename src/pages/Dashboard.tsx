import React from 'react';
import { useDailySummary } from '../hooks/useDailySummary';
import { useSleep } from '../hooks/useSleep';
import { useActivities } from '../hooks/useActivities';
import { weeklyPlan } from '../data/mockData';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

const ActivityRing: React.FC<{ value: number; color: string; label: string; size?: number }> = ({
  value, color, label, size = 120,
}) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
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
      <span className="font-label text-label-sm text-on-surface-variant">{label}</span>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { data: summary, loading: summaryLoading } = useDailySummary();
  const { data: sleepData, loading: sleepLoading } = useSleep('daily');
  const { data: activities, loading: activitiesLoading } = useActivities('daily');

  const loading = summaryLoading || sleepLoading || activitiesLoading;

  // sleepData[0] = today's entry (backend returns 1 item for 'daily')
  const todaySleep = sleepData?.[0] ?? null;
  const sleepScoreValue = todaySleep?.score ?? 0;
  const sleepHoursValue = todaySleep?.hours
    ? `${Math.floor(todaySleep.hours)}h ${Math.round((todaySleep.hours % 1) * 60)}m`
    : '--';

  // Use null-safe fallbacks: null means no data (different from 0)
  const bodyBattery = summary?.bodyBattery ?? null;
  // When body battery unavailable (API 403), use sleep score as readiness proxy
  const readinessProxy = bodyBattery ?? summary?.sleepScore ?? null;
  const readinessScore = readinessProxy ?? 0;
  const batteryValue = readinessProxy ?? 0;
  const restingHRValue = summary?.restingHR ?? null;
  const stepsValue = summary?.steps != null ? `${(summary.steps / 1000).toFixed(1)}K` : '--';
  const caloriesValue = summary?.calories != null ? `${(summary.calories / 1000).toFixed(1)}K` : '--';

  const lastActivity = activities?.recentSession;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Hero Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Readiness Hero */}
        <div className="lg:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6 relative overflow-hidden">
          <p className="font-display text-xs text-on-surface-variant tracking-widest uppercase mb-4">OPTIMAL READINESS</p>
          <div className="flex items-end gap-4 lg:gap-6">
            <div>
              <p
                className="font-display text-on-surface font-bold leading-none"
                style={{ fontSize: '7rem', color: '#1a1a1a', WebkitTextStroke: '1px #484847', position: 'absolute', top: 20, left: 20, opacity: 0.4, zIndex: 0 }}
              >
                {readinessProxy ?? '—'}
              </p>
              <p className="font-display font-bold text-primary relative z-10 text-5xl lg:text-[5rem] leading-none">
                {readinessProxy ?? '—'}
              </p>
              <div className="mt-2">
                <p className="font-label text-label-sm text-on-surface-variant">FC REPOSO</p>
                <p className="font-label text-label-sm text-secondary">{restingHRValue != null ? `${restingHRValue} BPM` : '--'}</p>
              </div>
            </div>
            <div className="flex gap-3 relative z-10">
              <ActivityRing value={readinessScore} color="#f3ffca" label="READY" size={80} />
              <ActivityRing value={batteryValue} color="#6a9cff" label="BATTERY" size={80} />
              <ActivityRing value={sleepScoreValue} color="#22d3a5" label="SLEEP" size={80} />
            </div>
          </div>
          {/* Legend */}
          <div className="mt-4 space-y-1">
            {[
              { color: '#f3ffca', label: 'BODY BATTERY NVL' },
              { color: '#6a9cff', label: 'SLEEP IN HRS' },
              { color: '#ff7439', label: 'HRV STATUS BASELINE' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ background: l.color }}></div>
                <span className="font-label text-label-sm text-on-surface-variant">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Session */}
        <div className="lg:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">RECENT SESSION</p>
            <span className="font-label text-label-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded">● {lastActivity?.sport ?? 'WINGFOIL'}</span>
          </div>
          <div className="mb-4">
            <p className="font-display text-headline-lg text-on-surface font-bold tracking-tight">
              {lastActivity?.location ?? 'PUNTA DEL ESTE'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'DISTANCIA', value: `${lastActivity?.distance ?? 18.6} KM` },
              { label: 'VEL. MÁX', value: lastActivity?.speed ?? 'N/A' },
              { label: 'FC PROM', value: `${lastActivity?.hr ?? 142} BPM` },
              { label: 'DURACIÓN', value: lastActivity?.duration ? `${lastActivity.duration} MIN` : '95 MIN' },
            ].map((m) => (
              <div key={m.label} className="bg-surface-container rounded-xl p-3">
                <p className="font-label text-label-sm text-on-surface-variant">{m.label}</p>
                <p className="font-body text-on-surface font-semibold text-sm mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Plan */}
        <div className="lg:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">WEEKLY PLAN</p>
            <p className="font-label text-label-sm text-primary">{weeklyPlan.filter(i => i.completed).length}/{weeklyPlan.length} DÍAS</p>
          </div>
          <div className="space-y-2">
            {weeklyPlan.map((item) => (
              <div
                key={item.day}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  item.completed ? 'bg-surface-container' : 'bg-surface-container/40'
                }`}
              >
                <div className={`w-1 h-8 rounded-full ${
                  item.sport.includes('GYM') ? 'bg-tertiary' :
                  item.sport.includes('WING') ? 'bg-secondary' :
                  'bg-primary'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <p className={`font-display text-xs font-bold tracking-wide ${item.completed ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {item.sport}
                  </p>
                  <p className="font-label text-label-sm text-on-surface-variant truncate">{item.detail}</p>
                </div>
                <span className="font-label text-label-sm text-on-surface-variant">{item.day}</span>
                {item.completed && <div className="w-2 h-2 rounded-full bg-primary"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'PASOS HOY', value: stepsValue, sub: 'META DIARIA', color: '#f3ffca' },
          { label: 'CALORÍAS', value: caloriesValue, sub: 'META: 2.5K', color: '#ff7439' },
          { label: 'SUEÑO', value: sleepHoursValue, sub: sleepScoreValue ? `SCORE: ${sleepScoreValue}` : 'SIN DATOS', color: '#6a9cff' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-low rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">{stat.label}</p>
              <p className="font-display text-display-md font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="font-label text-label-sm text-on-surface-variant mt-1">{stat.sub}</p>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${stat.color}15` }}>
              <div className="w-10 h-10 rounded-full" style={{ background: `${stat.color}30` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
