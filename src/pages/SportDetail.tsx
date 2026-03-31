import React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useActivityDetail } from '../hooks/useActivityDetail';
import { useAuth } from '../context/AuthContext';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { activityDetailMock, chartDataMock } from '../data/mockData';

type Category = 'water_sports' | 'tennis' | 'gym';

const SPORT_CONFIG: Record<Category, { title: string; subtitle: string; icon: string; color: string }> = {
  water_sports: { title: 'WATER SPORTS', subtitle: 'WINGFOIL / KITEBOARDING / SURF', icon: '◎', color: '#6a9cff' },
  tennis: { title: 'TENNIS', subtitle: 'MATCH / TRAINING', icon: '◈', color: '#f3ffca' },
  gym: { title: 'GYM / STRENGTH', subtitle: 'FUERZA / POTENCIA', icon: '⚡', color: '#ff7439' },
};

const axisStyle = { fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' };

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

function StatCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="bg-surface-low rounded-xl p-4">
      <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">{label}</p>
      <p className="font-display font-bold text-on-surface text-2xl">
        {value} <span className="text-on-surface-variant text-sm font-normal">{unit}</span>
      </p>
    </div>
  );
}

function BestCard({ label, value, unit, date, color }: { label: string; value: number; unit: string; date: string; color: string }) {
  return (
    <div className="bg-surface-low rounded-xl p-4">
      <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">{label}</p>
      <p className="font-display font-bold text-2xl" style={{ color }}>
        {value} <span className="text-sm font-normal" style={{ color: '#adaaaa' }}>{unit}</span>
      </p>
      <p className="font-label text-label-sm text-on-surface-variant mt-1">{date}</p>
    </div>
  );
}

export const SportDetail: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const { isDemoMode } = useAuth();
  const cat = (category ?? 'water_sports') as Category;
  const config = SPORT_CONFIG[cat] ?? SPORT_CONFIG.water_sports;

  const { data: realData, loading } = useActivityDetail(cat);
  const mockDetail = activityDetailMock[cat as keyof typeof activityDetailMock];
  const data = isDemoMode ? mockDetail : realData;
  const chartDataByCategory = isDemoMode ? chartDataMock : null;

  if (loading && !isDemoMode) return <LoadingSkeleton />;
  if (!data) return (
    <div className="p-8">
      <Link to="/sports" className="text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase">
        ← VOLVER
      </Link>
      <p className="text-on-surface-variant mt-8">Sin datos disponibles.</p>
    </div>
  );

  const { activities, stats, personalBests } = data;

  // Build chart data from activities for real mode (most recent 20, reversed for chronological)
  const sessionChartData = isDemoMode && chartDataByCategory
    ? chartDataByCategory[cat as keyof typeof chartDataByCategory]
    : [...activities].reverse().slice(-20);

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Back + Header */}
      <div>
        <Link to="/sports" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase transition-colors mb-4">
          ← DEPORTES
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl" style={{ color: config.color }}>{config.icon}</span>
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{config.subtitle}</p>
            <h1 className="font-display font-bold text-on-surface text-3xl lg:text-[3rem] leading-none">{config.title}</h1>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">RESUMEN TOTAL</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="SESIONES" value={stats.totalSessions} unit="" />
          <StatCard label="DURACIÓN TOTAL" value={stats.totalDuration} unit="MIN" />
          {stats.totalDistance !== undefined && (
            <StatCard label="DISTANCIA TOTAL" value={stats.totalDistance} unit="KM" />
          )}
          <StatCard label="CALORÍAS TOTAL" value={stats.totalCalories} unit="KCAL" />
          <StatCard label="DURACIÓN PROM." value={stats.avgDuration} unit="MIN" />
          {stats.avgHr != null && (
            <StatCard label="FC PROMEDIO" value={stats.avgHr} unit="BPM" />
          )}
        </div>
      </div>

      {/* Personal Bests */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">PERSONAL BESTS</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {personalBests.longestSession && (
            <BestCard label="SESIÓN MÁS LARGA" value={personalBests.longestSession.value} unit={personalBests.longestSession.unit} date={personalBests.longestSession.date} color={config.color} />
          )}
          {personalBests.longestDistance && (
            <BestCard label="MAYOR DISTANCIA" value={personalBests.longestDistance.value} unit={personalBests.longestDistance.unit} date={personalBests.longestDistance.date} color={config.color} />
          )}
          {personalBests.highestSpeed && (
            <BestCard label="VELOCIDAD MÁX" value={personalBests.highestSpeed.value} unit={personalBests.highestSpeed.unit} date={personalBests.highestSpeed.date} color={config.color} />
          )}
          {personalBests.mostCalories && (
            <BestCard label="MÁS CALORÍAS" value={personalBests.mostCalories.value} unit={personalBests.mostCalories.unit} date={personalBests.mostCalories.date} color={config.color} />
          )}
        </div>
      </div>

      {/* Expanded Chart */}
      <div className="bg-surface-low rounded-xl p-4 lg:p-6">
        <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase mb-1">HISTORIAL DE SESIONES</p>
        <p className="font-label text-label-sm text-on-surface-variant mb-6">
          {cat === 'water_sports' ? 'DISTANCIA (KM) Y VELOCIDAD MÁX (KM/H)' : cat === 'tennis' ? 'DURACIÓN (MIN) Y FC PROMEDIO (BPM)' : 'CALORÍAS POR SESIÓN'}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          {cat === 'water_sports' ? (
            <ComposedChart data={sessionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="distance" name="DISTANCIA KM" fill={config.color} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="maxSpeed" name="VEL. MÁX KM/H" stroke="#a8c4ff" strokeWidth={2} dot={{ fill: '#a8c4ff', r: 3 }} />
            </ComposedChart>
          ) : cat === 'tennis' ? (
            <ComposedChart data={sessionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="duration" name="DURACIÓN MIN" fill={config.color} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avgHr" name="FC PROM BPM" stroke="#c5d98a" strokeWidth={2} dot={{ fill: '#c5d98a', r: 3 }} />
            </ComposedChart>
          ) : (
            <ComposedChart data={sessionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="calories" name="CALORÍAS KCAL" fill={config.color} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Activity List */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">ACTIVIDADES INDIVIDUALES</p>
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="bg-surface-low rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <div className="w-24">
                <p className="font-label text-label-sm text-on-surface-variant">{a.date}</p>
                <p className="font-label text-label-sm text-on-surface uppercase">{a.sportType.replace(/_v\d+$/, '').replace(/_/g, ' ')}</p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="font-label text-on-surface-variant">
                  <span className="font-bold text-on-surface" style={{ color: config.color }}>{a.duration}</span> MIN
                </span>
                {a.distance > 0 && (
                  <span className="font-label text-on-surface-variant">
                    <span className="font-bold text-on-surface">{a.distance}</span> KM
                  </span>
                )}
                {a.maxSpeed != null && (
                  <span className="font-label text-on-surface-variant">
                    <span className="font-bold text-on-surface">{a.maxSpeed}</span> KM/H
                  </span>
                )}
                {a.avgHr != null && (
                  <span className="font-label text-on-surface-variant">
                    <span className="font-bold text-on-surface">{a.avgHr}</span> BPM
                  </span>
                )}
                {a.calories != null && (
                  <span className="font-label text-on-surface-variant">
                    <span className="font-bold text-on-surface">{a.calories}</span> KCAL
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
