import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useActivities } from '../hooks/useActivities';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { sportsData as mockSportsData, volumeHistoryMonthly, chartDataMock } from '../data/mockData';

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
  linkTo: string;
}> = ({ title, subtitle, color, icon, period, data, metrics, linkTo }) => {
  const periodData = data[period];
  return (
    <Link to={linkTo} className="block group">
      <div className="bg-surface-low rounded-xl p-5 transition-all hover:bg-surface-container cursor-pointer relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color }}>{icon}</span>
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{subtitle}</p>
            </div>
            <h3 className="font-display text-headline-md text-on-surface font-bold tracking-tight">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full mt-1" style={{ background: color, boxShadow: `0 0 8px ${color}` }}></div>
            <span className="text-on-surface-variant group-hover:text-on-surface transition-colors mt-0.5">›</span>
          </div>
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
    </Link>
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

const axisStyle = { fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' };

export const Sports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const { data: activitiesData, loading } = useActivities(period);

  const sportsData = activitiesData?.sports ?? mockSportsData;
  const score = activitiesData?.trainingReadiness ?? 94;
  const chartData = activitiesData?.chartData ?? chartDataMock;

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
          linkTo="/sports/water_sports"
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
          linkTo="/sports/tennis"
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
          linkTo="/sports/gym"
          metrics={[
            { label: 'SESIONES', key: 'sessions', unit: '' },
            { label: 'DURACIÓN', key: 'duration', unit: 'MIN' },
            { label: 'CALORÍAS', key: 'calories', unit: 'KCAL' },
            { label: 'VOLUMEN', key: 'volume', unit: 'KG' },
          ]}
        />
      </div>

      {/* Per-Sport Charts */}
      {/* Water Sports Chart */}
      {chartData.water_sports.length > 0 && (
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#6a9cff' }}>◎</span>
            <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase">WATER SPORTS</p>
          </div>
          <p className="font-label text-label-sm text-on-surface-variant mb-6">DISTANCIA (KM) Y VELOCIDAD MÁX (KM/H) POR SESIÓN</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData.water_sports} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="distance" name="DISTANCIA KM" fill="#6a9cff" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="maxSpeed" name="VEL. MÁX KM/H" stroke="#a8c4ff" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tennis Chart */}
      {chartData.tennis.length > 0 && (
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#f3ffca' }}>◈</span>
            <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase">TENNIS</p>
          </div>
          <p className="font-label text-label-sm text-on-surface-variant mb-6">DURACIÓN (MIN) Y FC PROMEDIO (BPM) POR SESIÓN</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData.tennis} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="duration" name="DURACIÓN MIN" fill="#f3ffca" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avgHr" name="FC PROM BPM" stroke="#c5d98a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gym Chart */}
      {chartData.gym.length > 0 && (
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#ff7439' }}>⚡</span>
            <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase">GYM / STRENGTH</p>
          </div>
          <p className="font-label text-label-sm text-on-surface-variant mb-6">CALORÍAS POR SESIÓN</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData.gym} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="calories" name="CALORÍAS KCAL" fill="#ff7439" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

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
