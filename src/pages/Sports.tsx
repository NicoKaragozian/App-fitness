import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useActivities } from '../hooks/useActivities';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { sportsData as mockSportsData, volumeHistoryMonthly } from '../data/mockData';

type Period = 'daily' | 'weekly' | 'monthly';

type SportData = {
  daily: Record<string, unknown>;
  weekly: Record<string, unknown>;
  monthly: Record<string, unknown>;
  weeklyHistory: Record<string, unknown>[];
};

const SportCard: React.FC<{
  title: string;
  subtitle: string;
  color: string;
  icon: string;
  period: Period;
  data: SportData;
  metrics: Array<{ label: string; key: string; unit: string }>;
}> = ({ title, subtitle, color, icon, period, data, metrics }) => {
  const periodData = data[period];
  return (
    <div className="bg-surface-low rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color }}>{icon}</span>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{subtitle}</p>
          </div>
          <h3 className="font-display text-headline-md text-on-surface font-bold tracking-tight">{title}</h3>
        </div>
        <div className="w-2 h-2 rounded-full mt-1" style={{ background: color, boxShadow: `0 0 8px ${color}` }}></div>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => {
          const value = (periodData as Record<string, unknown>)[m.key];
          if (value === undefined) return null;
          return (
            <div key={m.key} className="flex items-center justify-between">
              <span className="font-label text-label-sm text-on-surface-variant">{m.label}</span>
              <span className="font-display font-bold text-on-surface" style={{ color }}>
                {String(value)} <span className="text-on-surface-variant font-normal text-xs">{m.unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-outline-variant/20">
      <p className="font-label text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-body text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
        </p>
      ))}
    </div>
  );
};

export const Sports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const { data: activitiesData, loading } = useActivities(period);

  const sportsData = activitiesData?.sports ?? mockSportsData;
  const volumeHistory = activitiesData?.volumeHistory ?? volumeHistoryMonthly;
  const score = activitiesData?.trainingReadiness ?? 94;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header row */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">PRÁCTICA DEPORTIVA</p>
          <h1 className="font-display font-bold text-on-surface text-3xl lg:text-[3rem] leading-none">
            ANÁLISIS DE<br />DEPORTES
          </h1>
        </div>
        <div className="text-left md:text-right">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest mb-1">TRAINING READINESS</p>
          <p className="font-display font-bold text-primary text-4xl lg:text-[5rem] leading-none">{score}</p>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded font-label text-label-sm tracking-widest uppercase transition-all ${
              period === p
                ? 'bg-primary text-surface font-bold'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {p === 'daily' ? 'DIARIO' : p === 'weekly' ? 'SEMANAL' : 'MENSUAL'}
          </button>
        ))}
      </div>

      {/* Main Sports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SportCard
          title="WATER SPORTS"
          subtitle="WINGFOIL / SURF"
          color="#6a9cff"
          icon="◎"
          period={period}
          data={sportsData.waterSports as SportData}
          metrics={[
            { label: 'SESIONES', key: 'sessions', unit: '' },
            { label: 'DISTANCIA', key: 'distance', unit: 'KM' },
            { label: 'DURACIÓN', key: 'duration', unit: 'MIN' },
            { label: 'CALORÍAS', key: 'calories', unit: 'KCAL' },
          ]}
        />
        <SportCard
          title="TENNIS"
          subtitle="MATCH / TRAINING"
          color="#f3ffca"
          icon="◈"
          period={period}
          data={sportsData.tennis as SportData}
          metrics={[
            { label: 'SESIONES', key: 'sessions', unit: '' },
            { label: 'DURACIÓN', key: 'duration', unit: 'MIN' },
            { label: 'CALORÍAS', key: 'calories', unit: 'KCAL' },
          ]}
        />
        <SportCard
          title="GYM / STRENGTH"
          subtitle="FUERZA / POTENCIA"
          color="#ff7439"
          icon="⚡"
          period={period}
          data={sportsData.gym as SportData}
          metrics={[
            { label: 'SESIONES', key: 'sessions', unit: '' },
            { label: 'DURACIÓN', key: 'duration', unit: 'MIN' },
            { label: 'CALORÍAS', key: 'calories', unit: 'KCAL' },
            { label: 'VOLUMEN', key: 'volume', unit: 'KG' },
          ]}
        />
      </div>

      {/* Volume History Chart */}
      <div className="bg-surface-low rounded-xl p-4 lg:p-6">
        <p className="font-display text-headline-md font-bold text-on-surface tracking-tight mb-1 uppercase">COMPARATIVE VOLUME HISTORY</p>
        <p className="font-label text-label-sm text-on-surface-variant mb-6">EVOLUCIÓN MENSUAL POR DEPORTE</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={volumeHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6a9cff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6a9cff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTennis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f3ffca" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f3ffca" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGym" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff7439" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff7439" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontFamily: 'Lexend', fontSize: 11, color: '#adaaaa' }} />
            <Area type="monotone" dataKey="water" name="WATER" stroke="#6a9cff" strokeWidth={2} fill="url(#colorWater)" />
            <Area type="monotone" dataKey="tennis" name="TENNIS" stroke="#f3ffca" strokeWidth={2} fill="url(#colorTennis)" />
            <Area type="monotone" dataKey="gym" name="GYM" stroke="#ff7439" strokeWidth={2} fill="url(#colorGym)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Other Sports */}
      <div>
        <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-4">OTHER SPORTS</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sportsData.others.map((s) => (
            <div key={s.name} className="bg-surface-low rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-label text-label-sm text-on-surface-variant uppercase tracking-widest">{s.name}</p>
                <p className="font-display font-bold text-on-surface text-lg mt-0.5">{s.sessions} <span className="text-on-surface-variant text-xs font-normal">SESIONES</span></p>
                {'distance' in s && s.distance && <p className="font-label text-label-sm text-on-surface-variant">{s.distance} KM</p>}
                {'duration' in s && s.duration && <p className="font-label text-label-sm text-on-surface-variant">{s.duration} MIN</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
