import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout, useLastWeights } from '../hooks/useWorkout';
import type { TrainingSession, TrainingExercise } from '../hooks/useTrainingPlan';

const CATEGORY_LABELS: Record<string, string> = {
  warmup: 'Calentamiento',
  main: 'Principal',
  core: 'Core',
  cooldown: 'Vuelta a la calma',
};

interface SetState {
  reps: string;
  weight: string;
  completed: boolean;
  savedId: number | null;
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

function useTimer(started: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!started) return;
    ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [started]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ActiveWorkout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const workoutId = id ? parseInt(id) : null;
  const session = (location.state as any)?.session as TrainingSession | undefined;
  const planId = (location.state as any)?.planId as number | undefined;

  const { logSet, updateSet, finishWorkout } = useWorkout();
  const lastWeights = useLastWeights(session?.id ?? null);
  const timer = useTimer(!!workoutId);

  // sets[exerciseId][setIndex] = SetState
  const [sets, setSets] = useState<Record<number, SetState[]>>({});
  const [finishing, setFinishing] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  // Inicializar sets basándonos en target_sets
  useEffect(() => {
    if (!session) return;
    const initial: Record<number, SetState[]> = {};
    for (const ex of session.exercises) {
      const count = ex.target_sets ?? 3;
      initial[ex.id] = Array.from({ length: count }, () => ({
        reps: '',
        weight: '',
        completed: false,
        savedId: null,
      }));
    }
    setSets(initial);
  }, [session]);

  // Auto-fill pesos del último workout
  useEffect(() => {
    if (Object.keys(lastWeights).length === 0) return;
    setSets(prev => {
      const next = { ...prev };
      for (const [exIdStr, w] of Object.entries(lastWeights)) {
        const exId = parseInt(exIdStr);
        if (next[exId]) {
          next[exId] = next[exId].map(s => s.completed ? s : { ...s, weight: w > 0 ? String(w) : '' });
        }
      }
      return next;
    });
  }, [lastWeights]);

