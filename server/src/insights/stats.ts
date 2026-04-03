// stats.ts — Funciones estadísticas puras para el motor de insights

export function rollingAverage(values: number[], window: number): number {
  const slice = values.slice(-window);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function zScore(value: number, m: number, stddev: number): number {
  if (stddev === 0) return 0;
  return (value - m) / stddev;
}

// Regresión lineal simple — devuelve la pendiente (positiva = tendencia creciente)
export function trend(values: number[]): { slope: number; direction: 'improving' | 'declining' | 'stable' } {
  const n = values.length;
  if (n < 2) return { slope: 0, direction: 'stable' };

  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);

  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (values[i] - my), 0);
  const den = xs.reduce((sum, x) => sum + Math.pow(x - mx, 2), 0);
  const slope = den === 0 ? 0 : num / den;

  const direction = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
  return { slope, direction };
}

// Días consecutivos de entrenamiento contados hacia atrás desde hoy
// activities ordenadas más reciente primero, con dates YYYY-MM-DD
export function consecutiveTrainingDays(activityDates: string[]): number {
  if (activityDates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trainingSet = new Set(activityDates.map(d => d.slice(0, 10)));
  let count = 0;
  const cursor = new Date(today);

  for (let i = 0; i < 30; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (trainingSet.has(dateStr)) {
      count++;
    } else if (i > 0) {
      // Si el día anterior fue descanso, cortamos la racha
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

// Días desde el último entrenamiento
export function daysSinceLastTraining(activityDates: string[]): number {
  if (activityDates.length === 0) return 999;
  const todayStr = new Date().toISOString().slice(0, 10);
  const latestStr = activityDates[0].slice(0, 10);
  const todayDate = new Date(todayStr + 'T12:00:00');
  const latestDate = new Date(latestStr + 'T12:00:00');
  const diff = Math.floor((todayDate.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// Carga de entrenamiento: sesiones y duración total en últimos N días
export function trainingLoad(
  activities: { date: string; duration: number; avg_hr: number | null }[],
  days: number
): { sessions: number; totalMinutes: number; avgIntensity: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const recent = activities.filter(a => new Date(a.date + 'T12:00:00') >= cutoff);
  const sessions = recent.length;
  const totalMinutes = Math.round(recent.reduce((s, a) => s + (a.duration || 0), 0) / 60);
  const intensities = recent.filter(a => a.avg_hr != null).map(a => a.avg_hr as number);
  const avgIntensity = intensities.length > 0 ? mean(intensities) : 0;

  return { sessions, totalMinutes, avgIntensity };
}
