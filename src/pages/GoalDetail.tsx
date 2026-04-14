import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGoal } from '../hooks/useGoal';
import { TTSButton } from '../components/ui/TTSButton';
import type { GoalMilestone } from '../hooks/useGoal';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCountdown(targetDate: string): { label: string; urgent: boolean } {
  const target = new Date(targetDate + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Overdue', urgent: true };
  if (diffDays === 0) return { label: 'Today!', urgent: true };
  if (diffDays === 1) return { label: 'Tomorrow', urgent: false };
  if (diffDays < 14) return { label: `${diffDays} days`, urgent: diffDays < 7 };
  const weeks = Math.ceil(diffDays / 7);
  return { label: `${weeks} weeks`, urgent: false };
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  abandoned: 'ABANDONED',
};

export const GoalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goalId = id ? parseInt(id) : null;
  const { goal, loading, toggleMilestone, updateStatus } = useGoal(goalId);

  const hasTargetDate = goal?.target_date && goal.target_date !== '';
  const countdown = hasTargetDate ? formatCountdown(goal!.target_date) : null;

  const completedCount = goal?.milestones.filter(m => m.completed).length ?? 0;
  const totalCount = goal?.milestones.length ?? 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const prerequisites: string[] = useMemo(() => {
    if (!goal?.prerequisites) return [];
    try { return JSON.parse(goal.prerequisites); } catch { return []; }
  }, [goal?.prerequisites]);

  const commonMistakes: string[] = useMemo(() => {
    if (!goal?.common_mistakes) return [];
    try { return JSON.parse(goal.common_mistakes); } catch { return []; }
  }, [goal?.common_mistakes]);

  // Build TTS text for the full guide
  const planText = useMemo(() => {
    if (!goal) return '';
    const lines: string[] = [goal.title];
    if (goal.description) lines.push(goal.description);
    if (goal.estimated_timeline) lines.push(`Estimated time: ${goal.estimated_timeline}.`);
    if (prerequisites.length > 0) lines.push(`Prerequisites: ${prerequisites.join('. ')}.`);
    for (const m of goal.milestones) {
      const keyExercises: string[] = JSON.parse(m.workouts || '[]');
      const tips: string[] = JSON.parse(m.tips || '[]');
      lines.push(
        `Phase ${m.week_number}: ${m.title}.` +
        (m.description ? ` ${m.description}` : '') +
        (m.target ? ` Advancement criteria: ${m.target}.` : '') +
        (keyExercises.length > 0 ? ` Key exercises: ${keyExercises.join(', ')}.` : '') +
        (tips.length > 0 ? ` Tips: ${tips.join('. ')}.` : '')
      );
    }
    if (commonMistakes.length > 0) lines.push(`Common mistakes: ${commonMistakes.join('. ')}.`);
    return lines.join('\n');
  }, [goal, prerequisites, commonMistakes]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
        <div className="bg-surface-low rounded-xl p-5 animate-pulse h-32" />
        {[1, 2, 3].map(i => <div key={i} className="bg-surface-low rounded-xl p-5 animate-pulse h-24" />)}
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        Goal not found.{' '}
        <button onClick={() => navigate('/training?tab=goals')} className="text-primary underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-2xl mx-auto">

      {/* Back */}
      <button
        onClick={() => navigate('/training?tab=goals')}
        className="flex items-center gap-1 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
      >
        ← Goals
      </button>

      {/* Goal header */}
      <div className="bg-surface-low rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-label text-label-sm text-primary tracking-widest uppercase">Progression Guide</span>
              {goal.status !== 'active' && (
                <span className={`font-label text-[10px] tracking-widest uppercase px-2 py-0.5 rounded ${
                  goal.status === 'completed' ? 'text-green-400 bg-green-400/10' : 'text-on-surface-variant bg-surface-container'
                }`}>
                  {STATUS_LABELS[goal.status]}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl text-on-surface">{goal.title}</h1>
          </div>
          <TTSButton text={planText} className="shrink-0 mt-1" />
        </div>

        {goal.description && (
          <p className="text-on-surface-variant text-sm leading-relaxed">{goal.description}</p>
        )}

        {/* Timeline + deadline */}
        <div className="flex items-center gap-3 flex-wrap">
          {goal.estimated_timeline && (
            <span className="font-label text-[10px] text-primary/80 tracking-widest uppercase bg-primary/10 px-2 py-0.5 rounded">
              ~{goal.estimated_timeline}
            </span>
          )}
          {hasTargetDate && countdown && (
            <span className={`font-label text-[10px] tracking-widest uppercase ${countdown.urgent ? 'text-yellow-400' : 'text-on-surface-variant'}`}>
              {countdown.label}
            </span>
          )}
          {hasTargetDate && (
            <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
              Deadline: {formatDate(goal.target_date)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
              {completedCount}/{totalCount} phases completed
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status actions */}
        {goal.status === 'active' && completedCount === totalCount && totalCount > 0 && (
          <button
            onClick={() => updateStatus('completed')}
            className="w-full bg-green-400/15 text-green-400 font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:bg-green-400/25 transition-colors"
          >
            ✓ Mark goal as completed
          </button>
        )}
        {goal.status === 'active' && (
          <button
            onClick={() => updateStatus('abandoned')}
            className="w-full bg-surface-container text-on-surface-variant font-label text-[10px] tracking-widest uppercase py-2 rounded-lg hover:opacity-70 transition-opacity"
          >
            Abandon goal
          </button>
        )}
        {goal.status !== 'active' && (
          <button
            onClick={() => updateStatus('active')}
            className="w-full bg-primary/15 text-primary font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:bg-primary/25 transition-colors"
          >
            Reactivate goal
          </button>
        )}
      </div>

      {/* Prerequisites */}
      {prerequisites.length > 0 && (
        <div className="bg-surface-low rounded-xl p-4 space-y-2">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Before you start</p>
          <ul className="space-y-1.5">
            {prerequisites.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="text-primary/60 shrink-0 mt-0.5">◦</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-3">
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase px-1">
          Progression phases
        </p>
        {goal.milestones.map(milestone => (
          <PhaseCard
            key={milestone.id}
            milestone={milestone}
            onToggle={completed => toggleMilestone(milestone.id, completed)}
            disabled={goal.status !== 'active'}
          />
        ))}
      </div>

      {/* Common Mistakes */}
      {commonMistakes.length > 0 && (
        <div className="bg-surface-low rounded-xl p-4 space-y-2 border border-yellow-400/10">
          <p className="font-label text-label-sm text-yellow-400/80 tracking-widest uppercase">Common mistakes</p>
          <ul className="space-y-1.5">
            {commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="text-yellow-400/50 shrink-0 mt-0.5">!</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA: Create Training Plan */}
      <div className="bg-surface-low rounded-xl p-5 space-y-3 border border-primary/20">
        <div>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">Want to train for this goal?</p>
          <p className="text-sm text-on-surface-variant mt-1">
            This guide shows you the path. If you want a structured training plan with sessions, sets, and reps, generate one in Training Plans.
          </p>
        </div>
        <button
          onClick={() => navigate('/training', { state: { prefillGoal: `${goal.title}: ${goal.description ?? goal.title}` } })}
          className="w-full bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Create Training Plan
        </button>
      </div>
    </div>
  );
};

interface PhaseCardProps {
  milestone: GoalMilestone;
  onToggle: (completed: boolean) => void;
  disabled: boolean;
}

function PhaseCard({ milestone, onToggle, disabled }: PhaseCardProps) {
  const completed = milestone.completed === 1;
  const keyExercises: string[] = JSON.parse(milestone.workouts || '[]');
  const tips: string[] = JSON.parse(milestone.tips || '[]');

  return (
    <div className={`bg-surface-low rounded-xl p-4 transition-opacity ${completed ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Phase badge */}
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm ${
          completed ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'
        }`}>
          {completed ? '✓' : milestone.week_number}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className={`font-medium text-sm ${completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                  {milestone.title}
                </p>
                {milestone.duration && (
                  <span className="font-label text-[10px] text-on-surface-variant tracking-widest bg-surface-container px-2 py-0.5 rounded">
                    {milestone.duration}
                  </span>
                )}
              </div>

              {milestone.description && (
                <p className="text-on-surface-variant text-xs leading-relaxed mb-2">
                  {milestone.description}
                </p>
              )}

              {/* Key exercises */}
              {keyExercises.length > 0 && (
                <div className="mb-2">
                  <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Key exercises</p>
                  <ul className="space-y-1">
                    {keyExercises.map((ex, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-on-surface-variant">
                        <span className="text-primary/50 mt-0.5 shrink-0">·</span>
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success criteria */}
              {milestone.target && (
                <div className="inline-flex items-center gap-1.5 bg-primary/10 rounded-lg px-2.5 py-1 mb-2">
                  <span className="text-primary text-[10px]">◎</span>
                  <span className="font-label text-[10px] text-primary tracking-wide">{milestone.target}</span>
                </div>
              )}

              {/* Tips */}
              {tips.length > 0 && (
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Tips</p>
                  <ul className="space-y-1">
                    {tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-on-surface-variant/80">
                        <span className="text-yellow-400/50 mt-0.5 shrink-0">→</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Completion checkbox */}
            <button
              onClick={() => !disabled && onToggle(!completed)}
              disabled={disabled}
              title={completed ? 'Mark as pending' : 'Mark as completed'}
              className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all active:scale-90 ${
                completed
                  ? 'bg-primary border-primary text-surface'
                  : 'border-outline-variant bg-transparent hover:border-primary/60'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {completed && (
                <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-current stroke-2">
                  <polyline points="1,5 4.5,8.5 11,1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {completed && milestone.completed_at && (
            <p className="font-label text-[10px] text-primary/60 tracking-widest uppercase mt-2">
              Completed on {new Date(milestone.completed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
