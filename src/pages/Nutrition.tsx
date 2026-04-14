import React, { useState, useEffect } from 'react';
import { useNutrition } from '../hooks/useNutrition';
import { useNutritionPlan, type DietaryPreferences } from '../hooks/useNutritionPlan';
import { useProfile } from '../hooks/useProfile';
import { MealLogger } from '../components/MealLogger';
import { NutritionChat } from '../components/NutritionChat';
import { STTButton } from '../components/ui/STTButton';
import { useAIProgress } from '../hooks/useAIProgress';
import AIProgressIndicator from '../components/ui/AIProgressIndicator';
import { NUTRITION_PLAN_PROGRESS, FOOD_ANALYSIS_PROGRESS } from '../utils/aiProgressConfigs';

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  pre_workout: 'Pre-workout',
  post_workout: 'Post-workout',
};

const SLOT_ORDER = ['breakfast', 'pre_workout', 'lunch', 'snack', 'post_workout', 'dinner'];

const STRATEGY_OPTIONS = [
  { value: 'maintain', label: 'Maintenance' },
  { value: 'cut', label: 'Cut (Deficit)' },
  { value: 'bulk', label: 'Bulk (Surplus)' },
  { value: 'recomp', label: 'Recomposition' },
  { value: 'endurance', label: 'Endurance' },
];

const DIET_TYPES = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

const ALLERGY_OPTIONS = [
  { value: 'lactose', label: 'Lactose' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Tree nuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'eggs', label: 'Egg' },
  { value: 'soy', label: 'Soy' },
];

const DEFAULT_DIETARY_PREFS: DietaryPreferences = {
  diet_type: 'omnivore',
  allergies: [],
  excluded_foods: '',
  preferred_foods: '',
  meals_per_day: 5,
};

