import React, { useState, useRef } from 'react';
import type { FoodAnalysis } from '../hooks/useNutrition';
import { STTButton } from './ui/STTButton';

const MEAL_SLOTS = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Cena' },
  { value: 'pre_workout', label: 'Pre-entreno' },
  { value: 'post_workout', label: 'Post-entreno' },
];

function getDefaultSlot(): string {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 13) return 'snack';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

interface MealLoggerProps {
  date: string;
  analyzing: boolean;
  analysisStream: string;
  analysisResult: FoodAnalysis | null;
  analysisError: string | null;
  onAnalyze: (file: File) => void;
  onStopAnalysis: () => void;
  onClearAnalysis: () => void;
  onSave: (data: {
    date: string;
    meal_slot: string;
    meal_name: string;
    description: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    image_path?: string;
    ai_model?: string;
    ai_confidence?: string;
    raw_ai_response?: string;
  }) => void;
  onClose: () => void;
}

export const MealLogger: React.FC<MealLoggerProps> = ({
  date,
  analyzing,
  analysisStream,
  analysisResult,
  analysisError,
  onAnalyze,
  onStopAnalysis,
  onClearAnalysis,
  onSave,
  onClose,
}) => {
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [slot, setSlot] = useState(getDefaultSlot());

  // Campos editables post-analisis o entrada manual
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [fiberG, setFiberG] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAnalysisResult, setShowAnalysisResult] = useState(false);

  // Cuando llega resultado de analisis, pre-llenar campos
  React.useEffect(() => {
    if (analysisResult) {
      setMealName(analysisResult.meal_name || '');
      setDescription(analysisResult.description || '');
      setCalories(String(analysisResult.calories || ''));
      setProteinG(String(analysisResult.protein_g || ''));
      setCarbsG(String(analysisResult.carbs_g || ''));
      setFatG(String(analysisResult.fat_g || ''));
      setFiberG(String(analysisResult.fiber_g || ''));
      setShowAnalysisResult(true);
    }
  }, [analysisResult]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setShowAnalysisResult(false);
    onClearAnalysis();
  };

  const handleAnalyze = () => {
    if (imageFile) onAnalyze(imageFile);
  };

  const handleSave = () => {
    onSave({
      date,
      meal_slot: slot,
      meal_name: mealName,
      description,
      calories: Number(calories) || 0,
      protein_g: Number(proteinG) || 0,
      carbs_g: Number(carbsG) || 0,
      fat_g: Number(fatG) || 0,
      fiber_g: fiberG ? Number(fiberG) : undefined,
      image_path: analysisResult?.image_path,
      ai_model: analysisResult ? 'claude-sonnet-4-6' : undefined,
      ai_confidence: analysisResult?.confidence,
    });
  };

  const confidenceColor = {
    high: 'text-[#22d3a5]',
    medium: 'text-yellow-400',
    low: 'text-tertiary',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full lg:max-w-lg bg-surface-low rounded-t-3xl lg:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-outline-variant/20">
          <h2 className="font-display text-on-surface font-semibold">Registrar Comida</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">×</button>
        </div>

        {/* Tab selector */}
        <div className="flex px-5 pt-3 gap-2">
          {(['photo', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg font-label text-label-sm tracking-wider uppercase transition-all ${
                mode === m
                  ? 'bg-surface-container text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {m === 'photo' ? 'Con foto' : 'Manual'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          {/* Selector de slot */}
          <div>
            <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1.5 block">Momento del día</label>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_SLOTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSlot(s.value)}
                  className={`px-2.5 py-1 rounded-lg font-label text-label-sm tracking-wide transition-all ${
                    slot === s.value
                      ? 'bg-primary text-surface'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'photo' && (
            <>
              {/* Zona de imagen */}
              {!imagePreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-all"
                >
                  <span className="text-3xl">📷</span>
                  <span className="font-body text-sm">Tomar foto o seleccionar imagen</span>
                </button>
              ) : (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                  <button
                    onClick={() => { setImagePreview(null); setImageFile(null); setShowAnalysisResult(false); onClearAnalysis(); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80"
                  >
                    ×
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Boton analizar */}
              {imageFile && !showAnalysisResult && (
                <div className="flex gap-2">
                  {!analyzing ? (
                    <button
                      onClick={handleAnalyze}
                      className="flex-1 py-3 rounded-xl bg-primary text-surface font-label text-sm tracking-wider uppercase font-medium"
                    >
                      Analizar con Claude AI
                    </button>
                  ) : (
                    <button
                      onClick={onStopAnalysis}
                      className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface-variant font-label text-sm tracking-wider uppercase"
                    >
                      Detener
                    </button>
                  )}
                </div>
              )}

              {/* Streaming feedback */}
              {analyzing && analysisStream && (
                <div className="bg-surface-container rounded-xl p-3">
                  <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-2">Analizando...</p>
                  <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                    {analysisStream}
                    <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse" />
                  </p>
                </div>
              )}

              {/* Error de analisis */}
              {analysisError && (
                <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3">
                  <p className="font-body text-sm text-red-400">{analysisError}</p>
                </div>
              )}

              {/* Resultado editable */}
              {showAnalysisResult && analysisResult && (
                <div className="flex items-center gap-2">
                  <span className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase">Confianza:</span>
                  <span className={`font-label text-label-sm tracking-wider uppercase font-semibold ${confidenceColor[analysisResult.confidence] || 'text-on-surface-variant'}`}>
                    {analysisResult.confidence}
                  </span>
                  {analysisResult.notes && (
                    <span className="font-body text-xs text-on-surface-variant ml-auto max-w-48 text-right truncate" title={analysisResult.notes}>
                      {analysisResult.notes}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Campos de entrada (foto post-analisis o manual) */}
          {(mode === 'manual' || showAnalysisResult) && (
            <>
              <div>
                <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">Nombre</label>
                <div className="relative">
                  <input
                    value={mealName}
                    onChange={e => setMealName(e.target.value)}
                    placeholder="Ej: Pollo con ensalada"
                    className="w-full bg-surface-container text-on-surface font-body text-sm px-3 py-2.5 pr-9 rounded-xl outline-none border border-transparent focus:border-primary/40 placeholder:text-on-surface-variant"
                  />
                  <STTButton
                    onTranscript={text => setMealName(prev => prev ? prev + ' ' + text : text)}
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  />
                </div>
              </div>

              <div>
                <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">Descripción</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Descripción opcional..."
                    rows={2}
                    className="w-full bg-surface-container text-on-surface font-body text-sm px-3 py-2.5 pr-9 rounded-xl outline-none border border-transparent focus:border-primary/40 placeholder:text-on-surface-variant resize-none"
                  />
                  <STTButton
                    onTranscript={text => setDescription(prev => prev ? prev + ' ' + text : text)}
                    size="sm"
                    className="absolute bottom-2 right-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Calorías', value: calories, set: setCalories, unit: 'kcal' },
                  { label: 'Proteína', value: proteinG, set: setProteinG, unit: 'g' },
                  { label: 'Carbos', value: carbsG, set: setCarbsG, unit: 'g' },
                  { label: 'Grasa', value: fatG, set: setFatG, unit: 'g' },
                ].map(({ label, value, set, unit }) => (
                  <div key={label}>
                    <label className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1 block">
                      {label} <span className="text-on-surface-variant/60 normal-case tracking-normal">({unit})</span>
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={e => set(e.target.value)}
                      className="w-full bg-surface-container text-on-surface font-display text-base px-3 py-2.5 rounded-xl outline-none border border-transparent focus:border-primary/40"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-outline-variant/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface-variant font-label text-sm tracking-wider uppercase"
          >
            Cancelar
          </button>
          {(mode === 'manual' || showAnalysisResult) && (
            <button
              onClick={handleSave}
              disabled={!mealName && !calories}
              className="flex-1 py-3 rounded-xl bg-primary text-surface font-label text-sm tracking-wider uppercase font-medium disabled:opacity-40"
            >
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
