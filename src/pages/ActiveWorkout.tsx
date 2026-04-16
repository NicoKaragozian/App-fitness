import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWorkout, useLastValues } from '../hooks/useWorkout';
import { useTTS } from '../hooks/useTTS';
import type { TrainingSession, TrainingExercise } from '../hooks/useTrainingPlan';

const CATEGORY_LABELS: Record<string, string> = {
  warmup: 'Warm-up',
  main: 'Main',
  core: 'Core',
  cooldown: 'Cool-down',
  recovery: 'Recovery',
};

interface SetState {
  reps: string;
  weight: string;
  duration_seconds: string;
  distance_meters: string;
  completed: boolean;
  savedId: number | null;
}

function groupExercises(exercises: TrainingExercise[]) {
  const order = ['warmup', 'main', 'core', 'cooldown', 'recovery'];
  const groups: Record<string, TrainingExercise[]> = {};
  for (const ex of exercises) {
    const cat = ex.category ?? 'main';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ex);
  }
  // Unknown categories go at the end
  const allCats = [...new Set([...order, ...Object.keys(groups)])];
  return allCats.filter(k => groups[k]?.length > 0).map(k => ({ category: k, exercises: groups[k] }));
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
  const lastValues = useLastValues(session?.id ?? null);
  const timer = useTimer(!!workoutId);
  const { speak } = useTTS();

  // Flat ordered list of exercises for next-exercise announcements
  const allExercises = useMemo(
    () => groupExercises(session?.exercises ?? []).flatMap(g => g.exercises),
    [session?.exercises]
  );

  // sets[exerciseId][setIndex] = SetState
  const [sets, setSets] = useState<Record<number, SetState[]>>({});
  const [finishing, setFinishing] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  // Initialize sets based on target_sets (cardio defaults to 1 set, others to 3)
  useEffect(() => {
    if (!session) return;
    const initial: Record<number, SetState[]> = {};
    for (const ex of session.exercises) {
      const defaultSets = ex.type === 'cardio' ? 1 : 3;
      const count = ex.target_sets ?? defaultSets;
      const initDuration = ex.target_duration_seconds ? String(ex.target_duration_seconds) : '';
      const initDistance = ex.target_distance_meters ? String(ex.target_distance_meters) : '';
      initial[ex.id] = Array.from({ length: count }, () => ({
        reps: '',
        weight: '',
        duration_seconds: initDuration,
        distance_meters: initDistance,
        completed: false,
        savedId: null,
      }));
    }
    setSets(initial);
  }, [session]);

  // Auto-fill last values from previous workout
  useEffect(() => {
    if (Object.keys(lastValues).length === 0) return;
    setSets(prev => {
      const next = { ...prev };
      for (const [exIdStr, v] of Object.entries(lastValues)) {
        const exId = parseInt(exIdStr);
        if (next[exId]) {
          next[exId] = next[exId].map(s => s.completed ? s : {
            ...s,
            weight: v.weight != null && v.weight > 0 ? String(v.weight) : s.weight,
            duration_seconds: v.duration_seconds != null ? String(v.duration_seconds) : s.duration_seconds,
            distance_meters: v.distance_meters != null ? String(v.distance_meters) : s.distance_meters,
          });
        }
      }
      return next;
    });
  }, [lastValues]);

  const handleSetChange = useCallback((exId: number, setIdx: number, field: 'reps' | 'weight' | 'duration_seconds' | 'distance_meters', value: string) => {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
    }));
  }, []);

  const handleCompleteSet = useCallback(async (exId: number, setIdx: number) => {
    if (!workoutId) return;
    const set = sets[exId]?.[setIdx];
    if (!set) return;

    const toggling = set.completed;
    const reps = set.reps ? parseInt(set.reps) : null;
    const weight = set.weight ? parseFloat(set.weight) : null;
    const duration_seconds = set.duration_seconds ? parseInt(set.duration_seconds) : null;
    const distance_meters = set.distance_meters ? parseFloat(set.distance_meters) : null;

    const willFinishExercise = !toggling &&
      sets[exId].every((s, i) => i === setIdx ? true : s.completed);

    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, completed: !toggling } : s),
    }));

    // Announce next exercise when current one is fully completed
    if (willFinishExercise) {
      const idx = allExercises.findIndex(e => e.id === exId);
      const next = allExercises[idx + 1];
      if (next) {
        let target = '';
        if (next.type === 'cardio') {
          if (next.target_distance_meters) target = `. ${(next.target_distance_meters / 1000).toFixed(1)} km`;
          else if (next.target_duration_seconds) target = `. ${Math.round(next.target_duration_seconds / 60)} minutes`;
        } else if (next.type === 'timed') {
          target = next.target_duration_seconds
            ? `. ${next.target_sets ? `${next.target_sets} sets, ` : ''}${next.target_duration_seconds} seconds`
            : '';
        } else {
          target = next.target_sets && next.target_reps ? `. ${next.target_sets} sets of ${next.target_reps}` : '';
        }
        speak(`Next: ${next.name}${target}`);
      }
    }

    try {
      if (set.savedId != null) {
        await updateSet(set.savedId, reps, weight, !toggling, duration_seconds, distance_meters);
      } else if (!toggling) {
        const savedId = await logSet(workoutId, exId, setIdx + 1, reps, weight, duration_seconds, distance_meters);
        setSets(prev => ({
          ...prev,
          [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, savedId } : s),
        }));
      }
    } catch {
      setSets(prev => ({
        ...prev,
        [exId]: prev[exId].map((s, i) => i === setIdx ? { ...s, completed: toggling } : s),
      }));
    }
  }, [workoutId, sets, logSet, updateSet, allExercises, speak]);

  const handleAddSet = useCallback((exId: number) => {
    setSets(prev => ({
      ...prev,
      [exId]: [...(prev[exId] ?? []), { reps: '', weight: '', duration_seconds: '', distance_meters: '', completed: false, savedId: null }],
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
        Session data not available.{' '}
        <button onClick={() => navigate('/training')} className="text-primary underline">Go back</button>
      </div>
    );
  }

  const groups = groupExercises(session.exercises);

  return (
    <div className="min-h-screen flex flex-col bg-surface pb-28">
      {/* Fixed header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase line-clamp-1">{session.name}</p>
            <p className="font-display text-2xl text-primary tabular-nums">{timer}</p>
          </div>
          <div className="text-right">
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {completedSets}/{totalSets} sets
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

      {/* Content */}
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
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {ex.type === 'cardio' && (
                          <>
                            {ex.target_distance_meters ? `${(ex.target_distance_meters / 1000).toFixed(1)} km` : ''}
                            {ex.target_distance_meters && ex.target_duration_seconds ? ' · ' : ''}
                            {ex.target_duration_seconds ? `${Math.floor(ex.target_duration_seconds / 60)}min` : ''}
                            {ex.target_pace ? ` @ ${ex.target_pace}` : ''}
                          </>
                        )}
                        {ex.type === 'timed' && (
                          <>
                            {ex.target_sets ? `${ex.target_sets} × ` : ''}
                            {ex.target_duration_seconds ? `${ex.target_duration_seconds}s` : ''}
                          </>
                        )}
                        {(!ex.type || ex.type === 'strength') && (ex.target_sets || ex.target_reps) && (
                          <>{ex.target_sets ? `${ex.target_sets} × ` : ''}{ex.target_reps ?? ''}</>
                        )}
                        {ex.notes ? <span className="text-on-surface-variant/70"> · {ex.notes}</span> : null}
                      </p>
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
                        exerciseType={ex.type ?? 'strength'}
                        onChangeReps={v => handleSetChange(ex.id, si, 'reps', v)}
                        onChangeWeight={v => handleSetChange(ex.id, si, 'weight', v)}
                        onChangeDuration={v => handleSetChange(ex.id, si, 'duration_seconds', v)}
                        onChangeDistance={v => handleSetChange(ex.id, si, 'distance_meters', v)}
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

      {/* Fixed bottom bar */}
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
            {finishing ? 'Saving...' : `Finish Workout · ${completedSets} sets`}
          </button>
        </div>
      </div>

      {/* Confirm leave */}
      {showConfirmLeave && (
        <div className="fixed inset-0 bg-black/60 flex items-end lg:items-center justify-center z-50 p-4">
          <div className="bg-surface-low rounded-t-2xl lg:rounded-2xl w-full max-w-sm p-6 space-y-4">
            <p className="font-display text-on-surface text-lg">Leave workout?</p>
            <p className="text-on-surface-variant text-sm">Completed sets have been saved. Pending sets will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={handleFinish}
                className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-xl"
              >
                Finish and save
              </button>
              <button
                onClick={() => { navigate(planId ? `/training/${planId}` : '/training'); }}
                className="flex-1 bg-red-600/20 text-red-400 font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-xl"
              >
                Leave without saving
              </button>
            </div>
            <button
              onClick={() => setShowConfirmLeave(false)}
              className="w-full text-on-surface-variant text-sm py-1"
            >
              Cancel
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
  exerciseType: 'strength' | 'cardio' | 'timed';
  onChangeReps: (v: string) => void;
  onChangeWeight: (v: string) => void;
  onChangeDuration: (v: string) => void;
  onChangeDistance: (v: string) => void;
  onComplete: () => void;
}

const INPUT_CLASS = 'w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-center text-base font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed';
const LABEL_CLASS = 'font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1';

function SetRow({ setIndex, set, exerciseType, onChangeReps, onChangeWeight, onChangeDuration, onChangeDistance, onComplete }: SetRowProps) {
  const checkbox = (
    <button
      onClick={onComplete}
      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all active:scale-90 ${
        set.completed
          ? 'bg-primary border-primary text-surface'
          : 'border-outline-variant bg-transparent hover:border-primary/60'
      }`}
      title={set.completed ? 'Unmark set' : 'Mark set as completed'}
    >
      {set.completed && (
        <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-current stroke-2">
          <polyline points="1,5 4.5,8.5 11,1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );

  const setNum = (
    <span className="font-label text-label-sm text-on-surface-variant tracking-widest w-4 shrink-0 text-center">
      {setIndex + 1}
    </span>
  );

  if (exerciseType === 'cardio') {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${set.completed ? 'bg-primary/5' : ''}`}>
        {checkbox}
        {setNum}
        <div className="flex-1">
          <label className={LABEL_CLASS}>min</label>
          <input
            type="number"
            inputMode="numeric"
            value={set.duration_seconds ? String(Math.round(parseInt(set.duration_seconds) / 60)) : ''}
            onChange={e => onChangeDuration(e.target.value ? String(parseInt(e.target.value) * 60) : '')}
            disabled={set.completed}
            className={INPUT_CLASS}
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label className={LABEL_CLASS}>km</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={set.distance_meters ? String(parseFloat(set.distance_meters) / 1000) : ''}
            onChange={e => onChangeDistance(e.target.value ? String(parseFloat(e.target.value) * 1000) : '')}
            disabled={set.completed}
            className={INPUT_CLASS}
            placeholder="—"
          />
        </div>
      </div>
    );
  }

  if (exerciseType === 'timed') {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${set.completed ? 'bg-primary/5' : ''}`}>
        {checkbox}
        {setNum}
        <div className="flex-1">
          <label className={LABEL_CLASS}>seconds</label>
          <input
            type="number"
            inputMode="numeric"
            value={set.duration_seconds}
            onChange={e => onChangeDuration(e.target.value)}
            disabled={set.completed}
            className={INPUT_CLASS}
            placeholder="—"
          />
        </div>
      </div>
    );
  }

  // strength (default)
  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${set.completed ? 'bg-primary/5' : ''}`}>
      {checkbox}
      {setNum}
      <div className="flex-1">
        <label className={LABEL_CLASS}>kg</label>
        <input
          type="number"
          inputMode="decimal"
          value={set.weight}
          onChange={e => onChangeWeight(e.target.value)}
          disabled={set.completed}
          className={INPUT_CLASS}
          placeholder="—"
        />
      </div>
      <div className="flex-1">
        <label className={LABEL_CLASS}>reps</label>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={e => onChangeReps(e.target.value)}
          disabled={set.completed}
          className={INPUT_CLASS}
          placeholder="—"
        />
      </div>
    </div>
  );
}
