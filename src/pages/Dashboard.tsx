import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDailySummary } from '../hooks/useDailySummary';
import { useActivities } from '../hooks/useActivities';
import { usePlan, type PlanItem } from '../hooks/usePlan';
import { useInsights } from '../hooks/useInsights';
import { useSleep } from '../hooks/useSleep';
import { useHrv } from '../hooks/useHrv';
import { useStress } from '../hooks/useStress';
import { InsightsCard } from '../components/InsightsCard';
import { AIInsightPanel } from '../components/AIInsightPanel';
import { NutritionTodayCard } from '../components/NutritionTodayCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ActivityRing } from '../components/ui/ActivityRing';
import { apiFetch } from '../api/client';

// Day labels resolved via t() in component

function formatHours(h: number) {
  return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
}

function getStressColor(avg: number) {
  if (avg < 26) return '#22d3a5';
  if (avg < 51) return '#f3ffca';
  if (avg < 76) return '#ff7439';
  return '#ff4444';
}

// Stress labels resolved via t() in component

function getReadinessColor(score: number) {
  if (score >= 85) return '#f3ffca';
  if (score >= 70) return '#22d3a5';
  if (score >= 50) return '#6a9cff';
  return '#ff7439';
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const DAYS = [
    t('dashboard.dayLabels.MON'), t('dashboard.dayLabels.TUE'), t('dashboard.dayLabels.WED'),
    t('dashboard.dayLabels.THU'), t('dashboard.dayLabels.FRI'), t('dashboard.dayLabels.SAT'), t('dashboard.dayLabels.SUN'),
  ];

  const getStressLabel = (avg: number) => {
    if (avg < 26) return t('dashboard.stressLabels.LOW');
    if (avg < 51) return t('dashboard.stressLabels.OPTIMAL');
    if (avg < 76) return t('dashboard.stressLabels.ELEVATED');
    return t('dashboard.stressLabels.HIGH');
  };
  const { data: summary, loading: summaryLoading } = useDailySummary();
  const { data: activities, loading: activitiesLoading } = useActivities('daily');
  const { data: weeklyPlan, loading: planLoading, addPlanItem, updatePlanItem, deletePlanItem } = usePlan();
  const { data: insights, loading: insightsLoading } = useInsights();
  const { data: sleepData } = useSleep('weekly');
  const { data: hrvData } = useHrv('weekly');
  const { data: stressData } = useStress('weekly');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ day: 'MON', sport: '', detail: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ day: 'MON', sport: '', detail: '' });
  const [startingId, setStartingId] = useState<number | null>(null);

  const loading = summaryLoading || activitiesLoading || planLoading;
  if (loading) return <LoadingSkeleton />;

  // Readiness
  const rScore = summary?.readiness?.score ?? 0;
  const rTitle = summary?.readiness?.title ?? 'NO DATA';
  const stressInverse = summary?.readiness?.breakdown?.stressInverse ?? 0;
  const sleepScoreValue = summary?.readiness?.breakdown?.sleep ?? 0;
  const hrvScoreValue = summary?.readiness?.breakdown?.hrvScore ?? 0;
  const hrvRawValue = summary?.readiness?.breakdown?.hrvRaw ?? 0;
  const restingHRValue = summary?.restingHR ?? null;
  const stepsValue = summary?.steps != null ? `${(summary.steps / 1000).toFixed(1)}K` : '--';
  const caloriesValue = summary?.calories != null ? `${(summary.calories / 1000).toFixed(1)}K` : '--';
  const heroColor = getReadinessColor(rScore);

  // Quick stats
  const lastSleep = sleepData && sleepData.length > 0 ? sleepData[sleepData.length - 1] : null;
  const stressAvg = stressData?.weeklyAvg ?? 0;
  const stressColor = getStressColor(stressAvg);
  const hrvNightly = hrvData?.nightlyAvg ?? 0;
  const hrvStatus = hrvData?.status ?? '--';

  const recentSessions = activities?.recentSessions || [];

  const handleEditClick = (item: PlanItem) => {
    setEditingId(item.id);
    setEditForm({ day: item.day, sport: item.sport, detail: item.detail });
  };

  const saveEdit = (id: number) => {
    if (editForm.sport.trim()) {
      updatePlanItem(id, { day: editForm.day, sport: editForm.sport, detail: editForm.detail });
    }
    setEditingId(null);
  };

  const handleStartLinkedWorkout = async (item: PlanItem) => {
    if (!item.plan_id || !item.session_id) return;
    setStartingId(item.id);
    try {
      const plan = await apiFetch<{ id: number; sessions: Array<{ id: number; name: string; notes: string | null; exercises: any[] }> }>(`/training/plans/${item.plan_id}`);
      const session = plan.sessions.find(s => s.id === item.session_id);
      if (!session) throw new Error('Session not found');
      const result = await apiFetch<{ workoutId: number }>('/training/workouts', {
        method: 'POST',
        body: JSON.stringify({ planId: item.plan_id, sessionId: item.session_id }),
      });
      navigate(`/training/workout/${result.workoutId}`, { state: { session, planId: item.plan_id } });
    } catch (err: any) {
      alert('Error iniciando workout: ' + err.message);
      setStartingId(null);
    }
  };

  const handleAddSubmit = () => {
    if (addForm.sport.trim()) {
      addPlanItem({ day: addForm.day, sport: addForm.sport, detail: addForm.detail });
      setAddForm({ day: 'MON', sport: '', detail: '' });
      setIsAdding(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">

      {/* Hero Row: Readiness + Quick Stats + Weekly Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

        {/* Readiness Hero */}
        <div className="lg:col-span-5 bg-surface-low rounded-xl p-5 lg:p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="font-display text-xs text-on-surface-variant tracking-widest uppercase mb-6" style={{ color: heroColor }}>
              {rTitle}
            </p>
            <div className="flex items-end gap-6 mb-8 mt-2">
              <div className="relative">
                <p
                  className="font-display font-bold leading-none absolute"
                  style={{ fontSize: '8rem', color: 'transparent', WebkitTextStroke: '2px #262626', top: -30, left: -10, opacity: 0.8, zIndex: 0 }}
                >
                  {rScore > 0 ? rScore : '—'}
                </p>
                <p className="font-display font-bold relative z-10 text-6xl lg:text-[6rem] leading-none" style={{ color: heroColor }}>
                  {rScore > 0 ? rScore : '—'}
                </p>
              </div>
            </div>
            <div className="flex gap-4 relative z-10 justify-between mr-8">
              <ActivityRing value={rScore} color={heroColor} label={t('dashboard.rings.global')} subLabel={`${rScore}/100`} size={70} />
              <ActivityRing value={sleepScoreValue} color="#22d3a5" label={t('dashboard.rings.sleep')} subLabel={sleepScoreValue > 0 ? `${sleepScoreValue}` : '--'} size={70} />
              <ActivityRing value={stressInverse} color="#f3ffca" label={t('dashboard.rings.relax')} subLabel={stressInverse > 0 ? `${stressInverse}` : '--'} size={70} />
              <ActivityRing value={hrvScoreValue} color="#6a9cff" label={t('dashboard.rings.hrv')} subLabel={hrvRawValue > 0 ? `${hrvRawValue}ms` : '--'} size={70} />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-6">
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">{t('dashboard.restingHR')}</p>
              <p className="font-display font-semibold text-lg text-white mt-1">{restingHRValue ?? '--'} BPM</p>
            </div>
            <div className="w-px h-8 bg-surface-container"></div>
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">{t('dashboard.calories')}</p>
              <p className="font-display font-semibold text-lg text-[#ff7439] mt-1">{caloriesValue}</p>
            </div>
            <div className="w-px h-8 bg-surface-container"></div>
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">{t('dashboard.steps')}</p>
              <p className="font-display font-semibold text-lg text-[#f3ffca] mt-1">{stepsValue}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats Strip: Sleep / Stress / HRV */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Sleep tile */}
          <div className="flex-1 bg-surface-low rounded-xl p-4 flex flex-col justify-between">
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22d3a5]"></span> {t('dashboard.sleepLastNight')}
            </p>
            {lastSleep ? (
              <div>
                <p className="font-display font-bold text-2xl mt-2" style={{ color: '#22d3a5' }}>
                  {formatHours(lastSleep.hours)}
                </p>
                <p className="font-label text-[10px] text-on-surface-variant mt-1">
                  SCORE <span style={{ color: '#22d3a5' }}>{lastSleep.score > 0 ? lastSleep.score : '--'}</span> / 100
                </p>
              </div>
            ) : (
              <p className="font-display text-xl text-on-surface-variant mt-2">--</p>
            )}
          </div>

          {/* Stress tile */}
          <div className="flex-1 bg-surface-low rounded-xl p-4 flex flex-col justify-between">
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stressColor }}></span> {t('dashboard.stress7d')}
            </p>
            {stressAvg > 0 ? (
              <div>
                <p className="font-display font-bold text-2xl mt-2" style={{ color: stressColor }}>
                  {Math.round(stressAvg)}
                </p>
                <p className="font-label text-[10px] mt-1" style={{ color: stressColor }}>
                  {getStressLabel(stressAvg)}
                </p>
              </div>
            ) : (
              <p className="font-display text-xl text-on-surface-variant mt-2">--</p>
            )}
          </div>

          {/* HRV tile */}
          <div className="flex-1 bg-surface-low rounded-xl p-4 flex flex-col justify-between">
            <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> {t('dashboard.hrvNight')}
            </p>
            {hrvNightly > 0 ? (
              <div>
                <p className="font-display font-bold text-2xl mt-2 text-secondary">
                  {Math.round(hrvNightly)} <span className="text-sm font-label text-on-surface-variant">ms</span>
                </p>
                <p className="font-label text-[10px] text-on-surface-variant mt-1">
                  {hrvStatus}
                </p>
              </div>
            ) : (
              <p className="font-display text-xl text-on-surface-variant mt-2">--</p>
            )}
          </div>
        </div>

        {/* Weekly Plan */}
        <div className="lg:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6 flex flex-col max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-surface-low pb-2 z-10">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{t('dashboard.weeklyPlan')}</p>
            <p className="font-label text-label-sm text-primary">{weeklyPlan.filter(i => i.completed).length}/{weeklyPlan.length} {t('dashboard.days')}</p>
          </div>

          <div className="space-y-3 flex-1 pb-4">
            {weeklyPlan.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors border ${
                  item.completed ? 'bg-surface-container border-transparent' : 'bg-surface border-surface-container'
                }`}
              >
                <button
                  onClick={() => updatePlanItem(item.id, { completed: item.completed ? 0 : 1 })}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.completed ? 'bg-primary border-primary' : 'border-on-surface-variant'
                  }`}
                >
                  {item.completed ? <div className="w-2 h-2 bg-black rounded-full"></div> : null}
                </button>

                <div className="flex-1 min-w-0" onDoubleClick={() => handleEditClick(item)}>
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <select
                        value={editForm.day}
                        onChange={e => setEditForm({ ...editForm, day: e.target.value })}
                        className="bg-surface text-[10px] text-on-surface font-label p-1 rounded outline-none border border-surface-variant"
                      >
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input
                        type="text"
                        value={editForm.sport}
                        onChange={e => setEditForm({ ...editForm, sport: e.target.value })}
                        className="w-full bg-surface-container-high text-on-surface font-display text-sm font-bold p-1 rounded outline-none border border-surface-variant focus:border-primary"
                        placeholder="E.g. GYM / STRENGTH"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editForm.detail}
                        onChange={e => setEditForm({ ...editForm, detail: e.target.value })}
                        className="w-full bg-surface-container-high text-on-surface-variant font-label text-xs p-1 rounded outline-none border border-surface-variant focus:border-primary"
                        placeholder="E.g. Leg session"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setEditingId(null)} className="text-[10px] text-on-surface-variant font-label px-2 py-1">{t('common.cancel').toUpperCase()}</button>
                        <button onClick={() => saveEdit(item.id)} className="text-[10px] text-black bg-primary rounded px-2 py-1 font-label font-bold">{t('common.save').toUpperCase()}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cursor-pointer">
                      <p className={`font-display text-sm font-bold tracking-wide ${item.completed ? 'text-on-surface line-through opacity-50' : 'text-on-surface'}`}>
                        {item.sport}
                      </p>
                      {item.detail && <p className={`font-label text-xs text-on-surface-variant mt-0.5 ${item.completed ? 'line-through opacity-50' : ''}`}>{item.detail}</p>}
                      {item.plan_id && item.session_id && !item.completed && (
                        <button
                          onClick={e => { e.stopPropagation(); handleStartLinkedWorkout(item); }}
                          disabled={startingId === item.id}
                          className="mt-1.5 font-label text-[10px] tracking-widest uppercase text-primary hover:opacity-70 transition-opacity disabled:opacity-40"
                        >
                          {startingId === item.id ? t('dashboard.startingWorkout') : t('dashboard.startWorkout')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="font-label text-[10px] text-on-surface-variant bg-surface px-2 py-1 rounded">{item.day}</span>
                  {!editingId && (
                    <button onClick={() => deletePlanItem(item.id)} className="text-on-surface-variant opacity-30 hover:opacity-100 hover:text-[#ff4444] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isAdding ? (
              <div className="bg-surface-container/50 border border-surface-variant p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={addForm.day}
                    onChange={e => setAddForm({ ...addForm, day: e.target.value })}
                    className="bg-surface text-[10px] text-on-surface font-label p-1 rounded outline-none border border-surface-variant"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <input
                  type="text"
                  value={addForm.sport}
                  onChange={e => setAddForm({ ...addForm, sport: e.target.value })}
                  className="w-full bg-surface-container text-on-surface font-display text-sm font-bold p-1 rounded outline-none border border-surface-variant focus:border-primary mb-2"
                  placeholder="Title (e.g. SWIMMING)"
                  autoFocus
                />
                <input
                  type="text"
                  value={addForm.detail}
                  onChange={e => setAddForm({ ...addForm, detail: e.target.value })}
                  className="w-full bg-surface-container text-on-surface-variant font-label text-xs p-1 rounded outline-none border border-surface-variant focus:border-primary mb-2"
                  placeholder="Details"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsAdding(false)} className="text-[10px] text-on-surface-variant font-label px-2 py-1">{t('common.cancel').toUpperCase()}</button>
                  <button onClick={handleAddSubmit} disabled={!addForm.sport.trim()} className="text-[10px] text-black bg-primary rounded px-2 py-1 font-label font-bold disabled:opacity-50">{t('common.add').toUpperCase()}</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-3 mt-4 border border-dashed border-surface-variant rounded-xl text-on-surface-variant font-label text-[10px] tracking-widest hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <span>+ ADD SCHEDULE</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* AI Daily Briefing */}
      <AIInsightPanel
        mode="daily"
        title="DAILY BRIEFING"
        chatContext="Give me a summary of how I'm doing today"
      />

      {/* Today's nutrition */}
      <NutritionTodayCard />

      {/* Latest Sessions — horizontal scroll */}
      {recentSessions.length > 0 && (
        <div>
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span> RECENT SESSIONS
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {recentSessions.map((session, i) => (
              <div key={i} className="min-w-[180px] snap-start bg-surface-low rounded-xl p-4 flex flex-col gap-2 flex-shrink-0">
                <p className="font-display text-sm font-bold text-on-surface">{session.sport}</p>
                <p className="font-label text-[10px] text-on-surface-variant bg-surface px-2 py-0.5 rounded w-fit">{session.date}</p>
                <div className="flex gap-3 text-xs font-label text-on-surface-variant mt-1">
                  <span>{session.duration} MIN</span>
                  {session.hr > 0 && <span className="text-tertiary">{session.hr} BPM</span>}
                  {session.distance > 0 && <span className="text-primary">{session.distance} KM</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <InsightsCard recommendations={insights?.recommendations ?? []} loading={insightsLoading} />

    </div>
  );
};