// Circular progress ring
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  const goToPreviousDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next <= todayStr) setSelectedDate(next);
  };

  const {
    logs, totals, targets, hasProfile, loading,
    analyzing, analysisResult, analysisError,
    analyzeMeal, stopAnalysis, clearAnalysis,
    saveMealLog, deleteLog,
    refetch: refetchNutrition,
  } = useNutrition(selectedDate);

  const { activePlan, loading: planLoading, generating, generatePlan, deletePlan } = useNutritionPlan();
  const { profile } = useProfile();
  const planProgress = useAIProgress();
  const photoProgress = useAIProgress();

  const [showLogger, setShowLogger] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'plan' | 'chat'>('today');
  const [selectedStrategy, setSelectedStrategy] = useState('maintain');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showPlanDetail, setShowPlanDetail] = useState<number | null>(null);
  const [generationStep, setGenerationStep] = useState<'strategy' | 'preferences'>('strategy');
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences>(DEFAULT_DIETARY_PREFS);

  // Pre-populate preferences from saved profile
  useEffect(() => {
    if (profile?.dietary_preferences) {
      try {
        const parsed = JSON.parse(profile.dietary_preferences);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setDietaryPrefs({ ...DEFAULT_DIETARY_PREFS, ...parsed });
        }
      } catch { /* ignore */ }
    }
  }, [profile]);

  const handleAnalyzeMeal = async (file: File) => {
    photoProgress.start(FOOD_ANALYSIS_PROGRESS);
    try {
      await analyzeMeal(file, () => photoProgress.onToken());
      photoProgress.complete();
    } catch {
      photoProgress.reset();
    }
  };

  const handleSaveMeal = async (data: Parameters<typeof saveMealLog>[0]) => {
    await saveMealLog(data);
    setShowLogger(false);
    clearAnalysis();
  };

  const handleCloseLogger = () => {
    setShowLogger(false);
    clearAnalysis();
    photoProgress.reset();
  };

  const handleGeneratePlan = async () => {
    setGenerateError(null);
    planProgress.start(NUTRITION_PLAN_PROGRESS);
    try {
      await generatePlan(selectedStrategy, undefined, dietaryPrefs, () => planProgress.onToken());
      planProgress.complete();
      await refetchNutrition(); // Update rings with new targets
      setGenerationStep('strategy'); // Reset to initial step
    } catch (err: any) {
      planProgress.reset();
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

  const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5 pb-24 lg:pb-6">
      {/* Header — daily macros */}
      <div className="bg-surface-low rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={isToday ? undefined : () => setSelectedDate(todayStr)}
            className={`text-center ${!isToday ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {isToday
              ? <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">TODAY</p>
              : <p className="font-label text-label-sm text-primary tracking-widest uppercase">← Back to today</p>
            }
            <p className="font-body text-sm text-on-surface capitalize">{formattedDate}</p>
          </button>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all disabled:opacity-30 disabled:cursor-default"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        {!hasProfile && (
          <div className="text-center mb-3">
            <p className="font-label text-[0.6rem] text-on-surface-variant tracking-wider">Default targets · <span className="text-primary">Complete your profile</span></p>
          </div>
        )}
        <div className="flex justify-around">
          <MacroRing value={totals.calories} target={targets.daily_calorie_target} label="Calories" unit="kcal" color="#f3ffca" />
          <MacroRing value={totals.protein_g} target={targets.daily_protein_g} label="Protein" unit="g" color="#6a9cff" />
          <MacroRing value={totals.carbs_g} target={targets.daily_carbs_g} label="Carbs" unit="g" color="#ff7439" />
          <MacroRing value={totals.fat_g} target={targets.daily_fat_g} label="Fat" unit="g" color="#22d3a5" />
        </div>
      </div>

      {/* CTA log meal */}
      <button
        onClick={() => setShowLogger(true)}
        className="w-full py-4 rounded-2xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2"
      >
        <span className="text-lg">+</span>
        Log Meal
      </button>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['today', 'plan', 'chat'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-label text-label-sm tracking-widest uppercase transition-all ${
              activeTab === tab
                ? 'bg-surface-container text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab === 'today' ? 'Today' : tab === 'plan' ? 'Plan' : 'AI Chat'}
          </button>
        ))}
      </div>

      {/* Tab: Today's meals */}
      {activeTab === 'today' && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="bg-surface-low rounded-2xl p-8 text-center">
              <p className="text-3xl mb-3">🥗</p>
              <p className="font-body text-on-surface-variant">No meals logged {isToday ? 'today' : 'this day'}.</p>
              {isToday && <p className="font-body text-sm text-on-surface-variant mt-1">Use the button above to add your first meal.</p>}
            </div>
          ) : (
            logs.map(log => (
              <MealCard key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
            ))
          )}
        </div>
      )}

      {/* Tab: Nutrition plan */}
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
                    { val: activePlan.daily_fat_g, label: 'FAT G' },
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

              {/* Plan meals */}
              {showPlanDetail === activePlan.id && (
                <PlanMealsDetail planId={activePlan.id} />
              )}

              <button
                onClick={() => deletePlan(activePlan.id)}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase hover:text-on-surface transition-all"
              >
                Delete plan
              </button>
            </div>
          ) : (
            <div className="bg-surface-low rounded-2xl p-5 space-y-4">
              {generationStep === 'strategy' ? (
                <>
                  <div>
                    <p className="font-display text-on-surface font-semibold mb-1">Generate Nutrition Plan</p>
                    <p className="font-body text-sm text-on-surface-variant">Claude will analyze your profile and physical activity to create a flexible plan with ingredient options.</p>
                  </div>

                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Strategy</label>
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
                    Next →
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
                      <p className="font-display text-on-surface font-semibold">Dietary Preferences</p>
                      <p className="font-body text-xs text-on-surface-variant">Strategy: {STRATEGY_OPTIONS.find(o => o.value === selectedStrategy)?.label}</p>
                    </div>
                  </div>

                  {/* Diet type */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Diet type</label>
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

                  {/* Allergies */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Allergies / Intolerances</label>
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

                  {/* Foods to avoid */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Foods to avoid</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dietaryPrefs.excluded_foods}
                        onChange={e => setDietaryPrefs(p => ({ ...p, excluded_foods: e.target.value }))}
                        placeholder="E.g.: liver, broccoli, canned tuna"
                        className="w-full bg-surface-container rounded-xl px-3 py-2.5 pr-9 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <STTButton
                        onTranscript={text => setDietaryPrefs(p => ({ ...p, excluded_foods: p.excluded_foods ? p.excluded_foods + ', ' + text : text }))}
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  </div>

                  {/* Preferred foods */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Preferred foods</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dietaryPrefs.preferred_foods}
                        onChange={e => setDietaryPrefs(p => ({ ...p, preferred_foods: e.target.value }))}
                        placeholder="E.g.: chicken, brown rice, banana, oats"
                        className="w-full bg-surface-container rounded-xl px-3 py-2.5 pr-9 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <STTButton
                        onTranscript={text => setDietaryPrefs(p => ({ ...p, preferred_foods: p.preferred_foods ? p.preferred_foods + ', ' + text : text }))}
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  </div>

                  {/* Meals per day */}
                  <div>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2 block">Meals per day</label>
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

                  {/* Generation progress */}
                  {planProgress.isActive && (
                    <div className="bg-surface-container rounded-xl p-3">
                      <AIProgressIndicator progress={planProgress.progress} phase={planProgress.phase} />
                    </div>
                  )}

                  <button
                    onClick={handleGeneratePlan}
                    disabled={generating}
                    className="w-full py-3.5 rounded-xl bg-primary text-surface font-label text-sm tracking-widest uppercase font-semibold disabled:opacity-60"
                  >
                    {generating ? 'Generating...' : 'Generate Plan with AI'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Nutrition chat */}
      {activeTab === 'chat' && (
        <NutritionChat
          date={selectedDate}
          totals={totals}
          targets={targets}
          logs={logs}
        />
      )}

      {/* MealLogger modal */}
      {showLogger && (
        <MealLogger
          date={selectedDate}
          analyzing={analyzing}
          analysisProgress={photoProgress.progress}
          analysisPhase={photoProgress.phase}
          analysisResult={analysisResult}
          analysisError={analysisError}
          onAnalyze={handleAnalyzeMeal}
          onStopAnalysis={stopAnalysis}
          onClearAnalysis={clearAnalysis}
          onSave={handleSaveMeal}
          onClose={handleCloseLogger}
        />
      )}
    </div>
  );
};

// Individual log card
function MealCard({ log, onDelete }: { log: any; onDelete: () => void }) {
  const time = log.logged_at ? new Date(log.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="bg-surface-low rounded-2xl overflow-hidden flex">
      {log.image_path && (
        <img
          src={`/uploads/${log.image_path}`}
          alt={log.meal_name || 'Meal'}
          className="w-20 h-20 object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-body text-sm text-on-surface font-medium truncate">{log.meal_name || 'Unnamed'}</p>
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
            <span className="font-label text-[0.6rem] tracking-wider text-[#22d3a5]">{log.fat_g}g fat</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Card for one option within a slot
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

// Slot with tabs for each option
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

// Plan meals detail (lazy — loads on expand)
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
