// rules.ts — Motor de reglas de recomendación

export type RecommendationType = 'recovery' | 'training' | 'sleep' | 'plan';
export type Priority = 'high' | 'medium' | 'low';

export interface Recommendation {
  type: RecommendationType;
  title: string;
  description: string;
  priority: Priority;
  dataPoints: Record<string, number | string | undefined>;
}

export interface InsightStats {
  sleep: {
    current: number | null;       // score de hoy
    avg7d: number | null;
    baseline: number | null;      // media 30d
    stddev: number | null;
    zScore: number | null;
    trend: 'improving' | 'declining' | 'stable';
    values: number[];
  };
  hrv: {
    current: number | null;
    avg7d: number | null;
    baseline: number | null;
    stddev: number | null;
    zScore: number | null;
    trend: 'improving' | 'declining' | 'stable';
    status: string | null;        // BALANCED, UNKNOWN, etc.
    values: number[];
  };
  stress: {
    current: number | null;
    avg7d: number | null;
    baseline: number | null;
    trend: 'improving' | 'declining' | 'stable';
    values: number[];
  };
  restingHR: {
    current: number | null;
    avg7d: number | null;
    trend: 'improving' | 'declining' | 'stable';
    values: number[];
  };
  training: {
    consecutiveDays: number;
    daysSinceLast: number;
    load3d: { sessions: number; totalMinutes: number; avgIntensity: number };
    load7d: { sessions: number; totalMinutes: number; avgIntensity: number };
  };
  todayPlan: { sport: string; detail: string | null } | null;
}

type Rule = (stats: InsightStats) => Recommendation | null;

// Regla 1: Recuperación en declive (sueño bajando + HRV bajo baseline)
const ruleDecliningRecovery: Rule = (stats) => {
  if (stats.sleep.values.length < 5 || stats.hrv.values.length < 5) return null;
  if (stats.sleep.trend !== 'declining') return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore > -0.5) return null;

  return {
    type: 'recovery',
    title: 'Recuperación en declive',
    description: `Tu sueño viene bajando en los últimos días y tu HRV está por debajo de tu baseline. Priorizá descanso activo hoy.`,
    priority: 'high',
    dataPoints: {
      sleepTrend: stats.sleep.trend,
      hrvZScore: stats.hrv.zScore?.toFixed(1),
      sleepAvg7d: stats.sleep.avg7d?.toFixed(0),
    },
  };
};

// Regla 2: Buen día para entrenar fuerte
const ruleGoodTrainingDay: Rule = (stats) => {
  if (stats.sleep.current === null || stats.hrv.current === null) return null;
  if (stats.training.daysSinceLast < 1) return null; // entrenó hoy
  if (stats.sleep.current < 75) return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore < 0) return null;
  if (stats.stress.current !== null && stats.stress.current > 60) return null;

  return {
    type: 'training',
    title: 'Listo para entrenar',
    description: `Dormiste bien (score ${stats.sleep.current}), tu HRV está sobre tu baseline y el estrés es bajo. Buen día para una sesión intensa.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      hrvCurrent: stats.hrv.current?.toFixed(0),
      daysSinceLast: stats.training.daysSinceLast,
    },
  };
};

// Regla 3: Fatiga acumulada por entrenos consecutivos
const ruleAccumulatedFatigue: Rule = (stats) => {
  if (stats.training.consecutiveDays < 3) return null;
  const stressElevated = stats.stress.current !== null && stats.stress.avg7d !== null
    && stats.stress.current > (stats.stress.avg7d + 10);
  const hrvLow = stats.hrv.zScore !== null && stats.hrv.zScore < -0.5;

  if (!stressElevated && !hrvLow) return null;

  return {
    type: 'recovery',
    title: 'Fatiga acumulada',
    description: `Llevas ${stats.training.consecutiveDays} días consecutivos entrenando. Tu cuerpo podría necesitar un descanso para consolidar las adaptaciones.`,
    priority: 'high',
    dataPoints: {
      consecutiveDays: stats.training.consecutiveDays,
      avgStress7d: stats.stress.avg7d?.toFixed(0),
      hrvZScore: stats.hrv.zScore?.toFixed(1),
    },
  };
};

// Regla 4: Bien recuperado, momento de volver a entrenar
const ruleWellRested: Rule = (stats) => {
  if (stats.training.daysSinceLast < 2) return null;
  if (stats.sleep.current === null || stats.sleep.current < 70) return null;
  if (stats.hrv.zScore !== null && stats.hrv.zScore < 0) return null;
  if (stats.stress.avg7d !== null && stats.stress.avg7d > 55) return null;

  return {
    type: 'training',
    title: 'Bien recuperado',
    description: `Llevas ${stats.training.daysSinceLast} días sin entrenar y tus métricas de recuperación están en buen nivel. Buen momento para retomar.`,
    priority: 'medium',
    dataPoints: {
      daysSinceLast: stats.training.daysSinceLast,
      sleepScore: stats.sleep.current,
      hrvZScore: stats.hrv.zScore?.toFixed(1),
    },
  };
};

// Regla 5: Mal sueño hoy
const rulePoorSleepToday: Rule = (stats) => {
  if (stats.sleep.current === null || stats.sleep.current >= 65) return null;

  const hours = ''; // duración manejada por el score
  return {
    type: 'sleep',
    title: 'Noche complicada',
    description: `Tu score de sueño fue ${stats.sleep.current}/100 anoche. Considerá evitar sesiones de alta intensidad hoy y priorizá recuperación.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      sleepBaseline: stats.sleep.baseline?.toFixed(0),
    },
  };
};

