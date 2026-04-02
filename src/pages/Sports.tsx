import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivities } from '../hooks/useActivities';
import type { SportGroup } from '../hooks/useActivities';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { DynamicChart } from '../components/DynamicChart';
import { SportGroupEditor } from '../components/SportGroupEditor';
import { mockActivitiesData } from '../data/mockData';

type Period = 'daily' | 'weekly' | 'monthly';

const METRIC_DEFINITIONS: Record<string, { label: string; unit: string }> = {
  sessions:  { label: 'SESIONES',    unit: '' },
  distance:  { label: 'DISTANCIA',   unit: 'KM' },
  duration:  { label: 'DURACIÓN',    unit: 'MIN' },
  calories:  { label: 'CALORÍAS',    unit: 'KCAL' },
  avg_hr:    { label: 'FC PROMEDIO', unit: 'BPM' },
  max_speed: { label: 'VEL. MÁX',   unit: 'KM/H' },
};

const SportCard: React.FC<{ group: SportGroup; linkTo: string }> = ({ group, linkTo }) => (
  <Link to={linkTo} className="block group">
    <div className="bg-surface-low rounded-xl p-5 transition-all hover:bg-surface-container cursor-pointer relative">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: group.color }}>{group.icon}</span>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{group.subtitle}</p>
          </div>
          <h3 className="font-display text-headline-md text-on-surface font-bold tracking-tight">{group.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full mt-1" style={{ background: group.color, boxShadow: `0 0 8px ${group.color}` }} />
          <span className="text-on-surface-variant group-hover:text-on-surface transition-colors mt-0.5">›</span>
        </div>
      </div>
      <div className="space-y-2">
        {group.metrics.map((key) => {
          const def = METRIC_DEFINITIONS[key];
          if (!def) return null;
          const value = group.data[key];
          if (value === undefined || value === 0 && key !== 'sessions') return null;
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="font-label text-label-sm text-on-surface-variant">{def.label}</span>
              <span className="font-display font-bold text-on-surface" style={{ color: group.color }}>
                {value}{' '}
                {def.unit && <span className="text-on-surface-variant font-normal text-xs">{def.unit}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </Link>
);

export const Sports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('weekly');
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: activitiesData, loading } = useActivities(period);

  const groups = activitiesData?.groups ?? mockActivitiesData.groups;
  const others = activitiesData?.others ?? mockActivitiesData.others;
  const score = activitiesData?.trainingReadiness ?? mockActivitiesData.trainingReadiness;
  const chartData = activitiesData?.chartData ?? mockActivitiesData.chartData;

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
          <p className="font-display font-bold text-primary text-4xl lg:text-[5rem] leading-none">{score ?? '--'}</p>
        </div>
      </div>

      {/* Period Toggle + Settings */}
      <div className="flex items-center gap-2">
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
        <button
          onClick={() => setEditorOpen(true)}
          className="ml-auto p-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          title="Gestionar grupos"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
          </svg>
        </button>
      </div>

      {/* Dynamic Sport Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map((group) => (
          <SportCard key={group.id} group={group} linkTo={`/sports/${group.id}`} />
        ))}
      </div>

      {/* Dynamic Charts */}
      {groups.map((group) => (
        <DynamicChart
          key={group.id}
          group={group}
          data={(chartData as Record<string, any[]>)[group.id] ?? []}
        />
      ))}

      {/* Other Sports */}
      {others.length > 0 && (
        <div>
          <p className="font-display text-headline-md font-bold text-on-surface uppercase tracking-tight mb-4">OTHER SPORTS</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {others.map((s) => (
              <div key={s.name} className="bg-surface-low rounded-xl p-4">
                <p className="font-label text-label-sm text-on-surface-variant uppercase tracking-widest">{s.name}</p>
                <p className="font-display font-bold text-on-surface text-lg mt-0.5">
                  {s.sessions} <span className="text-on-surface-variant text-xs font-normal">SESIONES</span>
                </p>
                {s.distance != null && s.distance > 0 && (
                  <p className="font-label text-label-sm text-on-surface-variant">{s.distance} KM</p>
                )}
                {s.duration != null && s.duration > 0 && (
                  <p className="font-label text-label-sm text-on-surface-variant">{s.duration} MIN</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Editor Modal */}
      {editorOpen && <SportGroupEditor onClose={() => setEditorOpen(false)} />}
    </div>
  );
};
