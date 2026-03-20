import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useStress } from '../hooks/useStress';
import { useDailySummary } from '../hooks/useDailySummary';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import {
  weeklyStressData, monthlyStressData,
  weeklyStressAvg as mockWeeklyAvg, monthlyStressAvg as mockMonthlyAvg,
} from '../data/mockData';

type Period = 'weekly' | 'monthly';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-outline-variant/20">
      <p className="font-label text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-body text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const getStressLabel = (val: number) => {
  if (val < 26) return { label: 'LOW', color: '#22d3a5' };
  if (val < 51) return { label: 'OPTIMAL', color: '#f3ffca' };
  if (val < 76) return { label: 'ELEVATED', color: '#ff7439' };
  return { label: 'HIGH', color: '#ff4444' };
};

type StressDataPoint = { stress: number; day?: string; week?: string; date?: string };

export const Wellness: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const { data: stressApiData, loading: stressLoading } = useStress(period);
  const { data: summaryData, loading: summaryLoading } = useDailySummary();

  const loading = stressLoading || summaryLoading;

  const stressData: StressDataPoint[] = stressApiData?.data?.length
    ? stressApiData.data
    : (period === 'weekly' ? weeklyStressData : monthlyStressData);

  const weeklyStressAvg = stressApiData?.weeklyAvg ?? mockWeeklyAvg;
  const monthlyStressAvg = stressApiData?.monthlyAvg ?? mockMonthlyAvg;
  const bodyBattery = summaryData?.bodyBattery ?? 82;
  const weeklyLabel = getStressLabel(weeklyStressAvg);
  const monthlyLabel = getStressLabel(monthlyStressAvg);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">REAL-TIME NEUROLOGICAL TRACKING</p>
          <h1 className="font-display font-bold text-on-surface text-3xl lg:text-[4rem] leading-none">
            STRESS <span className="text-primary">LAB</span>
          </h1>
          <p className="font-body text-on-surface-variant text-sm mt-2 max-w-md">
            Tu respuesta biológica a demandas cognitivas y físicas analizada mediante procesos HRV.
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">BODY BATTERY</p>
          <p className="font-display font-bold text-secondary text-4xl lg:text-[5rem] leading-none">{bodyBattery}</p>
          <p className="font-label text-label-sm text-on-surface-variant">NIVEL ACTUAL</p>
        </div>
      </div>

      {/* Stress Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        <div className="bg-surface-low rounded-xl p-5">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">PROMEDIO SEMANAL</p>
          <div className="flex items-end gap-3">
            <p className="font-display font-bold text-3xl lg:text-[4rem] leading-none" style={{ color: weeklyLabel.color }}>
              {weeklyStressAvg}
            </p>
            <div className="mb-1 lg:mb-2">
              <p className="font-display text-sm font-bold tracking-widest" style={{ color: weeklyLabel.color }}>{weeklyLabel.label}</p>
              <p className="font-label text-label-sm text-on-surface-variant">ESTA SEMANA</p>
            </div>
          </div>
          <div className="mt-3 h-1 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${weeklyStressAvg}%`, background: weeklyLabel.color }}
            />
          </div>
          <p className="font-label text-label-sm text-on-surface-variant mt-1">&#8595; 4% from last week</p>
        </div>

        <div className="bg-surface-low rounded-xl p-5">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">PROMEDIO MENSUAL</p>
          <div className="flex items-end gap-3">
            <p className="font-display font-bold text-3xl lg:text-[4rem] leading-none" style={{ color: monthlyLabel.color }}>
              {monthlyStressAvg}
            </p>
            <div className="mb-1 lg:mb-2">
              <p className="font-display text-sm font-bold tracking-widest" style={{ color: monthlyLabel.color }}>{monthlyLabel.label}</p>
              <p className="font-label text-label-sm text-on-surface-variant">ESTE MES</p>
            </div>
          </div>
          <div className="mt-3 h-1 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${monthlyStressAvg}%`, background: monthlyLabel.color }}
            />
          </div>
          <p className="font-label text-label-sm text-on-surface-variant mt-1">&#8593; 2% from last month</p>
        </div>

        <div className="bg-surface-low rounded-xl p-5">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">DISTRIBUCIÓN</p>
          <div className="space-y-2 mt-2">
            {[
              { label: 'RELAJADO', pct: 35, color: '#22d3a5' },
              { label: 'BAJO', pct: 40, color: '#f3ffca' },
              { label: 'MEDIO', pct: 20, color: '#ff7439' },
              { label: 'ALTO', pct: 5, color: '#ff4444' },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between mb-0.5">
                  <span className="font-label text-label-sm text-on-surface-variant">{s.label}</span>
                  <span className="font-label text-label-sm" style={{ color: s.color }}>{s.pct}%</span>
                </div>
                <div className="h-1 bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
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

      {/* Stress Evolution Chart */}
      <div className="bg-surface-low rounded-xl p-4 lg:p-6">
        <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">STRESS EVOLUTION</p>
        <p className="font-label text-label-sm text-on-surface-variant mb-6">
          Evolución del estrés — Umbral óptimo marcado
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={stressData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f3ffca" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f3ffca" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey={period === 'weekly' ? 'day' : 'week'}
              tick={{ fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={25} stroke="#22d3a5" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'RELAJADO', fill: '#22d3a5', fontSize: 9, fontFamily: 'Lexend' }} />
            <ReferenceLine y={50} stroke="#f3ffca" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'ÓPTIMO', fill: '#f3ffca', fontSize: 9, fontFamily: 'Lexend' }} />
            <Area
              type="monotone"
              dataKey="stress"
              name="ESTRÉS"
              stroke="#f3ffca"
              strokeWidth={2}
              fill="url(#stressGrad)"
              dot={{ fill: '#f3ffca', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#f3ffca', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Momentum Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-4">MOMENTUM ANALYSIS</p>
          <div className="space-y-3">
            {[
              {
                icon: '▲',
                title: 'PEAK STRESS POINT',
                desc: 'Jueves mostró el mayor estrés durante el entrenamiento de fuerza',
                value: 41,
                color: '#ff7439',
              },
              {
                icon: '▼',
                title: 'HRV RECOVERY',
                desc: 'Sistema nervioso parasimpático activado durante el descanso activo',
                value: 12,
                color: '#6a9cff',
              },
            ].map((m) => (
              <div key={m.title} className="flex items-start gap-3 p-3 bg-surface-container rounded-xl">
                <span className="text-lg mt-0.5" style={{ color: m.color }}>{m.icon}</span>
                <div className="flex-1">
                  <p className="font-display text-xs font-bold tracking-widest text-on-surface">{m.title}</p>
                  <p className="font-label text-label-sm text-on-surface-variant mt-0.5">{m.desc}</p>
                </div>
                <p className="font-display font-bold text-lg" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-low rounded-xl p-4 lg:p-6 flex flex-col justify-between">
          <div>
            <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-2">RE-CENTER</p>
            <p className="font-label text-label-sm text-on-surface-variant mb-4">
              Tu nivel de estrés está dentro del rango óptimo. Mantén la rutina de recuperación.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