// Regla 6: Estado óptimo (todo verde)
const ruleOptimalState: Rule = (stats) => {
  if (stats.sleep.current === null || stats.hrv.current === null) return null;
  if (stats.sleep.current < 82) return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore < 0.5) return null;
  if (stats.stress.current !== null && stats.stress.current > 30) return null;
  if (stats.hrv.status && stats.hrv.status !== 'BALANCED') return null;

  return {
    type: 'training',
    title: 'Estado óptimo',
    description: `Sueño excelente, HRV sobre el baseline y estrés bajo. Condiciones ideales para máxima intensidad.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      hrvCurrent: stats.hrv.current?.toFixed(0),
      stressCurrent: stats.stress.current ?? undefined,
    },
  };
};

// Regla 7: FC reposo subiendo (fatiga crónica)
const ruleRestingHRTrending: Rule = (stats) => {
  if (stats.restingHR.values.length < 5) return null;
  if (stats.restingHR.trend !== 'declining') return null; // declining en HR = malo (sube el número)
  // Nota: para HR, "declining" en el array de valores = bueno. "improving" en el array = malo.
  // Revertimos la lógica: la pendiente positiva en HR = mala señal
  return null; // se maneja en el orquestador con lógica invertida
};

// Regla 7 (corrección): Resting HR con pendiente positiva = señal de fatiga
const ruleRisingRestingHR: Rule = (stats) => {
  if (stats.restingHR.values.length < 5) return null;
  if (stats.restingHR.trend !== 'improving') return null; // "improving" aquí = valores subiendo = malo para HR
  if (stats.restingHR.current === null || stats.restingHR.avg7d === null) return null;
  if (stats.restingHR.current <= stats.restingHR.avg7d + 3) return null; // solo si es notable

  return {
    type: 'recovery',
    title: 'FC reposo elevada',
    description: `Tu frecuencia cardíaca en reposo viene subiendo esta semana (${stats.restingHR.current} bpm vs ${stats.restingHR.avg7d?.toFixed(0)} bpm promedio). Posible señal de fatiga acumulada.`,
    priority: 'medium',
    dataPoints: {
      restingHRCurrent: stats.restingHR.current,
      restingHRAvg7d: stats.restingHR.avg7d?.toFixed(0),
    },
  };
};

// Regla 8: Hay plan para hoy y las métricas están bien
const rulePlanToday: Rule = (stats) => {
  if (!stats.todayPlan) return null;
  if (stats.sleep.current === null || stats.sleep.current < 60) return null;

  const readyEnough = (stats.hrv.zScore === null || stats.hrv.zScore > -0.5)
    && (stats.stress.current === null || stats.stress.current < 65);

  if (!readyEnough) return null;

  return {
    type: 'plan',
    title: `Plan: ${stats.todayPlan.sport}`,
    description: stats.todayPlan.detail
      ? `Tenés ${stats.todayPlan.sport} planeado hoy${stats.todayPlan.detail ? ` — ${stats.todayPlan.detail}` : ''}. Tus métricas de recuperación están bien.`
      : `Tenés ${stats.todayPlan.sport} planeado hoy y tus métricas de recuperación están bien.`,
    priority: 'medium',
    dataPoints: {
      sport: stats.todayPlan.sport,
      sleepScore: stats.sleep.current,
    },
  };
};

// Todas las reglas en orden de evaluación
export const RULES: Rule[] = [
  rulePoorSleepToday,
  ruleDecliningRecovery,
  ruleAccumulatedFatigue,
  ruleOptimalState,
  ruleGoodTrainingDay,
  ruleWellRested,
  ruleRisingRestingHR,
  rulePlanToday,
];

export function evaluateRules(stats: InsightStats): Recommendation[] {
  const results: Recommendation[] = [];
  for (const rule of RULES) {
    const rec = rule(stats);
    if (rec) results.push(rec);
  }

  // Ordenar: high primero, luego medium, luego low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Devolver máx 3 recomendaciones
  return results.slice(0, 3);
}
