import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSleep } from '../hooks/useSleep';
import { useHrv } from '../hooks/useHrv';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { AIInsightPanel } from '../components/AIInsightPanel';
import { weeklySleepData, monthlySleepData } from '../data/mockData';

type Period = 'weekly' | 'monthly';

export type SleepDataPoint = { day: string | number; date?: string; hours: number; score: number; hrv: number };

const getRecoveryStatus = (score: number, hrvStatus: string) => {
  let penalty = 0;
  if (hrvStatus === 'UNBALANCED' || hrvStatus === 'LOW') penalty = 15;
  const adjScore = score - penalty;

  if (adjScore >= 85) return { title: 'PEAK RECOVERY', subtitle: 'READY FOR HIGH PERFORMANCE' };
  if (adjScore >= 70) return { title: 'OPTIMAL RECOVERY', subtitle: 'BALANCED SYSTEM' };
  if (adjScore >= 50) return { title: 'MODERATE STRAIN', subtitle: 'RESIDUAL FATIGUE - MODERATE TRAINING' };
  return { title: 'HIGH STRAIN', subtitle: 'NERVOUS SYSTEM STRESSED - PRIORITIZE REST' };
};

const formatHours = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-outline-variant/20">
      <p className="font-label text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-body text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.name === 'HOURS' ? formatHours(p.value) : typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
        </p>
      ))}
    </div>
  );
};

