import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainingPlans } from '../hooks/useTrainingPlans';

const PRESETS = [
  'Plan de fuerza funcional para complementar deportes acuáticos y raqueta',
  'Plan de hipertrofia con 3 sesiones semanales',
  'Core y estabilidad para mejorar el equilibrio en el agua',
  'Plan de fuerza general para principiantes en gym',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const TrainingPlans: React.FC = () => {
  const navigate = useNavigate();
  const { plans, loading, generatePlanStream, stopGeneration, archivePlan, deletePlan } = useTrainingPlans();
  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const activePlans = plans.filter(p => p.status === 'active');
  const archivedPlans = plans.filter(p => p.status === 'archived');

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setGenerating(true);
    setThinkingText('');
    setGenError(null);
    try {
      const result = await generatePlanStream(goal.trim(), (text) => {
        setThinkingText(text);
      });
      navigate(`/training/${result.plan.id}`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setGenError(err.message || 'Error generando el plan');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-surface-low rounded-xl p-5 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Training Plans</span>
          <p className="font-display text-xl text-on-surface mt-0.5">Planes Personalizados</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <span>+</span> Nuevo Plan
          </button>
        )}
      </div>

      {/* Formulario de generación */}
      {showForm && (
        <div className="bg-surface-low rounded-xl p-5 space-y-4 border border-primary/20">
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">Generar Plan con AI</p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => setGoal(p)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  goal === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
                }`}
              >
                {p.length > 40 ? p.slice(0, 40) + '…' : p}
              </button>
            ))}
          </div>

          {/* Goal input */}
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Describí tu objetivo (ej: plan de fuerza para complementar surf y tenis, 3 días por semana)..."
            rows={3}
            className="w-full bg-surface-container rounded-lg px-4 py-3 text-on-surface text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder-on-surface-variant"
          />

          {/* Texto de análisis en streaming */}
          {generating && thinkingText && (
            <div className="bg-surface-container rounded-lg px-4 py-3 space-y-1.5">
              <p className="font-label text-[10px] text-primary tracking-widest uppercase">Analizando tus datos...</p>
              <p className="text-on-surface-variant text-sm whitespace-pre-line leading-relaxed">
                {thinkingText}
                <span className="animate-pulse">▍</span>
              </p>
            </div>
          )}

          {genError && (
            <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-2">{genError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || !goal.trim()}
              className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-3 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                  Generando plan…
                </span>
              ) : 'Generar Plan'}
            </button>
            <button
              onClick={() => {
                if (generating) {
                  stopGeneration();
                } else {
                  setShowForm(false);
                  setGoal('');
                  setGenError(null);
                  setThinkingText('');
                }
              }}
              className="px-4 py-3 rounded-lg bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase hover:bg-surface-high transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Planes activos */}
      {activePlans.length > 0 && (
        <div className="space-y-3">
          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Activos</span>
          {activePlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onOpen={() => navigate(`/training/${plan.id}`)}
              onArchive={() => archivePlan(plan.id)}
              onDelete={() => setConfirmDelete(plan.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {activePlans.length === 0 && !showForm && (
        <div className="bg-surface-low rounded-xl p-8 text-center space-y-3">
          <p className="text-3xl">▣</p>
          <p className="font-display text-on-surface">Sin planes activos</p>
          <p className="text-on-surface-variant text-sm">Generá un plan personalizado basado en tus datos biométricos y deportivos.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Crear mi primer plan
          </button>
        </div>
      )}

      {/* Planes archivados */}
      {archivedPlans.length > 0 && (
        <div className="space-y-3">
          <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Archivados</span>
          {archivedPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onOpen={() => navigate(`/training/${plan.id}`)}
              onArchive={() => {}}
              onDelete={() => setConfirmDelete(plan.id)}
              archived
            />
          ))}
        </div>
      )}

      {/* Modal confirmación borrar */}
      {confirmDelete != null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-low rounded-xl p-6 max-w-sm w-full space-y-4">
            <p className="font-display text-on-surface">Borrar plan</p>
            <p className="text-on-surface-variant text-sm">Se borrarán el plan, todas las sesiones y el historial de workouts. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => { await deletePlan(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 bg-red-600 text-white font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors"
              >
                Borrar
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase px-4 py-2.5 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PlanCardProps {
  plan: ReturnType<typeof useTrainingPlans>['plans'][number];
  onOpen: () => void;
  onArchive: () => void;
  onDelete: () => void;
  archived?: boolean;
}

function PlanCard({ plan, onOpen, onArchive, onDelete, archived }: PlanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`bg-surface-low rounded-xl p-5 cursor-pointer hover:bg-surface-container transition-colors relative ${archived ? 'opacity-60' : ''}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {archived && (
              <span className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase bg-surface-container px-2 py-0.5 rounded">
                Archivado
              </span>
            )}
          </div>
          <p className="font-display text-on-surface text-lg leading-tight">{plan.title}</p>
          {plan.objective && (
            <p className="text-on-surface-variant text-sm mt-1 line-clamp-2">{plan.objective}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3">
            {plan.frequency && (
              <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
                {plan.frequency}
              </span>
            )}
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {plan.sessionCount} sesiones
            </span>
            <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
              {plan.workoutCount} completados
            </span>
            {plan.lastWorkout && (
              <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
                Último: {formatDate(plan.lastWorkout)}
              </span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors text-lg"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 bg-surface-container rounded-xl shadow-lg overflow-hidden z-10 w-40">
              {!archived && (
                <button
                  onClick={() => { setMenuOpen(false); onArchive(); }}
                  className="w-full px-4 py-3 text-left text-sm text-on-surface-variant hover:bg-surface-high transition-colors"
                >
                  Archivar
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-surface-high transition-colors"
              >
                Borrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
