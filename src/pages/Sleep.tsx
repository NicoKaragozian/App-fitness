import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSleep } from '../hooks/useSleep';
import { useHrv } from '../hooks/useHrv';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { weeklySleepData, monthlySleepData } from '../data/mockData';

type Period = 'weekly' | 'monthly';

const formatHours = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-outline-variant/20">
      <p className="font-label text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-body text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.name === 'HORAS' ? formatHours(p.value) : typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
        </p>
      ))}
    </div>
  );
};

const ConsistencyMatrix: React.FC = () => {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const weeks = 7;
  const matrix = Array.from({ length: weeks }, () =>
    Array.from({ length: 7 }, () => ({
      value: Math.random() > 0.25 ? Math.random() : 0,
    }))
  );

  const getColor = (val: number) => {
    if (val === 0) return '#1a1a1a';
    if (val < 0.3) return '#2a3a2a';
    if (val < 0.6) return '#3a5a3a';
    if (val < 0.8) return '#4a7a4a';
    return '#6aaa6a';
  };

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {days.map((d) => (
          <div key={d} className="w-8 text-center font-label text-label-sm text-on-surface-variant">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {matrix.map((week, wi) => (
          <div key={wi} className="flex gap-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className="w-8 h-8 rounded"
                style={{ background: getColor(cell.value) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

type SleepDataPoint = { day: string | number; hours: number; score: number; hrv: number };

export const Sleep: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const { data: sleepApiData, loading: sleepLoading } = useSleep(period);
  const { data: hrvApiData, loading: hrvLoading } = useHrv(period);

  const loading = sleepLoading || hrvLoading;

  const fallbackData: SleepDataPoint[] = period === 'weekly' ? weeklySleepData : monthlySleepData.slice(0, 30);
  const data: SleepDataPoint[] = sleepApiData?.length ? sleepApiData : fallbackData;
  const dayKey = 'day';

  const latestSleep = data[data.length - 1];
  const sleepScore = latestSleep?.score ?? 85;
  const sleepHours = latestSleep?.hours ? `${Math.floor(latestSleep.hours)}h ${Math.round((latestSleep.hours % 1) * 60)}m` : '7h 45m';
  const restingHR = 48;

  const nightlyHrv = hrvApiData?.nightlyAvg ?? 64;
  const hrvStatus = hrvApiData?.status ?? 'OPTIMAL';
  const hrvData = hrvApiData?.history?.length ? hrvApiData.history : data;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Hero Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
        {/* Big Hero */}
        <div className="md:col-span-5 bg-surface-low rounded-xl p-5 lg:p-6 relative overflow-hidden">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">ANÁLISIS DE ANOCHE</p>
          <h1 className="font-display font-bold text-on-surface uppercase text-3xl lg:text-[3.5rem] leading-tight lg:leading-none">
            OPTIMAL<br />RECOVERY
          </h1>
          <div className="flex items-center gap-4 lg:gap-6 mt-4">
            <div>
              <p className="font-display text-2xl lg:text-display-md font-bold text-on-surface">{sleepHours}</p>
              <p className="font-label text-label-sm text-on-surface-variant">DURACIÓN</p>
            </div>
            <div>
              <p className="font-display text-2xl lg:text-display-md font-bold text-primary">{sleepScore}%</p>
              <p className="font-label text-label-sm text-on-surface-variant">CALIDAD</p>
            </div>
            <div>
              <p className="font-display text-2xl lg:text-display-md font-bold text-secondary">{restingHR} <span className="text-lg">BPM</span></p>
              <p className="font-label text-label-sm text-on-surface-variant">FC REPOSO</p>
            </div>
          </div>
          <div className="absolute right-4 top-4 font-display font-bold text-on-surface-variant/10 text-6xl lg:text-[8rem] leading-none hidden md:block">
            {sleepScore}
          </div>
        </div>

        {/* Donut-style score */}
        <div className="md:col-span-3 bg-surface-low rounded-xl p-5 lg:p-6 flex flex-col items-center justify-center">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-4">SCORE</p>
          <div className="relative">
            <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={70} cy={70} r={55} fill="none" stroke="#262626" strokeWidth={12} />
              <circle
                cx={70} cy={70} r={55}
                fill="none" stroke="#22d3a5" strokeWidth={12}
                strokeDasharray={2 * Math.PI * 55}
                strokeDashoffset={2 * Math.PI * 55 * (1 - sleepScore / 100)}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px #22d3a566)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display font-bold text-on-surface text-4xl leading-none">{sleepScore}</p>
              <p className="font-label text-label-sm text-on-surface-variant">/ 100</p>
            </div>
          </div>
          <div className="mt-4 space-y-1 w-full">
            {[
              { label: 'REM', value: '22%', color: '#6a9cff' },
              { label: 'PROFUNDO', value: '18%', color: '#22d3a5' },
              { label: 'LIGERO', value: '52%', color: '#adaaaa' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }}></div>
                  <span className="font-label text-label-sm text-on-surface-variant">{s.label}</span>
                </div>
                <span className="font-body text-sm text-on-surface">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nightly HRV */}
        <div className="md:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">NIGHTLY HRV</p>
          <p className="font-display font-bold text-on-surface text-3xl lg:text-[3rem] leading-none">
            {nightlyHrv} <span className="text-lg text-on-surface-variant">ms</span>
          </p>
          <div className="flex gap-3 mt-1 mb-4">
            <span className="font-label text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">STATUS</span>
            <span className="font-label text-label-sm text-primary bg-primary/10 px-2 py-0.5 rounded">{hrvStatus}</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={hrvData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hrv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3a5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3a5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#adaaaa', fontSize: 9, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <Area type="monotone" dataKey="hrv" stroke="#22d3a5" strokeWidth={2} fill="url(#hrv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-2">
        {(['weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded font-label text-label-sm tracking-widest uppercase transition-all ${
              period === p
                ? 'bg-primary text-surface font-bold'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {p === 'weekly' ? 'SEMANAL' : 'MENSUAL'}
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Sleep Hours Chart */}
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">HORAS DE SUEÑO</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">EVOLUCIÓN {period === 'weekly' ? 'SEMANAL' : 'MENSUAL'}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sleepHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3a5" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22d3a5" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <XAxis dataKey={dayKey} tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" name="HORAS" fill="url(#sleepHours)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep Score Chart */}
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">PUNTAJE DE SUEÑO</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">EVOLUCIÓN {period === 'weekly' ? 'SEMANAL' : 'MENSUAL'}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sleepScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6a9cff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6a9cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey={dayKey} tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <YAxis domain={[50, 100]} tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" name="SCORE" stroke="#6a9cff" strokeWidth={2} fill="url(#sleepScore)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* HRV Evolution + Consistency Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">SLEEPING HRV</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">EVOLUCIÓN {period === 'weekly' ? 'SEMANAL' : 'MENSUAL'}</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3a5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3a5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey={dayKey} tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Lexend' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="hrv" name="HRV" stroke="#22d3a5" strokeWidth={2} fill="url(#hrvGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">CONSISTENCY MATRIX</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">REGULARIDAD DE SUEÑO</p>
          <ConsistencyMatrix />
        </div>
      </div>
    </div>
  );
};
