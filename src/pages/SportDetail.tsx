import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useActivityDetail } from '../hooks/useActivityDetail';
import { useAuth } from '../context/AuthContext';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { DynamicChart } from '../components/DynamicChart';
import { SessionModal } from '../components/SessionModal';
import { AIInsightPanel } from '../components/AIInsightPanel';
import { mockGroupDetail } from '../data/mockData';
import type { GroupConfig } from '../hooks/useActivityDetail';

type Period = 'total' | 'daily' | 'weekly' | 'monthly';

const PERIOD_LABELS: Record<Period, string> = {
  total: 'TOTAL',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
};

const STATS_LABEL: Record<Period, string> = {
  total: 'TOTAL SUMMARY',
  daily: 'LAST DAY',
  weekly: 'LAST WEEK',
  monthly: 'LAST MONTH',
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

const FALLBACK_CONFIG: GroupConfig = {
  id: 'unknown',
  name: 'SPORT',
  subtitle: '',
  color: '#6a9cff',
  icon: '◎',
  metrics: ['sessions', 'duration', 'calories'],
  chartMetrics: [{ dataKey: 'duration', name: 'DURATION MIN', type: 'bar' }],
};

export const SportDetail: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const { isDemoMode } = useAuth();
  const cat = category ?? 'water_sports';
  const [period, setPeriod] = useState<Period>('total');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const { data: realData, loading } = useActivityDetail(cat, period);
  const mockDetail = mockGroupDetail[cat];
  const data = isDemoMode ? mockDetail : realData;

  if (loading && !isDemoMode) return <LoadingSkeleton />;
  if (!data) return (
    <div className="p-8">
      <Link to="/sports" className="text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase">
        ← BACK
      </Link>
      <p className="text-on-surface-variant mt-8">No data available.</p>
    </div>
  );

  const { activities, stats, personalBests } = data;
  const config: GroupConfig = data.group ?? mockGroupDetail[cat]?.group ?? FALLBACK_CONFIG;

  // Build per-session chart data from activities (chronological)
  const sessionChartData = [...activities].reverse().map((a) => ({
    id: a.id,
    date: a.date,
    distance: a.distance,
    maxSpeed: a.maxSpeed ?? 0,
    duration: a.duration,
    avgHr: a.avgHr ?? 0,
    calories: a.calories ?? 0,
  }));

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Back + Header */}
      <div>
        <Link to="/sports" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-label text-label-sm tracking-widest uppercase transition-colors mb-4">
          ← SPORTS
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl" style={{ color: config.color }}>{config.icon}</span>
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{config.subtitle}</p>
            <h1 className="font-display font-bold text-on-surface text-3xl lg:text-[3rem] leading-none">{config.name}</h1>
          </div>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        {(['total', 'daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded font-label text-label-sm tracking-widest uppercase transition-all ${
              period === p
                ? 'bg-primary text-surface font-bold'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">{STATS_LABEL[period]}</p>
        {stats.totalSessions === 0 && period !== 'total' ? (
          <p className="text-on-surface-variant font-label text-label-sm">No activities in this period.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="SESSIONS" value={stats.totalSessions} unit="" />
            <StatCard label="TOTAL DURATION" value={stats.totalDuration} unit="MIN" />
            {stats.totalDistance !== undefined && (
              <StatCard label="TOTAL DISTANCE" value={stats.totalDistance} unit="KM" />
            )}
            <StatCard label="TOTAL CALORIES" value={stats.totalCalories} unit="KCAL" />
            <StatCard label="AVG DURATION" value={stats.avgDuration} unit="MIN" />
            {stats.avgHr != null && (
              <StatCard label="AVG HR" value={stats.avgHr} unit="BPM" />
            )}
          </div>
        )}
      </div>

      {/* Personal Bests */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">PERSONAL BESTS</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {personalBests.longestSession && (
            <BestCard label="LONGEST SESSION" {...personalBests.longestSession} color={config.color} />
          )}
          {personalBests.longestDistance && (
            <BestCard label="LONGEST DISTANCE" {...personalBests.longestDistance} color={config.color} />
          )}
          {personalBests.highestSpeed && (
            <BestCard label="MAX SPEED" {...personalBests.highestSpeed} color={config.color} />
          )}
          {personalBests.mostCalories && (
            <BestCard label="MOST CALORIES" {...personalBests.mostCalories} color={config.color} />
          )}
        </div>
      </div>

      {/* AI Analysis */}
      <AIInsightPanel
        mode="sport"
        payload={{ groupId: cat, period }}
        title={`${config.name} ANALYSIS`}
        chatContext={`Analyze my progress in ${config.name}`}
      />

      {/* Session History Chart */}
      {sessionChartData.length > 0 && (
        <DynamicChart
          group={config}
          data={sessionChartData}
          period={period}
          onBarClick={(entry) => {
            if (entry.id) setSelectedActivityId(String(entry.id));
          }}
        />
      )}

      {/* Activity List */}
      <div>
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">INDIVIDUAL ACTIVITIES</p>
        <div className="space-y-2">
          {activities.map((a) => (
            <div
              key={a.id}
              className="bg-surface-low rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-1 cursor-pointer hover:bg-surface-container transition-colors"
              onClick={() => setSelectedActivityId(a.id)}
            >
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
      {/* Session detail modal */}
      {selectedActivityId && (
        <SessionModal
          activityId={selectedActivityId}
          groupColor={config.color}
          groupIcon={config.icon}
          onClose={() => setSelectedActivityId(null)}
        />
      )}
    </div>
  );
};
