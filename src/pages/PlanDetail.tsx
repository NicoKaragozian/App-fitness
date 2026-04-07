import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { useWorkout } from '../hooks/useWorkout';
import { useExerciseHistory } from '../hooks/useExerciseHistory';
import type { TrainingExercise, TrainingSession } from '../hooks/useTrainingPlan';

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
                        <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
                          {hist.count}× completada
                        </span>
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
                            <div className="flex items-center gap-2">
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
                            {expandedHistory === ex.id && (
                              <ExerciseHistoryInline exerciseId={ex.id} />
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingExercise(ex.id); setEditFields({ name: ex.name, target_sets: ex.target_sets ?? undefined, target_reps: ex.target_reps ?? undefined, notes: ex.notes ?? undefined }); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant text-xs px-2 py-1 rounded hover:bg-surface-container"
                          >
                            editar
                          </button>
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
