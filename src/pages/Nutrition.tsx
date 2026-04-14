import React, { useState } from 'react';
import { useNutrition } from '../hooks/useNutrition';
import { useNutritionPlan } from '../hooks/useNutritionPlan';
import { MealLogger } from '../components/MealLogger';

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Snack',
  dinner: 'Cena',
  pre_workout: 'Pre-entreno',
  post_workout: 'Post-entreno',
};

const SLOT_ORDER = ['breakfast', 'pre_workout', 'lunch', 'snack', 'post_workout', 'dinner'];

const STRATEGY_OPTIONS = [
  { value: 'maintain', label: 'Mantenimiento' },
  { value: 'cut', label: 'Definicion (Deficit)' },
  { value: 'bulk', label: 'Volumen (Supravit)' },
  { value: 'recomp', label: 'Recomposicion' },
  { value: 'endurance', label: 'Resistencia' },
];

// Ring circular de progreso
function MacroRing({
  value, target, label, unit, color,
}: {
  value: number; target: number; label: string; unit: string; color: string;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = pct * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-variant" />
          <circle
            cx="34" cy="34" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 34 34)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-xs font-bold text-on-surface">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-display text-sm font-bold text-on-surface">{value}<span className="font-body text-xs text-on-surface-variant ml-0.5">{unit}</span></p>
        <p className="font-label text-[0.6rem] text-on-surface-variant tracking-wider uppercase">{label}</p>
        <p className="font-body text-[0.6rem] text-on-surface-variant">/ {target}{unit}</p>
      </div>
    </div>
  );
}