  const handleSetChange = useCallback((exId: number, setIdx: number, field: 'reps' | 'weight', value: string) => {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
    }));
  }, []);

  const handleCompleteSet = useCallback(async (exId: number, setIdx: number) => {
    if (!workoutId) return;
    const set = sets[exId]?.[setIdx];
    if (!set) return;

    const reps = set.reps ? parseInt(set.reps) : null;
    const weight = set.weight ? parseFloat(set.weight) : null;

    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, completed: true } : s),
    }));

    try {
      if (set.savedId != null) {
        await updateSet(set.savedId, reps, weight);
      } else {
        const savedId = await logSet(workoutId, exId, setIdx + 1, reps, weight);
        setSets(prev => ({
          ...prev,
          [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, savedId } : s),
        }));
      }
    } catch {
      // revert
      setSets(prev => ({
        ...prev,
        [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, completed: false } : s),
      }));
    }
  }, [workoutId, sets, logSet, updateSet]);

  const handleAddSet = useCallback((exId: number) => {
    setSets(prev => ({
      ...prev,
      [exId]: [...(prev[exId] ?? []), { reps: '', weight: '', completed: false, savedId: null }],
    }));
  }, []);

  const totalSets = Object.values(sets).reduce((sum, s) => sum + s.length, 0);
  const completedSets = Object.values(sets).reduce((sum, s) => sum + s.filter(x => x.completed).length, 0);

  const handleFinish = async () => {
    if (!workoutId) return;
    setFinishing(true);
    try {
      await finishWorkout(workoutId);
      navigate(planId ? `/training/${planId}` : '/training');
    } catch (err: any) {
      alert('Error finalizando workout: ' + err.message);
    } finally {
      setFinishing(false);
    }
  };

  if (!session) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        Datos de sesión no disponibles.{' '}
        <button onClick={() => navigate('/training')} className="text-primary underline">Volver</button>
      </div>
    );
  }

  const groups = groupExercises(session.exercises);

  return (
    <div className="min-h-screen flex flex-col bg-surface pb-28">
      {/* Header fijo */}
      <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase line-clamp-1">{session.name}</p>
            <p className="font-display text-2xl text-primary tabular-nums">{timer}</p>
          </div>
          <div className="text-right">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {completedSets}/{totalSets} series
            </p>
            <div className="w-24 h-1.5 bg-surface-container rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        {groups.map(({ category, exercises }) => (
          <div key={category} className="space-y-3">
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {CATEGORY_LABELS[category] ?? category}
            </span>
            {exercises.map(ex => {
              const exSets = sets[ex.id] ?? [];
              const allCompleted = exSets.length > 0 && exSets.every(s => s.completed);
              return (
                <div
                  key={ex.id}
                  className={`bg-surface-low rounded-xl overflow-hidden transition-all ${allCompleted ? 'opacity-70' : ''}`}
                >
                  {/* Exercise header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-outline-variant/10">
                    <div>
                      <p className={`font-medium text-sm ${allCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                        {ex.name}
                      </p>
                      {(ex.target_sets || ex.target_reps) && (
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Objetivo: {ex.target_sets ? `${ex.target_sets}×` : ''}{ex.target_reps ?? ''}
                          {ex.notes ? ` · ${ex.notes}` : ''}
                        </p>
                      )}
                    </div>
                    {allCompleted && <span className="text-primary text-lg">✓</span>}
                  </div>

                  {/* Sets */}
                  <div className="divide-y divide-outline-variant/10">
                    {exSets.map((set, si) => (
                      <SetRow
                        key={si}
                        setIndex={si}
                        set={set}
                        onChangeReps={v => handleSetChange(ex.id, si, 'reps', v)}
                        onChangeWeight={v => handleSetChange(ex.id, si, 'weight', v)}
                        onComplete={() => handleCompleteSet(ex.id, si)}
                      />
                    ))}
                  </div>

                  {/* Add set */}
                  <button
                    onClick={() => handleAddSet(ex.id)}
                    className="w-full px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors text-left"
                  >
                    + Serie
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom bar fijo */}
      <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 bg-surface border-t border-outline-variant/20 p-4 z-10">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={() => setShowConfirmLeave(true)}
            className="px-4 py-3 rounded-xl bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase hover:bg-surface-high transition-colors"
          >
            Salir
          </button>
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {finishing ? 'Guardando…' : `Finalizar Workout · ${completedSets} series`}
          </button>
        </div>
      </div>

      {/* Confirmar salir */}
      {showConfirmLeave && (
        <div className="fixed inset-0 bg-black/60 flex items-end lg:items-center justify-center z-50 p-4">
          <div className="bg-surface-low rounded-t-2xl lg:rounded-2xl w-full max-w-sm p-6 space-y-4">
            <p className="font-display text-on-surface text-lg">¿Salir del workout?</p>
            <p className="text-on-surface-variant text-sm">Las series ya completadas se guardaron. Las pendientes se perderán.</p>
            <div className="flex gap-3">
              <button
                onClick={handleFinish}
                className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-xl"
              >
                Finalizar y guardar
              </button>
              <button
                onClick={() => { navigate(planId ? `/training/${planId}` : '/training'); }}
                className="flex-1 bg-red-600/20 text-red-400 font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-xl"
              >
                Salir sin guardar
              </button>
            </div>
            <button
              onClick={() => setShowConfirmLeave(false)}
              className="w-full text-on-surface-variant text-sm py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface SetRowProps {
  setIndex: number;
  set: SetState;
  onChangeReps: (v: string) => void;
  onChangeWeight: (v: string) => void;
  onComplete: () => void;
}

function SetRow({ setIndex, set, onChangeReps, onChangeWeight, onComplete }: SetRowProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${set.completed ? 'bg-primary/5' : ''}`}>
      {/* Set number */}
      <span className="font-label text-label-sm text-on-surface-variant tracking-widest w-5 shrink-0 text-center">
        {setIndex + 1}
      </span>

      {/* Weight input */}
      <div className="flex-1">
        <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1">kg</label>
        <input
          type="number"
          inputMode="decimal"
          value={set.weight}
          onChange={e => onChangeWeight(e.target.value)}
          disabled={set.completed}
          className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-center text-base font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="—"
        />
      </div>

      {/* Reps input */}
      <div className="flex-1">
        <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1">reps</label>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={e => onChangeReps(e.target.value)}
          disabled={set.completed}
          className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-center text-base font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="—"
        />
      </div>

      {/* Complete button */}
      <button
        onClick={onComplete}
        disabled={set.completed}
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
          set.completed
            ? 'bg-primary text-surface'
            : 'bg-surface-container text-on-surface-variant hover:bg-primary/20 hover:text-primary active:scale-95'
        }`}
      >
        {set.completed ? '✓' : '○'}
      </button>
    </div>
  );
}
