import React, { useState, useEffect } from 'react';
import { useNutrition } from '../hooks/useNutrition';
import { useNutritionPlan, type DietaryPreferences } from '../hooks/useNutritionPlan';
import { useProfile } from '../hooks/useProfile';
import { MealLogger } from '../components/MealLogger';
import { STTButton } from '../components/ui/STTButton';

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

const DIET_TYPES = [
  { value: 'omnivore', label: 'Omnivoro' },
  { value: 'vegetarian', label: 'Vegetariano' },
  { value: 'vegan', label: 'Vegano' },
  { value: 'pescatarian', label: 'Pescatariano' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

const ALLERGY_OPTIONS = [
  { value: 'lactose', label: 'Lactosa' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Frutos secos' },
  { value: 'shellfish', label: 'Mariscos' },
  { value: 'eggs', label: 'Huevo' },
  { value: 'soy', label: 'Soja' },
];

const DEFAULT_DIETARY_PREFS: DietaryPreferences = {
  diet_type: 'omnivore',
  allergies: [],
  excluded_foods: '',
  preferred_foods: '',
  meals_per_day: 5,
};

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
    refetch: refetchNutrition,
  } = useNutrition(today);

  const { activePlan, loading: planLoading, generating, generationStream, generatePlan, deletePlan } = useNutritionPlan();
  const { profile } = useProfile();

  const [showLogger, setShowLogger] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'plan'>('today');
  const [selectedStrategy, setSelectedStrategy] = useState('maintain');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showPlanDetail, setShowPlanDetail] = useState<number | null>(null);
  const [generationStep, setGenerationStep] = useState<'strategy' | 'preferences'>('strategy');
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences>(DEFAULT_DIETARY_PREFS);

  // Pre-popular preferencias desde el perfil guardado
  useEffect(() => {
    if (profile?.dietary_preferences) {
      try {
        const parsed = JSON.parse(profile.dietary_preferences);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setDietaryPrefs({ ...DEFAULT_DIETARY_PREFS, ...parsed });
        }
      } catch { /* ignorar */ }
    }
  }, [profile]);

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
      await generatePlan(selectedStrategy, undefined, dietaryPrefs);
      await refetchNutrition(); // Actualizar rings con los nuevos targets
      setGenerationStep('strategy'); // Resetear al paso inicial
    } catch (err: any) {
      setGenerateError(err.message);
    }
  };

  const toggleAllergy = (value: string) => {
    setDietaryPrefs(prev => ({
      ...prev,
      allergies: prev.allergies.includes(value)
        ? prev.allergies.filter(a => a !== value)
        : [...prev.allergies, value],
    }));
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
              {generationStep === 'strategy' ? (
                <>
                  <div>
                    <p className="font-display text-on-surface font-semibold mb-1">Generar Plan Nutricional</p>
                    <p className="font-body text-sm text-on-surface-variant">Claude analizará tu perfil y actividad física para crear un plan flexible con opciones de ingredientes.</p>
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

                  <button
                    onClick={() => setGenerationStep('preferences')}
                    className="w-full py-3.5 rounded-xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold"
                  >
                    Siguiente →
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGenerationStep('strategy')}
                      className="text-on-surface-variant hover:text-on-surface text-sm transition-colors"
                    >
                      ←
                    </button>
                    <div>
                      <p className="font-display text-on-surface font-semibold">Preferencias Alimentarias</p>
                      <p className="font-body text-xs text-on-surface-variant">Estrategia: {STRATEGY_OPTIONS.find(o => o.value === selectedStrategy)?.label}</p>
                    </div>
                  </div>

                  {/* Tipo de dieta */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Tipo de dieta</label>
                    <div className="flex flex-wrap gap-2">
                      {DIET_TYPES.map(dt => (
                        <button
                          key={dt.value}
                          onClick={() => setDietaryPrefs(p => ({ ...p, diet_type: dt.value }))}
                          className={`px-3 py-1.5 rounded-lg font-label text-label-sm tracking-wide transition-all ${
                            dietaryPrefs.diet_type === dt.value
                              ? 'bg-primary text-surface'
                              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alergias */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Alergias / Intolerancias</label>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGY_OPTIONS.map(al => (
                        <button
                          key={al.value}
                          onClick={() => toggleAllergy(al.value)}
                          className={`px-3 py-1.5 rounded-lg font-label text-label-sm tracking-wide transition-all ${
                            dietaryPrefs.allergies.includes(al.value)
                              ? 'bg-tertiary/20 text-tertiary border border-tertiary/40'
                              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {al.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alimentos a evitar */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Alimentos a evitar</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dietaryPrefs.excluded_foods}
                        onChange={e => setDietaryPrefs(p => ({ ...p, excluded_foods: e.target.value }))}
                        placeholder="Ej: higado, brocoli, atun enlatado"
                        className="w-full bg-surface-container rounded-xl px-3 py-2.5 pr-9 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <STTButton
                        onTranscript={text => setDietaryPrefs(p => ({ ...p, excluded_foods: p.excluded_foods ? p.excluded_foods + ', ' + text : text }))}
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  </div>

                  {/* Alimentos preferidos */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Alimentos preferidos</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dietaryPrefs.preferred_foods}
                        onChange={e => setDietaryPrefs(p => ({ ...p, preferred_foods: e.target.value }))}
                        placeholder="Ej: pollo, arroz integral, banana, avena"
                        className="w-full bg-surface-container rounded-xl px-3 py-2.5 pr-9 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <STTButton
                        onTranscript={text => setDietaryPrefs(p => ({ ...p, preferred_foods: p.preferred_foods ? p.preferred_foods + ', ' + text : text }))}
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  </div>

                  {/* Comidas por dia */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Comidas por dia</label>
                    <div className="flex gap-2">
                      {[3, 4, 5, 6].map(n => (
                        <button
                          key={n}
                          onClick={() => setDietaryPrefs(p => ({ ...p, meals_per_day: n }))}
                          className={`px-4 py-1.5 rounded-lg font-label text-label-sm tracking-wide transition-all ${
                            dietaryPrefs.meals_per_day === n
                              ? 'bg-primary text-surface'
                              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {generateError && (
                    <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3">
                      <p className="font-body text-sm text-red-400">{generateError}</p>
                    </div>
                  )}

                  {/* Streaming feedback mientras Claude genera */}
                  {generating && (
                    <div className="bg-surface-container rounded-xl p-3 overflow-hidden">
                      {generationStream ? (
                        <div className="relative max-h-24 overflow-hidden">
                          <p className="font-mono text-[0.65rem] text-on-surface-variant leading-relaxed break-all">
                            {generationStream.slice(-400)}<span className="animate-pulse text-primary">▋</span>
                          </p>
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-container to-transparent" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {[0, 150, 300].map(delay => (
                            <div key={delay} className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                          ))}
                          <p className="font-label text-xs text-on-surface-variant tracking-wider">Conectando con Claude...</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleGeneratePlan}
                    disabled={generating}
                    className="w-full py-3.5 rounded-xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold disabled:opacity-60"
                  >
                    {generating ? 'Generando...' : 'Generar Plan con AI'}
                  </button>
                </>
              )}
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

// Card de una opcion dentro de un slot
function PlanMealOption({ meal }: { meal: any }) {
  return (
    <div>
      <p className="font-body text-sm text-on-surface font-medium">{meal.name}</p>
      {meal.description && (
        <p className="font-body text-xs text-on-surface-variant mt-1 leading-relaxed">{meal.description}</p>
      )}
      <div className="flex gap-3 mt-1.5">
        {meal.calories != null && <span className="font-label text-[0.6rem] tracking-wider text-primary">{meal.calories}kcal</span>}
        {meal.protein_g != null && <span className="font-label text-[0.6rem] tracking-wider text-secondary">{meal.protein_g}g prot</span>}
        {meal.carbs_g != null && <span className="font-label text-[0.6rem] tracking-wider text-tertiary">{meal.carbs_g}g carbs</span>}
        {meal.fat_g != null && <span className="font-label text-[0.6rem] tracking-wider text-[#22d3a5]">{meal.fat_g}g gras</span>}
      </div>
    </div>
  );
}

// Slot con tabs para cada opcion
function PlanSlotOptions({ slot, meals }: { slot: string; meals: any[] }) {
  const options = [...new Set(meals.map(m => m.option_number || 1))].sort((a, b) => a - b);
  const [activeOption, setActiveOption] = useState(options[0] || 1);
  const activeMeal = meals.find(m => (m.option_number || 1) === activeOption);

  return (
    <div className="bg-surface-low rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
          {SLOT_LABELS[slot] || slot}
        </p>
        {options.length > 1 && (
          <div className="flex gap-1">
            {options.map(n => (
              <button
                key={n}
                onClick={() => setActiveOption(n)}
                className={`px-2 py-0.5 rounded-md font-label text-[0.6rem] tracking-wider transition-all ${
                  activeOption === n
                    ? 'bg-primary text-surface'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Op. {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {activeMeal && <PlanMealOption meal={activeMeal} />}
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
        <PlanSlotOptions key={slot} slot={slot} meals={slotMeals} />
      ))}
    </div>
  );
}
