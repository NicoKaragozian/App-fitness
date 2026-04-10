/**
 * Mapeo de HKWorkoutActivityType (rawValue) → sport_type (string estilo Garmin)
 * Referencia: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
 */
export const HK_ACTIVITY_MAP: Record<number, string> = {
  1:  'american_football',
  2:  'archery',
  4:  'badminton',
  5:  'baseball',
  6:  'basketball',
  8:  'boxing',
  9:  'rock_climbing',
  11: 'crossfit',
  13: 'cycling',
  14: 'dance',
  16: 'elliptical',
  20: 'strength_training',    // functionalStrengthTraining
  21: 'golf',
  22: 'gymnastics',
  24: 'hiking',
  28: 'martial_arts',
  29: 'yoga',
  30: 'indoor_cardio',        // mixedMetabolicCardioTraining
  31: 'kayaking',             // paddleSports
  34: 'racquetball',
  35: 'rowing',
  36: 'rugby',
  37: 'running',
  38: 'sailing',
  39: 'skating',              // skatingSports
  40: 'skiing',               // snowSports genérico
  41: 'soccer',
  43: 'squash',
  44: 'stair_climbing',
  45: 'surfing',              // surfingSports → surfing/kitesurfing/windsurf comparten esto
  46: 'swimming',
  47: 'table_tennis',
  48: 'tennis',
  49: 'track_and_field',
  50: 'strength_training',    // traditionalStrengthTraining
  51: 'volleyball',
  52: 'walking',
  53: 'swimming',             // waterFitness
  54: 'swimming',             // waterPolo
  55: 'windsurfing',          // waterSports genérico → windsurfing como default
  57: 'yoga',
  58: 'barre',
  59: 'core_training',
  60: 'cross_country_skiing',
  61: 'skiing',               // downhillSkiing
  62: 'flexibility',
  63: 'hiit',                 // highIntensityIntervalTraining
  64: 'jump_rope',
  65: 'kickboxing',
  66: 'pilates',
  67: 'snowboarding',
  68: 'stair_climbing',
  69: 'step_training',
  72: 'tai_chi',
  73: 'indoor_cardio',        // mixedCardio
  75: 'frisbee',              // discSports
  79: 'pickleball',
  3000: 'other',
};

/**
 * Convierte un HKWorkoutActivityType rawValue al sport_type string.
 * Devuelve 'other' si no hay match.
 */
export function hkActivityToSportType(activityId: number): string {
  return HK_ACTIVITY_MAP[activityId] ?? 'other';
}

/**
 * Calcula una categoría legacy (para la columna `category` de activities).
 * En el nuevo sistema, la agrupación real viene de sport_groups, pero la columna
 * sigue existiendo con un valor por omisión.
 */
export function hkActivityToCategory(activityId: number): string {
  const sportType = hkActivityToSportType(activityId);
  const waterTypes = ['surfing', 'windsurfing', 'kitesurfing', 'kiteboarding', 'sailing',
    'kayaking', 'stand_up_paddleboarding', 'swimming', 'water_sports'];
  if (waterTypes.includes(sportType)) return 'water_sports';
  if (sportType === 'tennis' || sportType === 'padel' || sportType === 'squash') return 'tennis';
  if (['strength_training', 'crossfit', 'hiit', 'gym', 'indoor_cardio'].includes(sportType)) return 'gym';
  if (['running', 'cycling', 'walking', 'hiking'].includes(sportType)) return 'running';
  return 'other';
}

// ─── Sleep helpers ────────────────────────────────────────────────────────────

interface HKSleepSample {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;  // horas
  sleepState: 'InBed' | 'Asleep';
}

export interface DailySleepSummary {
  date: string;         // YYYY-MM-DD de la mañana siguiente (como usa Garmin)
  durationSeconds: number;
  score: number;        // estimado 0-100 basado en duración
  inBedSeconds: number;
  asleepSeconds: number;
}

/**
 * Agrupa samples de sleep por noche y calcula un resumen diario.
 * HK devuelve muchos samples sueltos — los agrupamos por "noche" (noon→noon).
 */
export function aggregateSleepByNight(samples: HKSleepSample[]): DailySleepSummary[] {
  // Agrupar por "noche": asignamos cada sample al día de la mañana de fin
  const byNight: Record<string, { inBed: number; asleep: number }> = {};

  for (const s of samples) {
    const end = new Date(s.endDate);
    // Normalizamos: si termina antes de las 14hs lo contamos como esa madrugada
    const dateKey = end.toISOString().slice(0, 10); // YYYY-MM-DD del día de fin

    if (!byNight[dateKey]) byNight[dateKey] = { inBed: 0, asleep: 0 };
    const secs = Math.round(s.duration * 3600);

    if (s.sleepState === 'InBed') byNight[dateKey].inBed += secs;
    if (s.sleepState === 'Asleep') byNight[dateKey].asleep += secs;
  }

  return Object.entries(byNight).map(([date, { inBed, asleep }]) => {
    const totalSecs = asleep || inBed;  // preferir asleep; fallback a inBed
    const hours = totalSecs / 3600;
    // Score estimado: 7.5h → 80, <6h → 50, >9h → 70 (regresión simple)
    let score = Math.min(100, Math.max(30, Math.round(hours * 10.7)));
    if (hours < 5) score = 30 + Math.round(hours * 4);
    else if (hours < 6) score = 50 + Math.round((hours - 5) * 15);
    else if (hours < 8) score = 65 + Math.round((hours - 6) * 10);
    else if (hours < 9) score = 85;
    else score = 75;  // dormir demasiado no es ideal

    return { date, durationSeconds: totalSecs, score, inBedSeconds: inBed, asleepSeconds: asleep };
  });
}