const ConsistencyMatrix: React.FC<{ data: SleepDataPoint[] }> = ({ data }) => {
  const [selectedDay, setSelectedDay] = useState<{ dateStr: string; score: number } | null>(null);
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const weeks = 4;

  const mapDate = new Map(data.filter(d => d.date).map(d => [d.date, d]));
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const dayOfWeek = today.getDay(); // 0 represents Sunday
  // We want the columns to be Mon-Sun. So the grid always ends on the nearest future Sunday (or today if today is Sunday).
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  
  const cells = [];
  // 28 cells total = 4 weeks * 7 days.
  for (let i = 27 - daysToSunday; i >= -daysToSunday; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Format YYYY-MM-DD safely
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayDate = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayDate}`;
    
    const record = mapDate.get(dateStr);
    cells.push({
      dateStr,
      score: record ? record.score / 100 : 0,
      isFuture: i < 0
    });
  }

  const matrix = [];
  for (let i = 0; i < weeks; i++) {
    matrix.push(cells.slice(i * 7, i * 7 + 7));
  }

  const getColor = (val: number, isFuture: boolean) => {
    if (isFuture) return 'transparent'; // completely empty / invisible
    if (val === 0) return '#1a1a1a'; // no data (surface-container)
    if (val < 0.6) return '#ff7439'; // poor (Tertiary)
    if (val < 0.8) return 'rgba(34, 211, 165, 0.4)'; // moderate (mint green with opacity)
    return '#22d3a5'; // optimal (mint green)
  };
  
  const selectedRecord = selectedDay ? mapDate.get(selectedDay.dateStr) : null;

  return (
    <div className="w-full flex flex-col xl:flex-row gap-8 pb-2">
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-max mx-auto md:mx-0">
          <div className="flex gap-2 lg:gap-3 mb-3 pl-8 lg:pl-12">
            {days.map((d) => (
              <div key={d} className="w-8 lg:w-10 text-center font-label text-[10px] text-on-surface-variant tracking-widest">{d}</div>
            ))}
          </div>
          <div className="space-y-2 lg:space-y-3">
            {matrix.map((week, wi) => (
              <div key={wi} className="flex gap-2 lg:gap-3 items-center">
                <div className="w-8 lg:w-10 text-right pr-2 font-label text-[10px] bg-clip-text text-on-surface-variant opacity-60">
                  S{wi + 1}
                </div>
                {week.map((cell, di) => (
                  <div
                    key={di}
                    onClick={() => !cell.isFuture && setSelectedDay(cell)}
                    className={`w-8 h-8 lg:w-10 lg:h-10 rounded-md transition-all cursor-pointer border ${selectedDay?.dateStr === cell.dateStr ? 'border-primary shadow-[0_0_12px_rgba(243,255,202,0.4)] scale-110' : 'border-surface-container hover:scale-110'} ${cell.isFuture ? 'opacity-0 cursor-default' : ''}`}
                    style={{ background: getColor(cell.score, cell.isFuture) }}
                    title={cell.isFuture ? '' : `Date: ${cell.dateStr} | Score: ${Math.round(cell.score * 100)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Leyenda */}
        <div className="flex items-center gap-2 mt-8 pl-10">
          <span className="font-label text-[10px] tracking-widest text-on-surface-variant mr-1">SLEEP QUALITY</span>
          <div className="w-3 h-3 rounded-sm bg-[#1a1a1a]"></div> <span className="font-label text-[9px] text-on-surface-variant mr-2">N/A</span>
          <div className="w-3 h-3 rounded-sm bg-[#ff7439]"></div> <span className="font-label text-[9px] text-on-surface-variant mr-2">POOR</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 211, 165, 0.4)' }}></div> <span className="font-label text-[9px] text-on-surface-variant mr-2">FAIR</span>
          <div className="w-3 h-3 rounded-sm bg-[#22d3a5]"></div> <span className="font-label text-[9px] text-on-surface-variant">OPTIMAL</span>
        </div>
      </div>
      
      {/* Panel de Detalles */}
      <div className="w-full xl:w-64 bg-surface-container rounded-xl p-5 flex flex-col justify-center min-h-[160px]">
        {selectedRecord ? (
          <div className="animate-fade-in">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest mb-1">{selectedDay?.dateStr}</p>
            <p className="font-display font-bold text-3xl mb-4" style={{ color: getColor(selectedDay!.score, false) }}>{selectedRecord.score} <span className="text-sm text-on-surface-variant">/ 100</span></p>
            
            <div className="space-y-3">
              <div>
                <p className="font-label text-[10px] text-on-surface-variant">DURATION</p>
                <p className="font-body text-sm font-medium">{formatHours(selectedRecord.hours)}</p>
              </div>
              <div>
                <p className="font-label text-[10px] text-on-surface-variant">NIGHTLY HRV</p>
                <p className="font-body text-sm font-medium">{selectedRecord.hrv > 0 ? `${selectedRecord.hrv} ms` : 'No data'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center opacity-50">
            <p className="font-label text-label-sm text-on-surface-variant mb-2">SELECT A DAY</p>
            <p className="font-body text-xs">Click on any square in the matrix to see details for that night.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const Sleep: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const { data: sleepApiData, loading: sleepLoading } = useSleep(period);
  const { data: hrvApiData, loading: hrvLoading } = useHrv(period);
  
  // Always fetch monthly for the matrix, regardless of whether we're viewing period="weekly"
  const { data: monthlySleepApiData } = useSleep('monthly');

  const loading = sleepLoading || hrvLoading;

  const fallbackData: SleepDataPoint[] = period === 'weekly' ? weeklySleepData : monthlySleepData.slice(0, 30);
  const data: SleepDataPoint[] = sleepApiData?.length ? sleepApiData : fallbackData;
  const matrixData = monthlySleepApiData?.length ? monthlySleepApiData : monthlySleepData.slice(0, 30);
  const dayKey = 'day';

  const latestSleep = data[data.length - 1];
  const sleepScore = latestSleep?.score ?? 85;
  const sleepHours = latestSleep?.hours ? `${Math.floor(latestSleep.hours)}h ${Math.round((latestSleep.hours % 1) * 60)}m` : '7h 45m';
  const restingHR = 48;

  const nightlyHrv = hrvApiData?.nightlyAvg ?? 64;
  const hrvStatus = hrvApiData?.status ?? 'OPTIMAL';
  const hrvData = hrvApiData?.history?.length ? hrvApiData.history : data;
  
  const recovery = getRecoveryStatus(sleepScore, hrvStatus);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Hero Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
        {/* Big Hero */}
        <div className={`md:col-span-5 rounded-xl p-5 lg:p-6 relative overflow-hidden ${recovery.title === 'PEAK RECOVERY' ? 'bg-[#f3ffca] text-[#0e0e0e]' : 'bg-surface-low text-on-surface'}`}>
          <p className={`font-label text-label-sm tracking-widest uppercase mb-2 ${recovery.title === 'PEAK RECOVERY' ? 'text-[#0e0e0e]/70' : 'text-on-surface-variant'}`}>{recovery.subtitle}</p>
          <h1 className="font-display font-bold uppercase text-3xl lg:text-[3.5rem] leading-tight lg:leading-none">
            {recovery.title.split(' ')[0]}<br />{recovery.title.split(' ')[1]}
          </h1>
          <div className="flex items-center gap-4 lg:gap-6 mt-4">
            <div>
              <p className="font-display text-2xl lg:text-display-md font-bold text-on-surface">{sleepHours}</p>
              <p className="font-label text-label-sm text-on-surface-variant">DURATION</p>
            </div>
            <div>
              <p className="font-display text-2xl lg:text-display-md font-bold text-primary">{sleepScore}%</p>
              <p className="font-label text-label-sm text-on-surface-variant">QUALITY</p>
            </div>
            <div>
              <p className={`font-display text-2xl lg:text-display-md font-bold ${recovery.title === 'PEAK RECOVERY' ? 'text-[#0e0e0e]' : 'text-secondary'}`}>{restingHR} <span className="text-lg">BPM</span></p>
              <p className={`font-label text-label-sm ${recovery.title === 'PEAK RECOVERY' ? 'text-[#0e0e0e]/70' : 'text-on-surface-variant'}`}>RESTING HR</p>
            </div>
          </div>
          <div className={`absolute right-4 top-4 font-display font-bold text-6xl lg:text-[8rem] leading-none hidden md:block ${recovery.title === 'PEAK RECOVERY' ? 'text-[#0e0e0e]/10' : 'text-on-surface-variant/10'}`}>
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
              { label: 'DEEP', value: '18%', color: '#22d3a5' },
              { label: 'LIGHT', value: '52%', color: '#adaaaa' },
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

      {/* AI Analysis */}
      <AIInsightPanel
        mode="sleep"
        payload={{ period }}
        title="SLEEP ANALYSIS"
        chatContext="Analyze my sleep patterns"
      />

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
            {p === 'weekly' ? 'WEEKLY' : 'MONTHLY'}
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Sleep Hours Chart */}
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">SLEEP HOURS</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">{period === 'weekly' ? 'WEEKLY' : 'MONTHLY'} TREND</p>
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
              <Bar dataKey="hours" name="HOURS" fill="url(#sleepHours)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep Score Chart */}
        <div className="bg-surface-low rounded-xl p-4 lg:p-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">SLEEP SCORE</p>
          <p className="font-label text-label-sm text-on-surface-variant mb-4">{period === 'weekly' ? 'WEEKLY' : 'MONTHLY'} TREND</p>
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

      {/* Consistency Matrix (Enlarged and Full-Width) */}
      <div className="bg-surface-low rounded-xl p-4 lg:p-8">
        <div className="mb-6">
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-1">CONSISTENCY MATRIX</p>
          <p className="font-label text-label-sm text-on-surface-variant">SLEEP REGULARITY — 4 WEEK HISTORY</p>
        </div>
        <ConsistencyMatrix data={matrixData} />
      </div>
    </div>
  );
};
