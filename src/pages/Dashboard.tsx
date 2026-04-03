import React, { useState } from 'react';
import { useDailySummary } from '../hooks/useDailySummary';
import { useActivities } from '../hooks/useActivities';
import { usePlan, type PlanItem } from '../hooks/usePlan';
import { useInsights } from '../hooks/useInsights';
import { InsightsCard } from '../components/InsightsCard';
import { AIInsightPanel } from '../components/AIInsightPanel';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

const ActivityRing: React.FC<{ value: number; color: string; label: string; subLabel?: string | number; size?: number }> = ({
  value, color, label, subLabel, size = 120,
}) => {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  // Ensure value is between 0 and 100 for visual bounds
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (clampedValue / 100) * circumference;
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
      <div className="flex flex-col items-center">
        <span className="font-label text-label-sm text-on-surface-variant font-bold uppercase tracking-wider mt-1">{label}</span>
        {subLabel && <span className="font-display text-xs font-bold mt-0.5 opacity-90" style={{ color }}>{subLabel}</span>}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { data: summary, loading: summaryLoading } = useDailySummary();
  const { data: activities, loading: activitiesLoading } = useActivities('daily');
  const { data: weeklyPlan, loading: planLoading, addPlanItem, updatePlanItem, deletePlanItem } = usePlan();
  const { data: insights, loading: insightsLoading } = useInsights();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ sport: '', detail: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ day: 'LUN', sport: '', detail: '' });

  const loading = summaryLoading || activitiesLoading || planLoading;

  if (loading) return <LoadingSkeleton />;

  // Composite Readiness
  const rScore = summary?.readiness?.score ?? 0;
  const rTitle = summary?.readiness?.title ?? 'NO DATA';
  const stressInverse = summary?.readiness?.breakdown?.stressInverse ?? 0;
  const sleepScoreValue = summary?.readiness?.breakdown?.sleep ?? 0;
  const hrvScoreValue = summary?.readiness?.breakdown?.hrvScore ?? 0;
  const hrvRawValue = summary?.readiness?.breakdown?.hrvRaw ?? 0;

  // General Summary Metrics
  const restingHRValue = summary?.restingHR ?? null;
  const stepsValue = summary?.steps != null ? `${(summary.steps / 1000).toFixed(1)}K` : '--';
  const caloriesValue = summary?.calories != null ? `${(summary.calories / 1000).toFixed(1)}K` : '--';

  const recentSessions = activities?.recentSessions || [];

  const handleEditClick = (item: PlanItem) => {
    setEditingId(item.id);
    setEditForm({ sport: item.sport, detail: item.detail });
  };

  const saveEdit = (id: number) => {
    if (editForm.sport.trim()) {
      updatePlanItem(id, { sport: editForm.sport, detail: editForm.detail });
    }
    setEditingId(null);
  };

  const handleAddSubmit = () => {
    if (addForm.sport.trim()) {
      addPlanItem({ day: addForm.day, sport: addForm.sport, detail: addForm.detail });
      setAddForm({ day: 'LUN', sport: '', detail: '' });
      setIsAdding(false);
    }
  };

  const getReadinessColor = (score: number) => {
    if (score >= 85) return '#f3ffca'; // Prime
    if (score >= 70) return '#22d3a5'; // Optimal
    if (score >= 50) return '#6a9cff'; // Moderate
    return '#ff7439'; // High Strain
  };

  const heroColor = getReadinessColor(rScore);

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Insights */}
      <InsightsCard recommendations={insights?.recommendations ?? []} loading={insightsLoading} />

      {/* AI Daily Briefing */}
      <AIInsightPanel
        mode="daily"
        title="BRIEFING DEL DÍA"
        chatContext="Dame un resumen de cómo estoy hoy"
      />

      {/* Hero Row */}
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
              <ActivityRing value={rScore} color={heroColor} label="GLOBAL" subLabel={`${rScore}/100`} size={70} />
              <ActivityRing value={sleepScoreValue} color="#22d3a5" label="SLEEP" subLabel={sleepScoreValue > 0 ? `${sleepScoreValue}` : '--'} size={70} />
              <ActivityRing value={stressInverse} color="#f3ffca" label="RELAX" subLabel={stressInverse > 0 ? `${stressInverse}` : '--'} size={70} />
              <ActivityRing value={hrvScoreValue} color="#6a9cff" label="HRV" subLabel={hrvRawValue > 0 ? `${hrvRawValue}ms` : '--'} size={70} />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-6">
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">FC REPOSO</p>
              <p className="font-display font-semibold text-lg text-white mt-1">{restingHRValue ?? '--'} BPM</p>
            </div>
            <div className="w-px h-8 bg-surface-container"></div>
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">CALORÍAS</p>
              <p className="font-display font-semibold text-lg text-[#ff7439] mt-1">{caloriesValue}</p>
            </div>
            <div className="w-px h-8 bg-surface-container"></div>
            <div>
              <p className="font-label text-[10px] tracking-widest text-on-surface-variant uppercase">PASOS</p>
              <p className="font-display font-semibold text-lg text-[#f3ffca] mt-1">{stepsValue}</p>
            </div>
          </div>
        </div>

        {/* Metabolic / Physiological Map */}
        <div className="lg:col-span-3 bg-surface-low rounded-xl p-5 lg:p-6 flex flex-col">
          <div className="mb-6">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> PHYSIOLOGICAL MAP
            </p>
          </div>

          <div className="space-y-4 mb-6 flex-1">
            <p className="font-display text-sm tracking-widest text-on-surface-variant uppercase pb-2 border-b border-surface-container">ÚLTIMAS SESIONES</p>
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session, i) => (
                  <div key={i} className="flex flex-col bg-surface-container/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-display text-sm font-bold text-on-surface">{session.sport}</span>
                      <span className="font-label text-[10px] text-on-surface-variant bg-surface px-2 py-0.5 rounded">{session.date}</span>
                    </div>
                    <div className="flex gap-4 text-xs font-label text-on-surface-variant">
                      <span>{session.duration} MIN</span>
                      {session.hr > 0 && <span className="text-[#ff7439]">{session.hr} BPM</span>}
                      {session.distance > 0 && <span className="text-[#f3ffca]">{session.distance} KM</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant text-sm py-4">Sin sesiones recientes registradas.</p>
            )}
          </div>
          
          <div className="bg-surface-container rounded-xl p-4 flex justify-between items-center">
             <div>
                <p className="font-label text-[10px] uppercase text-on-surface-variant mb-1 tracking-widest">SUEÑO (HOY)</p>
                <p className="font-display font-bold text-lg text-[#22d3a5]">{sleepScoreValue > 0 ? `${sleepScoreValue} / 100` : '--'}</p>
             </div>
             <div className="text-right">
                <p className="font-label text-[10px] uppercase text-on-surface-variant mb-1 tracking-widest">RELAX (HOY)</p>
                <p className="font-display font-bold text-lg text-[#f3ffca]">{stressInverse > 0 ? `${stressInverse} / 100` : '--'}</p>             
             </div>
          </div>
        </div>

        {/* Weekly Plan */}
        <div className="lg:col-span-4 bg-surface-low rounded-xl p-5 lg:p-6 flex flex-col max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-surface-low pb-2 z-10">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">WEEKLY PLAN</p>
            <p className="font-label text-label-sm text-primary">{weeklyPlan.filter(i => i.completed).length}/{weeklyPlan.length} DÍAS</p>
          </div>
          
          <div className="space-y-3 flex-1 pb-4">
            {weeklyPlan.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors border ${
                  item.completed ? 'bg-surface-container border-transparent' : 'bg-surface border-surface-container'
                }`}
              >
                {/* Checkbox circle */}
                <button 
                  onClick={() => updatePlanItem(item.id, { completed: item.completed ? 0 : 1 })}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.completed ? 'bg-primary border-primary' : 'border-on-surface-variant'
                }`}>
                  {item.completed ? <div className="w-2 h-2 bg-black rounded-full"></div> : null}
                </button>
                
                <div className="flex-1 min-w-0" onDoubleClick={() => handleEditClick(item)}>
                  {editingId === item.id ? (
                    <div className="space-y-2">
                       <input 
                         type="text" 
                         value={editForm.sport}
                         onChange={e => setEditForm({...editForm, sport: e.target.value})}
                         className="w-full bg-surface-container-high text-on-surface font-display text-sm font-bold p-1 rounded outline-none border border-surface-variant focus:border-primary"
                         placeholder="Ej. GYM / FUERZA"
                         autoFocus
                       />
                       <input 
                         type="text" 
                         value={editForm.detail}
                         onChange={e => setEditForm({...editForm, detail: e.target.value})}
                         className="w-full bg-surface-container-high text-on-surface-variant font-label text-xs p-1 rounded outline-none border border-surface-variant focus:border-primary"
                         placeholder="Ej. Sesión piernas"
                       />
                       <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setEditingId(null)} className="text-[10px] text-on-surface-variant font-label px-2 py-1">CANCEL</button>
                          <button onClick={() => saveEdit(item.id)} className="text-[10px] text-black bg-primary rounded px-2 py-1 font-label font-bold">SAVE</button>
                       </div>
                    </div>
                  ) : (
                    <div className="cursor-pointer">
                      <p className={`font-display text-sm font-bold tracking-wide ${item.completed ? 'text-on-surface line-through opacity-50' : 'text-on-surface'}`}>
                        {item.sport}
                      </p>
                      {item.detail && <p className={`font-label text-xs text-on-surface-variant mt-0.5 ${item.completed ? 'line-through opacity-50' : ''}`}>{item.detail}</p>}
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

            {/* Add form */}
            {isAdding ? (
               <div className="bg-surface-container/50 border border-surface-variant p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                     <select 
                        value={addForm.day} 
                        onChange={e => setAddForm({...addForm, day: e.target.value})}
                        className="bg-surface text-[10px] text-on-surface font-label p-1 rounded outline-none border border-surface-variant"
                     >
                        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                  </div>
                  <input 
                    type="text" 
                    value={addForm.sport}
                    onChange={e => setAddForm({...addForm, sport: e.target.value})}
                    className="w-full bg-surface-container text-on-surface font-display text-sm font-bold p-1 rounded outline-none border border-surface-variant focus:border-primary mb-2"
                    placeholder="Título (Ej. NATACIÓN)"
                    autoFocus
                  />
                  <input 
                    type="text" 
                    value={addForm.detail}
                    onChange={e => setAddForm({...addForm, detail: e.target.value})}
                    className="w-full bg-surface-container text-on-surface-variant font-label text-xs p-1 rounded outline-none border border-surface-variant focus:border-primary mb-2"
                    placeholder="Detalles"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                     <button onClick={() => setIsAdding(false)} className="text-[10px] text-on-surface-variant font-label px-2 py-1">CANCEL</button>
                     <button onClick={handleAddSubmit} disabled={!addForm.sport.trim()} className="text-[10px] text-black bg-primary rounded px-2 py-1 font-label font-bold disabled:opacity-50">ADD</button>
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
    </div>
  );
};