export const Nutrition: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const {
    logs, totals, targets, hasProfile, loading,
    analyzing, analysisStream, analysisResult, analysisError,
    analyzeMeal, stopAnalysis, clearAnalysis,
    saveMealLog, deleteLog,
  } = useNutrition(today);

  const { activePlan, loading: planLoading, generating, generatePlan, deletePlan } = useNutritionPlan();

  const [showLogger, setShowLogger] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'plan'>('today');
  const [selectedStrategy, setSelectedStrategy] = useState('maintain');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showPlanDetail, setShowPlanDetail] = useState<number | null>(null);

  const handleSaveMeal = async (data: Parameters<typeof saveMealLog>[0]) => {
    await saveMealLog(data);
    setShowLogger(false);
    clearAnalysis();
  };

  const handleCloseLogger = () => {
    setShowLogger(false);
    clearAnalysis();
  };

  const handleGeneratePlan = async () => {
    setGenerateError(null);
    try {
      await generatePlan(selectedStrategy);
    } catch (err: any) {
      setGenerateError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-surface-container rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5 pb-24 lg:pb-6">
      {/* Header — macros del dia */}
      <div className="bg-surface-low rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">HOY</p>
            <p className="font-body text-sm text-on-surface capitalize">{formattedDate}</p>
          </div>
          {!hasProfile && (
            <div className="text-right">
              <p className="font-label text-[0.6rem] text-on-surface-variant tracking-wider">Targets por defecto</p>
              <p className="font-label text-[0.6rem] text-primary tracking-wider">Completá tu perfil</p>
            </div>
          )}
        </div>
        <div className="flex justify-around">
          <MacroRing value={totals.calories} target={targets.daily_calorie_target} label="Calorías" unit="kcal" color="#f3ffca" />
          <MacroRing value={totals.protein_g} target={targets.daily_protein_g} label="Proteína" unit="g" color="#6a9cff" />
          <MacroRing value={totals.carbs_g} target={targets.daily_carbs_g} label="Carbos" unit="g" color="#ff7439" />
          <MacroRing value={totals.fat_g} target={targets.daily_fat_g} label="Grasa" unit="g" color="#22d3a5" />
        </div>
      </div>

      {/* CTA registrar comida */}
      <button
        onClick={() => setShowLogger(true)}
        className="w-full py-4 rounded-2xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2"
      >
        <span className="text-lg">+</span>
        Registrar Comida
      </button>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['today', 'plan'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-label text-label-sm tracking-widest uppercase transition-all ${
              activeTab === tab
                ? 'bg-surface-container text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab === 'today' ? 'Hoy' : 'Plan'}
          </button>
        ))}
      </div>

      {/* Tab: Comidas de hoy */}
      {activeTab === 'today' && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="bg-surface-low rounded-2xl p-8 text-center">
              <p className="text-3xl mb-3">🥗</p>
              <p className="font-body text-on-surface-variant">No registraste comidas hoy.</p>
              <p className="font-body text-sm text-on-surface-variant mt-1">Usá el botón de arriba para agregar tu primera comida.</p>
            </div>
          ) : (
            logs.map(log => (
              <MealCard key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
            ))
          )}
        </div>
      )}

      {/* Tab: Plan nutricional */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          {planLoading ? (
            <div className="h-20 bg-surface-container rounded-xl animate-pulse" />
          ) : activePlan ? (
            <div className="space-y-3">
              <div className="bg-surface-low rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">{activePlan.strategy?.toUpperCase()}</p>
                    <p className="font-display text-on-surface font-semibold">{activePlan.title}</p>
                  </div>
                  <button
                    onClick={() => setShowPlanDetail(showPlanDetail === activePlan.id ? null : activePlan.id)}
                    className="text-on-surface-variant hover:text-on-surface text-sm"
                  >
                    {showPlanDetail === activePlan.id ? '▲' : '▼'}
                  </button>
                </div>
                <div className="flex gap-4 text-center">
                  {[
                    { val: activePlan.daily_calories, label: 'KCAL' },
                    { val: activePlan.daily_protein_g, label: 'PROT G' },
                    { val: activePlan.daily_carbs_g, label: 'CARBS G' },
                    { val: activePlan.daily_fat_g, label: 'GRASA G' },
                  ].map(({ val, label }) => (
                    <div key={label}>
                      <p className="font-display text-sm font-bold text-on-surface">{val || '-'}</p>
                      <p className="font-label text-[0.6rem] text-on-surface-variant tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
                {activePlan.rationale && (
                  <p className="font-body text-xs text-on-surface-variant mt-3 leading-relaxed">{activePlan.rationale}</p>
                )}
              </div>

              {/* Comidas del plan */}
              {showPlanDetail === activePlan.id && (
                <PlanMealsDetail planId={activePlan.id} />
              )}

              <button
                onClick={() => deletePlan(activePlan.id)}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase hover:text-on-surface transition-all"
              >
                Eliminar plan
              </button>
            </div>
          ) : (
            <div className="bg-surface-low rounded-2xl p-5 space-y-4">
              <div>
                <p className="font-display text-on-surface font-semibold mb-1">Generar Plan Nutricional</p>
                <p className="font-body text-sm text-on-surface-variant">Claude analizará tu perfil y actividad física para crear un plan personalizado.</p>
              </div>

              <div>
                <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Estrategia</label>
                <div className="flex flex-wrap gap-2">
                  {STRATEGY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedStrategy(opt.value)}
                      className={`px-3 py-1.5 rounded-lg font-label text-label-sm tracking-wide transition-all ${
                        selectedStrategy === opt.value
                          ? 'bg-primary text-surface'
                          : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {generateError && (
                <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3">
                  <p className="font-body text-sm text-red-400">{generateError}</p>
                </div>
              )}

              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="w-full py-3.5 rounded-xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold disabled:opacity-60"
              >
                {generating ? 'Generando con Claude AI...' : 'Generar Plan con AI'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal MealLogger */}
      {showLogger && (
        <MealLogger
          date={today}
          analyzing={analyzing}
          analysisStream={analysisStream}
          analysisResult={analysisResult}
          analysisError={analysisError}
          onAnalyze={analyzeMeal}
          onStopAnalysis={stopAnalysis}
          onClearAnalysis={clearAnalysis}
          onSave={handleSaveMeal}
          onClose={handleCloseLogger}
        />
      )}
    </div>
  );
};

// Tarjeta de log individual
function MealCard({ log, onDelete }: { log: any; onDelete: () => void }) {
  const time = log.logged_at ? new Date(log.logged_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="bg-surface-low rounded-2xl overflow-hidden flex">
      {log.image_path && (
        <img
          src={`/uploads/${log.image_path}`}
          alt={log.meal_name || 'Comida'}
          className="w-20 h-20 object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-body text-sm text-on-surface font-medium truncate">{log.meal_name || 'Sin nombre'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {log.meal_slot && (
                <span className="font-label text-[0.6rem] text-on-surface-variant tracking-wider uppercase">
                  {SLOT_LABELS[log.meal_slot] || log.meal_slot}
                </span>
              )}
              {time && <span className="font-label text-[0.6rem] text-on-surface-variant">{time}</span>}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="text-on-surface-variant hover:text-red-400 transition-colors text-sm flex-shrink-0"
          >
            ×
          </button>
        </div>
        <div className="flex gap-3 mt-2">
          {log.calories != null && (
            <span className="font-label text-[0.6rem] tracking-wider text-primary">{log.calories}kcal</span>
          )}
          {log.protein_g != null && (
            <span className="font-label text-[0.6rem] tracking-wider text-secondary">{log.protein_g}g prot</span>
          )}
          {log.carbs_g != null && (
            <span className="font-label text-[0.6rem] tracking-wider text-tertiary">{log.carbs_g}g carbs</span>
          )}
          {log.fat_g != null && (
            <span className="font-label text-[0.6rem] tracking-wider text-[#22d3a5]">{log.fat_g}g gras</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Detalle de comidas del plan (lazy — carga al expandir)
function PlanMealsDetail({ planId }: { planId: number }) {
  const [meals, setMeals] = useState<any[] | null>(null);
  const { fetchPlanDetail } = useNutritionPlan();

  React.useEffect(() => {
    fetchPlanDetail(planId).then(plan => setMeals(plan.meals || []));
  }, [planId, fetchPlanDetail]);

  if (!meals) return <div className="h-10 bg-surface-container rounded-xl animate-pulse" />;

  const grouped = SLOT_ORDER.reduce((acc, slot) => {
    const slotMeals = meals.filter(m => m.slot === slot);
    if (slotMeals.length > 0) acc[slot] = slotMeals;
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([slot, slotMeals]) => (
        <div key={slot} className="bg-surface-low rounded-2xl p-4">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">
            {SLOT_LABELS[slot] || slot}
          </p>
          {slotMeals.map(meal => (
            <div key={meal.id} className="mb-3 last:mb-0">
              <p className="font-body text-sm text-on-surface font-medium">{meal.name}</p>
              {meal.description && (
                <p className="font-body text-xs text-on-surface-variant mt-0.5">{meal.description}</p>
              )}
              <div className="flex gap-3 mt-1">
                {meal.calories != null && <span className="font-label text-[0.6rem] tracking-wider text-primary">{meal.calories}kcal</span>}
                {meal.protein_g != null && <span className="font-label text-[0.6rem] tracking-wider text-secondary">{meal.protein_g}g prot</span>}
                {meal.carbs_g != null && <span className="font-label text-[0.6rem] tracking-wider text-tertiary">{meal.carbs_g}g carbs</span>}
                {meal.fat_g != null && <span className="font-label text-[0.6rem] tracking-wider text-[#22d3a5]">{meal.fat_g}g gras</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
