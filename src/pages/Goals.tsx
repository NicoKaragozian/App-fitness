import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGoals } from '../hooks/useGoals';
import type { Goal } from '../hooks/useGoals';
import { useAIProvider } from '../hooks/useAIProvider';
import { useAIProgress } from '../hooks/useAIProgress';
import AIProgressIndicator from '../components/ui/AIProgressIndicator';
import { GOAL_PROGRESS } from '../utils/aiProgressConfigs';

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_COLORS: Record<string, string> = {
  active: 'text-primary bg-primary/10',
  completed: 'text-green-400 bg-green-400/10',
  abandoned: 'text-on-surface-variant bg-surface-container',
};

interface GoalsProps {
  isEmbedded?: boolean;
}

export const Goals: React.FC<GoalsProps> = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { goals, loading, generateGoal, deleteGoal, updateGoalStatus } = useGoals();
  const { provider } = useAIProvider();
  const aiProgress = useAIProgress();

  const SUGGESTIONS = [
    t('goals.suggestions.1'),
    t('goals.suggestions.2'),
    t('goals.suggestions.3'),
    t('goals.suggestions.4'),
    t('goals.suggestions.5'),
  ];

  const STATUS_LABELS: Record<string, string> = {
    active: t('goals.statusLabels.active'),
    completed: t('goals.statusLabels.completed'),
    abandoned: t('goals.statusLabels.abandoned'),
  };

  const formatCountdown = (targetDate: string): { label: string; urgent: boolean } => {
    const target = new Date(targetDate + 'T12:00:00');
    const now = new Date();
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: t('goals.countdown.overdue'), urgent: true };
    if (diffDays === 0) return { label: t('goals.countdown.today'), urgent: true };
    if (diffDays === 1) return { label: t('goals.countdown.tomorrow'), urgent: false };
    if (diffDays < 14) return { label: t('goals.countdown.days', { count: diffDays }), urgent: diffDays < 7 };
    const weeks = Math.ceil(diffDays / 7);
    return { label: t('goals.countdown.weeks', { count: weeks }), urgent: false };
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const [showForm, setShowForm] = useState(false);
  const [objective, setObjective] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!objective.trim()) return;
    setGenerating(true);
    setGenError(null);
    aiProgress.start(GOAL_PROGRESS);
    try {
      const data = await generateGoal(objective.trim(), targetDate || undefined, provider);
      aiProgress.complete();
      setTimeout(() => {
        setShowForm(false);
        setObjective('');
        setTargetDate('');
        navigate(`/goals/${data.id}`);
      }, 400);
    } catch (err: any) {
      aiProgress.reset();
      setGenError(err.message || 'Error generating guide');
    } finally {
      setGenerating(false);
    }
  }, [objective, targetDate, generateGoal, navigate, aiProgress, provider]);

  const activeGoals = goals.filter(g => g.status === 'active');
  const archivedGoals = goals.filter(g => g.status !== 'active');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-low rounded-xl p-5 animate-pulse h-16" />
        {[1, 2].map(i => <div key={i} className="bg-surface-low rounded-xl p-5 animate-pulse h-28" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5" onClick={() => setMenuOpen(null)}>

      {/* Header — hidden when embedded */}
      {!isEmbedded && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{t('goals.subtitle')}</p>
            <h1 className="font-display text-2xl text-on-surface">{t('goals.title')}</h1>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowForm(f => !f); setGenError(null); }}
            className="bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            {showForm ? t('common.cancel') : t('goals.newGoal')}
          </button>
        </div>
      )}

      {/* New Goal button when embedded */}
      {isEmbedded && (
        <div className="flex justify-end">
          <button
            onClick={e => { e.stopPropagation(); setShowForm(f => !f); setGenError(null); }}
            className="bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            {showForm ? t('common.cancel') : t('goals.newGoal')}
          </button>
        </div>
      )}

      {/* Generation form */}
      {showForm && (
        <div className="bg-surface-low rounded-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div>
            <p className="font-label text-label-sm text-primary tracking-widest uppercase">{t('goals.newGoalTitle')}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {t('goals.newGoalDesc')} <span className="text-primary">{t('goals.newGoalDescLink')}</span> {t('goals.newGoalDescEnd')}
            </p>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setObjective(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  objective === s
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/40 hover:text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Objective textarea */}
          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1.5 block">
              {t('goals.objectiveLabel')}
            </label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              rows={3}
              placeholder={t('goals.objectivePlaceholder')}
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-on-surface-variant/40"
            />
          </div>

          {/* Target date (optional) */}
          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1.5 block">
              {t('goals.targetDate')} <span className="normal-case text-on-surface-variant/60">{t('goals.targetDateOptional')}</span>
            </label>
            <input
              type="date"
              value={targetDate}
              min={TODAY}
              onChange={e => setTargetDate(e.target.value)}
              className="bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            />
          </div>

          {genError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="font-label text-label-sm text-red-400 tracking-wider uppercase mb-1">Error</p>
              <p className="text-sm text-red-300">{genError}</p>
            </div>
          )}

          {/* Generation progress */}
          {aiProgress.isActive && (
            <div className="bg-surface-container rounded-xl px-4 py-3">
              <AIProgressIndicator progress={aiProgress.progress} phase={aiProgress.phase} />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !objective.trim()}
            className="w-full bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {generating ? t('goals.generatingGuide') : t('goals.generateGuide')}
          </button>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length === 0 && !showForm && (
        <div className="bg-surface-low rounded-xl p-10 text-center space-y-3">
          <div className="text-4xl opacity-30">◎</div>
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">{t('goals.noActiveGoals')}</p>
          <p className="text-sm text-on-surface-variant">{t('goals.noActiveGoalsDesc')}</p>
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-3">
          {activeGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              menuOpen={menuOpen === goal.id}
              onMenuToggle={e => { e.stopPropagation(); setMenuOpen(menuOpen === goal.id ? null : goal.id); }}
              onOpen={() => navigate(`/goals/${goal.id}`)}
              onComplete={async () => { setMenuOpen(null); await updateGoalStatus(goal.id, 'completed'); }}
              onAbandon={async () => { setMenuOpen(null); await updateGoalStatus(goal.id, 'abandoned'); }}
              onDelete={() => { setMenuOpen(null); setConfirmDelete(goal.id); }}
              statusLabels={STATUS_LABELS}
              formatCountdown={formatCountdown}
              formatDate={formatDate}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Archived goals */}
      {archivedGoals.length > 0 && (
        <div className="space-y-2">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase px-1">{t('goals.previous')}</p>
          {archivedGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              menuOpen={menuOpen === goal.id}
              onMenuToggle={e => { e.stopPropagation(); setMenuOpen(menuOpen === goal.id ? null : goal.id); }}
              onOpen={() => navigate(`/goals/${goal.id}`)}
              onComplete={async () => { setMenuOpen(null); await updateGoalStatus(goal.id, 'active'); }}
              onAbandon={async () => { setMenuOpen(null); await updateGoalStatus(goal.id, 'abandoned'); }}
              onDelete={() => { setMenuOpen(null); setConfirmDelete(goal.id); }}
              archived
              statusLabels={STATUS_LABELS}
              formatCountdown={formatCountdown}
              formatDate={formatDate}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface-low rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <p className="font-display text-lg text-on-surface">{t('goals.deleteGoal')}</p>
            <p className="text-sm text-on-surface-variant">{t('goals.deleteGoalDesc')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:opacity-80"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => { await deleteGoal(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 bg-red-500/20 text-red-400 font-label text-label-sm tracking-widest uppercase py-2.5 rounded-xl hover:bg-red-500/30"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GoalCardProps {
  goal: Goal;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onComplete: () => void;
  onAbandon: () => void;
  onDelete: () => void;
  archived?: boolean;
  statusLabels: Record<string, string>;
  formatCountdown: (d: string) => { label: string; urgent: boolean };
  formatDate: (iso: string) => string;
  t: (key: string) => string;
}

function GoalCard({ goal, menuOpen, onMenuToggle, onOpen, onComplete, onAbandon, onDelete, archived, statusLabels, formatCountdown, formatDate, t }: GoalCardProps) {
  const countdown = goal.target_date ? formatCountdown(goal.target_date) : null;
  const progress = goal.milestone_count > 0 ? (goal.completed_count / goal.milestone_count) * 100 : 0;

  return (
    <div
      onClick={onOpen}
      className={`bg-surface-low rounded-xl p-4 cursor-pointer hover:bg-surface-container/50 transition-colors relative ${archived ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-medium text-on-surface text-sm">{goal.title}</p>
            {goal.status !== 'active' && (
              <span className={`font-label text-[10px] tracking-widest uppercase px-2 py-0.5 rounded ${STATUS_COLORS[goal.status]}`}>
                {statusLabels[goal.status]}
              </span>
            )}
          </div>
          {goal.description && (
            <p className="text-on-surface-variant text-xs mb-2 line-clamp-2">{goal.description}</p>
          )}

          {/* Progress */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-label text-[10px] text-on-surface-variant tracking-widest shrink-0">
              {goal.completed_count}/{goal.milestone_count} {t('goals.phases')}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {countdown && (
              <span className={`font-label text-[10px] tracking-widest uppercase ${countdown.urgent ? 'text-yellow-400' : 'text-on-surface-variant'}`}>
                {countdown.label}
              </span>
            )}
            {goal.target_date && (
              <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                {formatDate(goal.target_date)}
              </span>
            )}
            {goal.estimated_timeline && !goal.target_date && (
              <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                ~{goal.estimated_timeline}
              </span>
            )}
          </div>
        </div>

        {/* Menu button */}
        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onMenuToggle}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-base leading-none"
            title="Options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-44 bg-surface-low border border-outline-variant/20 rounded-xl shadow-xl z-10 overflow-hidden">
              <button
                onClick={onComplete}
                className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body"
              >
                {goal.status === 'active' ? t('goals.markCompleted') : t('goals.reactivate')}
              </button>
              {goal.status === 'active' && (
                <button
                  onClick={onAbandon}
                  className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body"
                >
                  {t('goals.abandon')}
                </button>
              )}
              <button
                onClick={onDelete}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors font-body"
              >
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
