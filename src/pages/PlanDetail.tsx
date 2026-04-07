import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { useWorkout } from '../hooks/useWorkout';
import { useExerciseHistory } from '../hooks/useExerciseHistory';
import { apiFetch } from '../api/client';
import type { TrainingExercise, TrainingSession, TrainingPlanDetail } from '../hooks/useTrainingPlan';

const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const CATEGORY_LABELS: Record<string, string> = {
  warmup: 'Calentamiento',
  main: 'Principal',
  core: 'Core',
  cooldown: 'Vuelta a la calma',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupExercises(exercises: TrainingExercise[]) {
  const order = ['warmup', 'main', 'core', 'cooldown'];
  const groups: Record<string, TrainingExercise[]> = {};
  for (const ex of exercises) {
    const cat = ex.category ?? 'main';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ex);
  }
  return order.filter(k => groups[k]?.length > 0).map(k => ({ category: k, exercises: groups[k] }));
}

export const PlanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = id ? parseInt(id) : null;
  const { plan, loading, updateExercise } = useTrainingPlan(planId);
  const { startWorkout, getWorkoutHistory } = useWorkout();
  const [sessionHistory, setSessionHistory] = useState<Record<number, { count: number; last: string | null }>>({});
  const [editingExercise, setEditingExercise] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Partial<TrainingExercise>>({});
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
  const [showAddToWeekly, setShowAddToWeekly] = useState(false);
  const [describingId, setDescribingId] = useState<number | null>(null);
  const [openSessionHistory, setOpenSessionHistory] = useState<Set<number>>(new Set());
  // Descripciones generadas en esta sesión (por si el componente no se re-fetchea)
  const [generatedDescs, setGeneratedDescs] = useState<Record<number, string>>({});
  // Qué ejercicios tienen la descripción abierta
  const [openDescs, setOpenDescs] = useState<Set<number>>(new Set());

  const handleDescribe = useCallback(async (ex: TrainingExercise) => {
    const hasDesc = generatedDescs[ex.id] ?? ex.description;

    // Si ya tiene descripción, solo toggle
    if (hasDesc) {
      setOpenDescs(prev => {
        const next = new Set(prev);
        if (next.has(ex.id)) next.delete(ex.id); else next.add(ex.id);
        return next;
      });
      return;
    }

    // Sin descripción: generar, guardar y abrir
    setDescribingId(ex.id);
    try {
      const data = await apiFetch<{ description: string }>(`/training/exercises/${ex.id}/describe`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setGeneratedDescs(prev => ({ ...prev, [ex.id]: data.description }));
      setOpenDescs(prev => new Set(prev).add(ex.id));
    } catch (err: any) {
      setGeneratedDescs(prev => ({ ...prev, [ex.id]: `Error: ${err.message}` }));
      setOpenDescs(prev => new Set(prev).add(ex.id));
    } finally {
      setDescribingId(null);
    }
  }, [generatedDescs]);

  useEffect(() => {
    if (!planId) return;
    getWorkoutHistory(planId).then(logs => {
      const stats: Record<number, { count: number; last: string | null }> = {};
      for (const log of logs) {
        if (!log.completed_at) continue;
        if (!stats[log.session_id]) stats[log.session_id] = { count: 0, last: null };
        stats[log.session_id].count++;
        if (!stats[log.session_id].last || log.completed_at > stats[log.session_id].last!) {
          stats[log.session_id].last = log.completed_at;
        }
      }
      setSessionHistory(stats);
    }).catch(() => {});
  }, [planId, getWorkoutHistory]);

  const handleStartWorkout = async (session: TrainingSession) => {
    if (!planId) return;
    try {
      const workoutId = await startWorkout(planId, session.id);
      navigate(`/training/workout/${workoutId}`, { state: { session, planId } });
    } catch (err: any) {
      alert('Error iniciando workout: ' + err.message);
    }
  };

  const handleSaveExercise = async (exerciseId: number) => {
    await updateExercise(exerciseId, editFields);
    setEditingExercise(null);
    setEditFields({});
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-surface-low rounded-xl p-5 animate-pulse h-24" />
        {[1, 2, 3].map(i => <div key={i} className="bg-surface-low rounded-xl p-5 animate-pulse h-48" />)}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        Plan no encontrado.{' '}
        <button onClick={() => navigate('/training')} className="text-primary underline">Volver</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-2xl mx-auto">

      {/* Back */}
      <button
        onClick={() => navigate('/training')}
        className="flex items-center gap-1 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
      >
        ← Planes
      </button>

      {/* Plan header */}
      <div className="bg-surface-low rounded-xl p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-label text-label-sm text-primary tracking-widest uppercase">Plan activo</span>
            <h1 className="font-display text-2xl text-on-surface mt-1">{plan.title}</h1>
          </div>
          <button
            onClick={() => setShowAddToWeekly(true)}
            className="shrink-0 bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase px-3 py-2 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors text-xs"
          >
            + Weekly Plan
          </button>
        </div>
        {plan.objective && (
          <p className="text-on-surface-variant text-sm">{plan.objective}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          {plan.frequency && (
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{plan.frequency}</span>
          )}
          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
            {plan.sessions.length} sesiones
          </span>
          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
            Creado {formatDate(plan.created_at)}
          </span>
        </div>
      </div>

      {/* Modal: agregar al weekly plan */}
      {showAddToWeekly && (
        <AddToWeeklyPlanModal
          plan={plan}
          onClose={() => setShowAddToWeekly(false)}
        />
      )}

      {/* Sesiones */}
      {plan.sessions.map((session) => {
        const hist = sessionHistory[session.id];
        const groups = groupExercises(session.exercises);

        return (
          <div key={session.id} className="bg-surface-low rounded-xl overflow-hidden">
            {/* Session header */}
            <div className="p-5 border-b border-outline-variant/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-on-surface text-lg">{session.name}</p>
                  {session.notes && (
                    <p className="text-on-surface-variant text-sm mt-1">{session.notes}</p>
                  )}
                  <div className="flex gap-3 mt-2">
                    {hist ? (
                      <>
                        <button
                          onClick={() => setOpenSessionHistory(prev => {
                            const next = new Set(prev);
                            if (next.has(session.id)) next.delete(session.id); else next.add(session.id);
                            return next;
                          })}
                          className="font-label text-label-sm text-primary tracking-widest uppercase hover:opacity-70 transition-opacity"
                        >
                          {hist.count}× completada {openSessionHistory.has(session.id) ? '▲' : '▼'}
                        </button>
                        {hist.last && (
                          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
                            Última: {formatDate(hist.last)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Sin completar</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleStartWorkout(session)}
                  className="shrink-0 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Empezar
                </button>
              </div>
            </div>

            {/* Historial de sesiones */}
            {openSessionHistory.has(session.id) && planId && (
              <SessionHistoryPanel sessionId={session.id} planId={planId} />
            )}

            {/* Ejercicios */}
            <div className="divide-y divide-outline-variant/10">
              {groups.map(({ category, exercises }) => (
                <div key={category}>
                  <div className="px-5 py-2 bg-surface-container/30">
                    <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  </div>
                  {exercises.map(ex => (
                    <div key={ex.id} className="px-5 py-3">
                      {editingExercise === ex.id ? (
                        <EditExerciseForm
                          exercise={ex}
                          fields={editFields}
                          onChange={setEditFields}
                          onSave={() => handleSaveExercise(ex.id)}
                          onCancel={() => { setEditingExercise(null); setEditFields({}); }}
                        />
                      ) : (
                        <div
                          className="flex items-start justify-between gap-3 cursor-pointer group"
                          onClick={() => setExpandedHistory(expandedHistory === ex.id ? null : ex.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-on-surface text-sm font-medium">{ex.name}</p>
                              {ex.target_sets && ex.target_reps && (
                                <span className="font-label text-[10px] text-primary tracking-widest uppercase bg-primary/10 px-2 py-0.5 rounded">
                                  {ex.target_sets} × {ex.target_reps}
                                </span>
                              )}
                            </div>
                            {ex.notes && (
                              <p className="text-on-surface-variant text-xs mt-0.5">{ex.notes}</p>
                            )}
                            {/* Descripción colapsable */}
                            {openDescs.has(ex.id) && (
                              <p className="text-on-surface-variant text-xs mt-1.5 leading-relaxed border-l-2 border-primary/30 pl-2">
                                {generatedDescs[ex.id] ?? ex.description}
                              </p>
                            )}
                            {expandedHistory === ex.id && (
                              <ExerciseHistoryInline exerciseId={ex.id} />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {/* Botón describir */}
                            <button
                              onClick={() => handleDescribe(ex)}
                              disabled={describingId === ex.id}
                              title="¿Cómo se hace este ejercicio?"
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${
                                openDescs.has(ex.id)
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                              } disabled:opacity-50`}
                            >
                              {describingId === ex.id ? (
                                <span className="w-3 h-3 border border-on-surface-variant/40 border-t-primary rounded-full animate-spin block" />
                              ) : '?'}
                            </button>
                            <button
                              onClick={() => { setEditingExercise(ex.id); setEditFields({ name: ex.name, target_sets: ex.target_sets ?? undefined, target_reps: ex.target_reps ?? undefined, notes: ex.notes ?? undefined }); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant text-xs px-2 py-1 rounded hover:bg-surface-container"
                            >
                              editar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface WorkoutSetDetail {
  id: number;
  set_number: number;
  reps: number | null;
  weight: number | null;
  completed: number;
  exercise_id: number;
  exercise_name: string | null;
}

interface WorkoutDetail {
  id: number;
  session_id: number;
  plan_id: number;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  sets: WorkoutSetDetail[];
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function SessionHistoryPanel({ sessionId, planId }: { sessionId: number; planId: number }) {
  const [logs, setLogs] = useState<WorkoutDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, WorkoutDetail>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingSet, setEditingSet] = useState<number | null>(null);
  const [editSetFields, setEditSetFields] = useState<{ reps: string; weight: string }>({ reps: '', weight: '' });

  useEffect(() => {
    apiFetch<WorkoutDetail[]>(`/training/workouts?planId=${planId}&sessionId=${sessionId}`)
      .then(data => {
        setLogs(data.filter(l => l.completed_at).sort((a, b) =>
          new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, planId]);

  const loadDetail = useCallback(async (workoutId: number) => {
    if (details[workoutId]) return;
    const data = await apiFetch<WorkoutDetail>(`/training/workouts/${workoutId}`);
    setDetails(prev => ({ ...prev, [workoutId]: data }));
  }, [details]);

  const handleToggleExpand = async (workoutId: number) => {
    if (expandedId === workoutId) { setExpandedId(null); return; }
    setExpandedId(workoutId);
    await loadDetail(workoutId);
  };

  const handleDeleteWorkout = async (workoutId: number) => {
    if (!window.confirm('¿Eliminar esta sesión del historial? Se borrarán todos sus sets.')) return;
    setDeletingId(workoutId);
    try {
      await apiFetch(`/training/workouts/${workoutId}`, { method: 'DELETE' });
      setLogs(prev => prev.filter(l => l.id !== workoutId));
      if (expandedId === workoutId) setExpandedId(null);
    } catch (err: any) {
      alert('Error eliminando: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSet = (set: WorkoutSetDetail) => {
    setEditingSet(set.id);
    setEditSetFields({
      reps: set.reps != null ? String(set.reps) : '',
      weight: set.weight != null ? String(set.weight) : '',
    });
  };

  const handleSaveSet = async (setId: number, workoutId: number) => {
    try {
      await apiFetch(`/training/sets/${setId}`, {
        method: 'PUT',
        body: JSON.stringify({
          reps: editSetFields.reps !== '' ? parseInt(editSetFields.reps) : null,
          weight: editSetFields.weight !== '' ? parseFloat(editSetFields.weight) : null,
        }),
      });
      setDetails(prev => {
        const d = prev[workoutId];
        if (!d) return prev;
        return {
          ...prev,
          [workoutId]: {
            ...d,
            sets: d.sets.map(s => s.id === setId ? {
              ...s,
              reps: editSetFields.reps !== '' ? parseInt(editSetFields.reps) : null,
              weight: editSetFields.weight !== '' ? parseFloat(editSetFields.weight) : null,
            } : s),
          },
        };
      });
    } catch (err: any) {
      alert('Error guardando: ' + err.message);
    }
    setEditingSet(null);
  };

  const handleDeleteSet = async (setId: number, workoutId: number) => {
    try {
      await apiFetch(`/training/sets/${setId}`, { method: 'DELETE' });
      setDetails(prev => {
        const d = prev[workoutId];
        if (!d) return prev;
        return { ...prev, [workoutId]: { ...d, sets: d.sets.filter(s => s.id !== setId) } };
      });
    } catch (err: any) {
      alert('Error eliminando set: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="px-5 py-3 border-t border-outline-variant/20 animate-pulse">
        <div className="h-4 bg-surface-container rounded w-32" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="px-5 py-3 border-t border-outline-variant/20">
        <p className="text-on-surface-variant text-xs">Sin sesiones completadas</p>
      </div>
    );
  }

  return (
    <div className="border-t border-outline-variant/20 divide-y divide-outline-variant/10">
      {logs.map(log => {
        const isExpanded = expandedId === log.id;
        const detail = details[log.id];
        const duration = formatDuration(log.started_at, log.completed_at);

        // Agrupar sets por ejercicio
        const setsByExercise: Record<string, { name: string; sets: WorkoutSetDetail[] }> = {};
        if (detail) {
          for (const s of detail.sets) {
            const key = String(s.exercise_id);
            if (!setsByExercise[key]) setsByExercise[key] = { name: s.exercise_name ?? 'Ejercicio', sets: [] };
            setsByExercise[key].sets.push(s);
          }
        }

        return (
          <div key={log.id} className="bg-surface-container/20">
            {/* Fila del workout */}
            <div className="flex items-center gap-3 px-5 py-2.5">
              <button
                onClick={() => handleToggleExpand(log.id)}
                className="flex-1 flex items-center gap-3 text-left"
              >
                <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant">
                  {isExpanded ? '▲' : '▼'}
                </span>
                <span className="text-on-surface text-xs font-medium">
                  {new Date(log.completed_at!).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {duration && (
                  <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant">{duration}</span>
                )}
              </button>
              <button
                onClick={() => handleDeleteWorkout(log.id)}
                disabled={deletingId === log.id}
                className="text-on-surface-variant hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-surface-container disabled:opacity-40"
                title="Eliminar esta sesión"
              >
                {deletingId === log.id ? '…' : '✕'}
              </button>
            </div>

            {/* Sets expandidos */}
            {isExpanded && (
              <div className="px-5 pb-3 space-y-3">
                {!detail ? (
                  <p className="text-on-surface-variant text-xs animate-pulse">Cargando…</p>
                ) : Object.keys(setsByExercise).length === 0 ? (
                  <p className="text-on-surface-variant text-xs">Sin sets registrados</p>
                ) : (
                  Object.values(setsByExercise).map(({ name, sets }) => (
                    <div key={name}>
                      <p className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant mb-1.5">{name}</p>
                      <div className="space-y-1">
                        {sets.map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            {editingSet === s.id ? (
                              <>
                                <span className="font-label text-[10px] text-on-surface-variant w-8">S{s.set_number}</span>
                                <input
                                  type="number"
                                  value={editSetFields.reps}
                                  onChange={e => setEditSetFields(f => ({ ...f, reps: e.target.value }))}
                                  placeholder="reps"
                                  className="w-16 bg-surface-container rounded px-2 py-0.5 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-on-surface-variant text-xs">×</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editSetFields.weight}
                                  onChange={e => setEditSetFields(f => ({ ...f, weight: e.target.value }))}
                                  placeholder="kg"
                                  className="w-16 bg-surface-container rounded px-2 py-0.5 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  onClick={() => handleSaveSet(s.id, log.id)}
                                  className="text-primary text-xs font-label tracking-widest uppercase hover:opacity-70"
                                >ok</button>
                                <button
                                  onClick={() => setEditingSet(null)}
                                  className="text-on-surface-variant text-xs hover:opacity-70"
                                >✕</button>
                              </>
                            ) : (
                              <>
                                <span className="font-label text-[10px] text-on-surface-variant w-8">S{s.set_number}</span>
                                <span className="text-on-surface text-xs w-12">
                                  {s.reps != null ? `${s.reps} reps` : '-'}
                                </span>
                                <span className="text-on-surface-variant text-xs w-14">
                                  {s.weight != null && s.weight > 0 ? `${s.weight} kg` : '—'}
                                </span>
                                <button
                                  onClick={() => handleEditSet(s)}
                                  className="text-on-surface-variant text-[10px] hover:text-primary transition-colors px-1"
                                  title="Editar set"
                                >editar</button>
                                <button
                                  onClick={() => handleDeleteSet(s.id, log.id)}
                                  className="text-on-surface-variant text-[10px] hover:text-red-400 transition-colors px-1"
                                  title="Eliminar set"
                                >✕</button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                {log.notes && (
                  <p className="text-on-surface-variant text-xs border-l-2 border-outline-variant/30 pl-2 mt-2">{log.notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditExerciseForm({ exercise, fields, onChange, onSave, onCancel }: {
  exercise: TrainingExercise;
  fields: Partial<TrainingExercise>;
  onChange: (f: Partial<TrainingExercise>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      <input
        value={fields.name ?? exercise.name}
        onChange={e => onChange({ ...fields, name: e.target.value })}
        className="w-full bg-surface-container rounded px-3 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Nombre"
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={fields.target_sets ?? exercise.target_sets ?? ''}
          onChange={e => onChange({ ...fields, target_sets: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-20 bg-surface-container rounded px-3 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Series"
        />
        <input
          value={fields.target_reps ?? exercise.target_reps ?? ''}
          onChange={e => onChange({ ...fields, target_reps: e.target.value })}
          className="flex-1 bg-surface-container rounded px-3 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Reps (ej: 10-12, 30s)"
        />
      </div>
      <input
        value={fields.notes ?? exercise.notes ?? ''}
        onChange={e => onChange({ ...fields, notes: e.target.value })}
        className="w-full bg-surface-container rounded px-3 py-1.5 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Notas técnicas"
      />
      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 bg-primary text-surface font-label text-[10px] tracking-widest uppercase px-3 py-1.5 rounded">Guardar</button>
        <button onClick={onCancel} className="flex-1 bg-surface-container text-on-surface-variant font-label text-[10px] tracking-widest uppercase px-3 py-1.5 rounded">Cancelar</button>
      </div>
    </div>
  );
}

function AddToWeeklyPlanModal({ plan, onClose }: { plan: TrainingPlanDetail; onClose: () => void }) {
  // sessionId → day ('' = no agregar)
  const [assignments, setAssignments] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    plan.sessions.forEach((s, i) => {
      init[s.id] = DAYS[i % DAYS.length];
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleConfirm = async () => {
    const toAdd = plan.sessions.filter(s => assignments[s.id]);
    if (toAdd.length === 0) { onClose(); return; }
    setSaving(true);
    try {
      await Promise.all(toAdd.map(s =>
        apiFetch('/plan', {
          method: 'POST',
          body: JSON.stringify({
            day: assignments[s.id],
            sport: plan.title,
            detail: s.name,
            plan_id: plan.id,
            session_id: s.id,
          }),
        })
      ));
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err: any) {
      alert('Error guardando: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-low rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">Agregar al Weekly Plan</p>
          <p className="font-display text-lg text-on-surface mt-1">{plan.title}</p>
          <p className="text-on-surface-variant text-xs mt-1">Elegí qué día hacer cada sesión. Dejá vacío para no incluirla.</p>
        </div>

        <div className="space-y-3">
          {plan.sessions.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-on-surface text-sm truncate">{s.name}</p>
                {s.notes && <p className="text-on-surface-variant text-xs truncate">{s.notes}</p>}
              </div>
              <select
                value={assignments[s.id] ?? ''}
                onChange={e => setAssignments(prev => ({ ...prev, [s.id]: e.target.value }))}
                className="bg-surface-container text-on-surface font-label text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— no agregar</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:opacity-80"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || saved}
            className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60"
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseHistoryInline({ exerciseId }: { exerciseId: number }) {
  const { history, loading } = useExerciseHistory(exerciseId);

  if (loading) return <p className="text-on-surface-variant text-xs mt-2 animate-pulse">Cargando historial…</p>;
  if (history.length === 0) return <p className="text-on-surface-variant text-xs mt-2">Sin historial aún</p>;

  return (
    <div className="mt-2 space-y-1">
      {history.map((entry, i) => (
        <div key={i} className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="font-label tracking-widest">{entry.date}</span>
          <span>max {entry.maxWeight > 0 ? `${entry.maxWeight}kg` : '-'}</span>
          <span>{entry.totalReps} reps</span>
        </div>
      ))}
    </div>
  );
}
