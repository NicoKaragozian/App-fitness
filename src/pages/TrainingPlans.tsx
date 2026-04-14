import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTrainingPlans } from '../hooks/useTrainingPlans';
import { useAssessment } from '../hooks/useAssessment';
import { Goals } from './Goals';

const MODELS = [
  { id: 'gemma3:4b', label: 'G3 · 4B', badge: 'Rápido' },
  { id: 'gemma3:12b', label: 'G3 · 12B', badge: 'Potente' },
  { id: 'gemma4:26b', label: 'G4 · 26B', badge: 'Top' },
  { id: 'gemma4:e2b', label: 'G4 · E2B', badge: 'Mobile' },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'plans';

  const { plans, loading, generatePlan, archivePlan, deletePlan } = useTrainingPlans();
  const { assessment, loading: assessmentLoading } = useAssessment();

  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() =>
    localStorage.getItem('drift_ai_model') ?? 'gemma3:4b'
  );
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const activePlans = plans.filter(p => p.status === 'active');
  const archivedPlans = plans.filter(p => p.status === 'archived');

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generatePlan(goal.trim(), selectedModel);
      navigate(`/training/${result.plan.id}`);
    } catch (err: any) {
      setGenError(err.message || 'Error generando el plan');
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
        {activeTab === 'plans' && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <span>+</span> Nuevo Plan
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 border border-outline-variant/20 w-fit">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2 rounded-lg font-label text-label-sm tracking-widest uppercase transition-colors ${
            activeTab === 'plans'
              ? 'bg-surface-low text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Planes
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'goals' })}
          className={`px-4 py-2 rounded-lg font-label text-label-sm tracking-widest uppercase transition-colors ${
            activeTab === 'goals'
              ? 'bg-surface-low text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Objetivos
        </button>
      </div>

      {/* Goals tab */}
      {activeTab === 'goals' && <Goals isEmbedded />}

      {/* Plans tab content */}
      {activeTab === 'plans' && (
        <>
          {/* Assessment CTA */}
          {!assessmentLoading && !assessment && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
              <div className="text-2xl shrink-0">◈</div>
              <div className="flex-1 min-w-0">
                <p className="font-label text-label-sm text-primary tracking-widest uppercase mb-0.5">Perfil sin completar</p>
                <p className="text-on-surface-variant text-xs">Completá tu perfil para que los planes de AI se personalicen con tus datos.</p>
              </div>
              <button
                onClick={() => navigate('/training/profile')}
                className="shrink-0 bg-primary text-surface font-label text-label-sm tracking-widest uppercase px-3 py-2 rounded-lg hover:opacity-90 transition-opacity text-xs"
              >
                Completar
              </button>
            </div>
          )}

          {/* Profile pill when assessment exists */}
          {!assessmentLoading && assessment && (
            <button
              onClick={() => navigate('/training/profile')}
              className="flex items-center gap-2 bg-surface-container border border-outline-variant/20 rounded-xl px-3 py-2 hover:bg-surface-high transition-colors w-fit"
            >
              <span className="text-xs">◈</span>
              <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Mi Perfil</span>
              <span className="font-label text-[10px] text-primary tracking-widest uppercase bg-primary/10 px-1.5 py-0.5 rounded">Completado</span>
            </button>
          )}

          {/* Generation form */}
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

              {/* Selector de modelo */}
              <div className="flex flex-wrap gap-2">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); localStorage.setItem('drift_ai_model', m.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-label tracking-wide transition-colors ${
                      selectedModel === m.id
                        ? 'bg-primary text-surface'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-high'
                    }`}
                  >
                    {m.label}
                    <span className={`text-[10px] px-1 rounded ${selectedModel === m.id ? 'bg-surface/20' : 'bg-surface-high'}`}>
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>

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
                  onClick={() => { setShowForm(false); setGoal(''); setGenError(null); }}
                  disabled={generating}
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
        </>
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
