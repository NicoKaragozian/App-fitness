// rules.ts — Recommendation rules engine

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
    current: number | null;       // today's score
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

// Rule 1: Recovery declining (sleep dropping + HRV below baseline)
const ruleDecliningRecovery: Rule = (stats) => {
  if (stats.sleep.values.length < 5 || stats.hrv.values.length < 5) return null;
  if (stats.sleep.trend !== 'declining') return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore > -0.5) return null;

  return {
    type: 'recovery',
    title: 'Recovery declining',
    description: `Your sleep has been dropping over the last few days and your HRV is below your baseline. Prioritize active recovery today.`,
    priority: 'high',
    dataPoints: {
      sleepTrend: stats.sleep.trend,
      hrvZScore: stats.hrv.zScore?.toFixed(1),
      sleepAvg7d: stats.sleep.avg7d?.toFixed(0),
    },
  };
};

// Rule 2: Good day for intense training
const ruleGoodTrainingDay: Rule = (stats) => {
  if (stats.sleep.current === null || stats.hrv.current === null) return null;
  if (stats.training.daysSinceLast < 1) return null; // trained today
  if (stats.sleep.current < 75) return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore < 0) return null;
  if (stats.stress.current !== null && stats.stress.current > 60) return null;

  return {
    type: 'training',
    title: 'Ready to train',
    description: `You slept well (score ${stats.sleep.current}), your HRV is above your baseline and stress is low. Good day for an intense session.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      hrvCurrent: stats.hrv.current?.toFixed(0),
      daysSinceLast: stats.training.daysSinceLast,
    },
  };
};

// Rule 3: Accumulated fatigue from consecutive training days
const ruleAccumulatedFatigue: Rule = (stats) => {
  if (stats.training.consecutiveDays < 3) return null;
  const stressElevated = stats.stress.current !== null && stats.stress.avg7d !== null
    && stats.stress.current > (stats.stress.avg7d + 10);
  const hrvLow = stats.hrv.zScore !== null && stats.hrv.zScore < -0.5;

  if (!stressElevated && !hrvLow) return null;

  return {
    type: 'recovery',
    title: 'Accumulated fatigue',
    description: `You've been training for ${stats.training.consecutiveDays} consecutive days. Your body may need a rest day to consolidate adaptations.`,
    priority: 'high',
    dataPoints: {
      consecutiveDays: stats.training.consecutiveDays,
      avgStress7d: stats.stress.avg7d?.toFixed(0),
      hrvZScore: stats.hrv.zScore?.toFixed(1),
    },
  };
};

// Rule 4: Well recovered, time to get back to training
const ruleWellRested: Rule = (stats) => {
  if (stats.training.daysSinceLast < 2) return null;
  if (stats.sleep.current === null || stats.sleep.current < 70) return null;
  if (stats.hrv.zScore !== null && stats.hrv.zScore < 0) return null;
  if (stats.stress.avg7d !== null && stats.stress.avg7d > 55) return null;

  return {
    type: 'training',
    title: 'Well recovered',
    description: `You haven't trained for ${stats.training.daysSinceLast} days and your recovery metrics are at a good level. Good time to get back to it.`,
    priority: 'medium',
    dataPoints: {
      daysSinceLast: stats.training.daysSinceLast,
      sleepScore: stats.sleep.current,
      hrvZScore: stats.hrv.zScore?.toFixed(1),
    },
  };
};

// Rule 5: Poor sleep today
const rulePoorSleepToday: Rule = (stats) => {
  if (stats.sleep.current === null || stats.sleep.current >= 65) return null;

  const hours = ''; // duration handled by the score
  return {
    type: 'sleep',
    title: 'Rough night',
    description: `Your sleep score was ${stats.sleep.current}/100 last night. Consider avoiding high-intensity sessions today and prioritize recovery.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      sleepBaseline: stats.sleep.baseline?.toFixed(0),
    },
  };
};

// Rule 6: Optimal state (all green)
const ruleOptimalState: Rule = (stats) => {
  if (stats.sleep.current === null || stats.hrv.current === null) return null;
  if (stats.sleep.current < 82) return null;
  if (stats.hrv.zScore === null || stats.hrv.zScore < 0.5) return null;
  if (stats.stress.current !== null && stats.stress.current > 30) return null;
  if (stats.hrv.status && stats.hrv.status !== 'BALANCED') return null;

  return {
    type: 'training',
    title: 'Optimal state',
    description: `Excellent sleep, HRV above baseline and low stress. Ideal conditions for maximum intensity.`,
    priority: 'high',
    dataPoints: {
      sleepScore: stats.sleep.current,
      hrvCurrent: stats.hrv.current?.toFixed(0),
      stressCurrent: stats.stress.current ?? undefined,
    },
  };
};

// Rule 7: Resting HR rising (chronic fatigue)
const ruleRestingHRTrending: Rule = (stats) => {
  if (stats.restingHR.values.length < 5) return null;
  if (stats.restingHR.trend !== 'declining') return null; // declining in HR = bad (number goes up)
  // Note: for HR, "declining" in value array = good. "improving" in array = bad.
  // We invert the logic: positive slope in HR = bad sign
  return null; // handled in the orchestrator with inverted logic
};

// Rule 7 (fix): Resting HR with positive slope = fatigue signal
const ruleRisingRestingHR: Rule = (stats) => {
  if (stats.restingHR.values.length < 5) return null;
  if (stats.restingHR.trend !== 'improving') return null; // "improving" here = values rising = bad for HR
  if (stats.restingHR.current === null || stats.restingHR.avg7d === null) return null;
  if (stats.restingHR.current <= stats.restingHR.avg7d + 3) return null; // only if notable

  return {
    type: 'recovery',
    title: 'Elevated resting HR',
    description: `Your resting heart rate has been rising this week (${stats.restingHR.current} bpm vs ${stats.restingHR.avg7d?.toFixed(0)} bpm average). Possible sign of accumulated fatigue.`,
    priority: 'medium',
    dataPoints: {
      restingHRCurrent: stats.restingHR.current,
      restingHRAvg7d: stats.restingHR.avg7d?.toFixed(0),
    },
  };
};

// Rule 8: There's a plan for today and metrics look good
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
      ? `You have ${stats.todayPlan.sport} planned today${stats.todayPlan.detail ? ` — ${stats.todayPlan.detail}` : ''}. Your recovery metrics look good.`
      : `You have ${stats.todayPlan.sport} planned today and your recovery metrics look good.`,
    priority: 'medium',
    dataPoints: {
      sport: stats.todayPlan.sport,
      sleepScore: stats.sleep.current,
    },
  };
};

// All rules in evaluation order
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

  // Sort: high first, then medium, then low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Return max 3 recommendations
  return results.slice(0, 3);
}
