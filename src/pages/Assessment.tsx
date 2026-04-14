import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessment } from '../hooks/useAssessment';

const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'athlete', label: 'Athlete' },
];

const GOAL_OPTIONS = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'weight_loss', label: 'Weight loss' },
  { value: 'sports_performance', label: 'Sports performance' },
  { value: 'general_health', label: 'General health' },
  { value: 'other', label: 'Other' },
];

const DAYS = [
  { value: 'Mon', label: 'MON' },
  { value: 'Tue', label: 'TUE' },
  { value: 'Wed', label: 'WED' },
  { value: 'Thu', label: 'THU' },
  { value: 'Fri', label: 'FRI' },
  { value: 'Sat', label: 'SAT' },
  { value: 'Sun', label: 'SUN' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbells', label: 'Barbells & plates' },
  { value: 'resistance_bands', label: 'Resistance bands' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'trx', label: 'TRX / Rings' },
  { value: 'machines', label: 'Machines' },
  { value: 'kettlebells', label: 'Kettlebells' },
];

interface FormState {
  name: string;
  age: string;
  height: string;
  weight: string;
  fitness_level: string;
  goals: string[];
  goals_other: string;
  sport_practice: string;
  sport_name: string;
  available_days: string[];
  session_duration: string;
  equipment: string[];
  equipment_other: string;
  injuries_limitations: string;
  training_preferences: string;
  past_injuries_detail: string;
  time_constraints: string;
  short_term_goals: string;
  long_term_goals: string;
  special_considerations: string;
}

const EMPTY: FormState = {
  name: '',
  age: '',
  height: '',
  weight: '',
  fitness_level: '',
  goals: [],
  goals_other: '',
  sport_practice: '',
  sport_name: '',
  available_days: [],
  session_duration: '',
  equipment: [],
  equipment_other: '',
  injuries_limitations: '',
  training_preferences: '',
  past_injuries_detail: '',
  time_constraints: '',
  short_term_goals: '',
  long_term_goals: '',
  special_considerations: '',
};

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function ToggleButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
        selected
          ? 'bg-primary/20 text-primary border-primary/40'
          : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/40 hover:text-on-surface'
      }`}
    >
      {children}
    </button>
  );
}

export const Assessment: React.FC = () => {
  const navigate = useNavigate();
  const { assessment, loading, save } = useAssessment();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pre-fill on edit mode
  useEffect(() => {
    if (!assessment) return;
    setForm({
      name: assessment.name ?? '',
      age: assessment.age != null ? String(assessment.age) : '',
      height: assessment.height != null ? String(assessment.height) : '',
      weight: assessment.weight != null ? String(assessment.weight) : '',
      fitness_level: assessment.fitness_level ?? '',
      goals: assessment.goals ? tryParse(assessment.goals, []) : [],
      goals_other: assessment.goals_other ?? '',
      sport_practice: assessment.sport_practice ?? '',
      sport_name: assessment.sport_name ?? '',
      available_days: assessment.available_days ? tryParse(assessment.available_days, []) : [],
      session_duration: assessment.session_duration != null ? String(assessment.session_duration) : '',
      equipment: assessment.equipment ? tryParse(assessment.equipment, []) : [],
      equipment_other: assessment.equipment_other ?? '',
      injuries_limitations: assessment.injuries_limitations ?? '',
      training_preferences: assessment.training_preferences ?? '',
      past_injuries_detail: assessment.past_injuries_detail ?? '',
      time_constraints: assessment.time_constraints ?? '',
      short_term_goals: assessment.short_term_goals ?? '',
      long_term_goals: assessment.long_term_goals ?? '',
      special_considerations: assessment.special_considerations ?? '',
    });
  }, [assessment]);

  function tryParse(val: string, fallback: any) {
    try { return JSON.parse(val); } catch { return fallback; }
  }

  const set = (key: keyof FormState, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  // Step validation
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Name is required';
      if (!form.age || isNaN(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120) errs.age = 'Enter a valid age';
    }
    if (s === 2) {
      if (!form.fitness_level) errs.fitness_level = 'Select your fitness level';
      if (form.goals.length === 0) errs.goals = 'Select at least one goal';
    }
    if (s === 3) {
      if (form.available_days.length === 0) errs.available_days = 'Select at least one day';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else navigate('/training');
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setSaving(true);
    setSaveError(null);
    try {
      await save({
        name: form.name.trim(),
        age: Number(form.age),
        height: form.height ? Number(form.height) : null,
        weight: form.weight ? Number(form.weight) : null,
        fitness_level: form.fitness_level || null,
        goals: form.goals,
        goals_other: form.goals_other.trim() || null,
        sport_practice: form.sport_practice || null,
        sport_name: form.sport_name.trim() || null,
        available_days: form.available_days,
        session_duration: form.session_duration ? Number(form.session_duration) : null,
        equipment: form.equipment,
        equipment_other: form.equipment_other.trim() || null,
        injuries_limitations: form.injuries_limitations.trim() || null,
        training_preferences: form.training_preferences.trim() || null,
        past_injuries_detail: form.past_injuries_detail.trim() || null,
        time_constraints: form.time_constraints.trim() || null,
        short_term_goals: form.short_term_goals.trim() || null,
        long_term_goals: form.long_term_goals.trim() || null,
        special_considerations: form.special_considerations.trim() || null,
      });
      navigate('/training');
    } catch (err: any) {
      setSaveError(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-lg mx-auto">
        {[1, 2, 3].map(i => <div key={i} className="bg-surface-low rounded-xl p-5 animate-pulse h-16" />)}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">

      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
      >
        ← Training
      </button>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">
            Step {step} of 3
          </p>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step ? 'bg-primary w-6' : 'bg-surface-container w-3'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step 1 — Basic Info */}
      {step === 1 && (
        <div className="bg-surface-low rounded-xl p-5 space-y-5">
          <p className="font-display text-on-surface text-lg">Basic Info</p>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
              Name <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your name"
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
              Age <span className="text-primary">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.age}
              onChange={e => set('age', e.target.value)}
              placeholder="30"
              min={1}
              max={120}
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={form.height}
                onChange={e => set('height', e.target.value)}
                placeholder="175"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={form.weight}
                onChange={e => set('weight', e.target.value)}
                placeholder="70"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Training Profile */}
      {step === 2 && (
        <div className="bg-surface-low rounded-xl p-5 space-y-5">
          <p className="font-display text-on-surface text-lg">Training Profile</p>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-2">
              Fitness level <span className="text-primary">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FITNESS_LEVELS.map(l => (
                <ToggleButton
                  key={l.value}
                  selected={form.fitness_level === l.value}
                  onClick={() => set('fitness_level', form.fitness_level === l.value ? '' : l.value)}
                >
                  {l.label}
                </ToggleButton>
              ))}
            </div>
            {errors.fitness_level && <p className="text-red-400 text-xs mt-1">{errors.fitness_level}</p>}
          </div>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-2">
              Training goals <span className="text-primary">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map(g => (
                <ToggleButton
                  key={g.value}
                  selected={form.goals.includes(g.value)}
                  onClick={() => set('goals', toggle(form.goals, g.value))}
                >
                  {g.label}
                </ToggleButton>
              ))}
            </div>
            {errors.goals && <p className="text-red-400 text-xs mt-1">{errors.goals}</p>}
          </div>

          {form.goals.includes('other') && (
            <div>
              <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                Specify goal
              </label>
              <input
                type="text"
                value={form.goals_other}
                onChange={e => set('goals_other', e.target.value)}
                placeholder="Describe your specific goal"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-2">
              Do you practice any sport?
            </label>
            <div className="flex gap-2">
              {[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }].map(opt => (
                <ToggleButton
                  key={opt.value}
                  selected={form.sport_practice === opt.value}
                  onClick={() => set('sport_practice', form.sport_practice === opt.value ? '' : opt.value)}
                >
                  {opt.label}
                </ToggleButton>
              ))}
            </div>
          </div>

          {form.sport_practice === 'yes' && (
            <div>
              <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                Which one(s)?
              </label>
              <input
                type="text"
                value={form.sport_name}
                onChange={e => set('sport_name', e.target.value)}
                placeholder="E.g.: kitesurfing, tennis, soccer"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Availability and Details */}
      {step === 3 && (
        <div className="bg-surface-low rounded-xl p-5 space-y-5">
          <p className="font-display text-on-surface text-lg">Availability and Details</p>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-2">
              Available training days <span className="text-primary">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <ToggleButton
                  key={d.value}
                  selected={form.available_days.includes(d.value)}
                  onClick={() => set('available_days', toggle(form.available_days, d.value))}
                >
                  {d.label}
                </ToggleButton>
              ))}
            </div>
            {errors.available_days && <p className="text-red-400 text-xs mt-1">{errors.available_days}</p>}
          </div>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
              Available session duration (minutes)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.session_duration}
              onChange={e => set('session_duration', e.target.value)}
              placeholder="60"
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-2">
              Available equipment
            </label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map(e => (
                <ToggleButton
                  key={e.value}
                  selected={form.equipment.includes(e.value)}
                  onClick={() => set('equipment', toggle(form.equipment, e.value))}
                >
                  {e.label}
                </ToggleButton>
              ))}
            </div>
          </div>

          {form.equipment.length > 0 && (
            <div>
              <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                Additional equipment (optional)
              </label>
              <input
                type="text"
                value={form.equipment_other}
                onChange={e => set('equipment_other', e.target.value)}
                placeholder="E.g.: treadmill, stationary bike"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
              Current injuries or limitations
            </label>
            <textarea
              value={form.injuries_limitations}
              onChange={e => set('injuries_limitations', e.target.value)}
              rows={2}
              placeholder="E.g.: knee pain, lumbar hernia, nothing at the moment"
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Advanced fields toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="text-on-surface-variant text-xs hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span>{showAdvanced ? '▲' : '▼'}</span>
            {showAdvanced ? 'Hide additional details' : 'Show additional details'}
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-outline-variant/20">
              <div>
                <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                  Training preferences
                </label>
                <textarea
                  value={form.training_preferences}
                  onChange={e => set('training_preferences', e.target.value)}
                  rows={2}
                  placeholder="E.g.: I prefer functional training, I don't like machines"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                  Injury history
                </label>
                <textarea
                  value={form.past_injuries_detail}
                  onChange={e => set('past_injuries_detail', e.target.value)}
                  rows={2}
                  placeholder="E.g.: ligament tear in 2022, shoulder surgery"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                  Short-term goals
                </label>
                <input
                  type="text"
                  value={form.short_term_goals}
                  onChange={e => set('short_term_goals', e.target.value)}
                  placeholder="In the next 1-3 months"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                  Long-term goals
                </label>
                <input
                  type="text"
                  value={form.long_term_goals}
                  onChange={e => set('long_term_goals', e.target.value)}
                  placeholder="In the next 6-12 months"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase block mb-1.5">
                  Special considerations
                </label>
                <textarea
                  value={form.special_considerations}
                  onChange={e => set('special_considerations', e.target.value)}
                  rows={2}
                  placeholder="Any additional information relevant to your training"
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{saveError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="px-5 py-3 rounded-xl bg-surface-container text-on-surface-variant font-label text-label-sm tracking-widest uppercase hover:bg-surface-high transition-colors"
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-primary text-surface font-label text-label-sm tracking-widest uppercase py-3 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-surface/30 border-t-surface rounded-full animate-spin block" />
                Saving...
              </>
            ) : (assessment ? 'Update profile' : 'Save profile')}
          </button>
        )}
      </div>
    </div>
  );
};
