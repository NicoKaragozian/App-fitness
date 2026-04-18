// insights/index.ts — Orchestrator: queries DB, computes stats, evaluates rules

import { desc, eq, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { sleep, hrv, stress, daily_summary, activities, weekly_plan } from '../db/schema/index.js';
import {
  rollingAverage, mean, standardDeviation, zScore, trend,
  consecutiveTrainingDays, daysSinceLastTraining, trainingLoad,
} from './stats.js';
import { evaluateRules, type InsightStats, type Recommendation } from './rules.js';

interface InsightsResult {
  recommendations: Recommendation[];
  stats: {
    sleep: { current: number | null; baseline: number | null; trend: string };
    hrv: { current: number | null; baseline: number | null; trend: string; status: string | null };
    stress: { current: number | null; baseline: number | null; trend: string };
    restingHR: { current: number | null; avg7d: number | null; trend: string };
    trainingLoad: { last3d: number; last7d: number };
  };
}

export async function computeInsights(userId: string): Promise<InsightsResult> {
  const today = new Date().toISOString().slice(0, 10);

  const sleepRows = await db.select({ date: sleep.date, score: sleep.score })
    .from(sleep).where(sql`${sleep.user_id} = ${userId} AND ${sleep.score} IS NOT NULL`).orderBy(desc(sleep.date)).limit(30);

  const sleepValues = [...sleepRows].reverse().map(r => r.score!);
  const sleepToday = sleepRows[0]?.score ?? null;
  const sleep7d = sleepValues.length >= 3 ? rollingAverage(sleepValues, 7) : null;
  const sleepBaseline = sleepValues.length >= 3 ? mean(sleepValues) : null;
  const sleepStddev = sleepValues.length >= 3 ? standardDeviation(sleepValues) : null;
  const sleepZScore = (sleepToday !== null && sleepBaseline !== null && sleepStddev !== null)
    ? zScore(sleepToday, sleepBaseline, sleepStddev) : null;
  const sleepTrend = sleepValues.length >= 5 ? trend(sleepValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };

  const hrvRows = await db.select({ date: hrv.date, nightly_avg: hrv.nightly_avg, status: hrv.status })
    .from(hrv).where(sql`${hrv.user_id} = ${userId} AND ${hrv.nightly_avg} IS NOT NULL`).orderBy(desc(hrv.date)).limit(30);

  const hrvValues = [...hrvRows].reverse().map(r => r.nightly_avg!);
  const hrvToday = hrvRows[0]?.nightly_avg ?? null;
  const hrv7d = hrvValues.length >= 3 ? rollingAverage(hrvValues, 7) : null;
  const hrvBaseline = hrvValues.length >= 3 ? mean(hrvValues) : null;
  const hrvStddev = hrvValues.length >= 3 ? standardDeviation(hrvValues) : null;
  const hrvZScore = (hrvToday !== null && hrvBaseline !== null && hrvStddev !== null)
    ? zScore(hrvToday, hrvBaseline, hrvStddev) : null;
  const hrvTrend = hrvValues.length >= 5 ? trend(hrvValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };
  const hrvStatus = hrvRows[0]?.status ?? null;

  const stressRows = await db.select({ date: stress.date, avg_stress: stress.avg_stress })
    .from(stress).where(sql`${stress.user_id} = ${userId} AND ${stress.avg_stress} IS NOT NULL`).orderBy(desc(stress.date)).limit(30);

  const stressValues = [...stressRows].reverse().map(r => r.avg_stress!);
  const stressToday = stressRows[0]?.avg_stress ?? null;
  const stress7d = stressValues.length >= 3 ? rollingAverage(stressValues, 7) : null;
  const stressBaseline = stressValues.length >= 3 ? mean(stressValues) : null;
  const stressTrendRaw = stressValues.length >= 5 ? trend(stressValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };
  const stressTrendDir = stressTrendRaw.direction === 'improving' ? 'declining'
    : stressTrendRaw.direction === 'declining' ? 'improving'
    : 'stable';

  const hrRows = await db.select({ date: daily_summary.date, resting_hr: daily_summary.resting_hr })
    .from(daily_summary).where(sql`${daily_summary.user_id} = ${userId} AND ${daily_summary.resting_hr} IS NOT NULL`).orderBy(desc(daily_summary.date)).limit(14);

  const hrValues = [...hrRows].reverse().map(r => r.resting_hr!);
  const hrToday = hrRows[0]?.resting_hr ?? null;
  const hr7d = hrValues.length >= 3 ? rollingAverage(hrValues, 7) : null;
  const hrTrendRaw = hrValues.length >= 5 ? trend(hrValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };

  const actRows = await db.select({
    date: sql<string>`LEFT(${activities.start_time}, 10)`,
    duration: activities.duration,
    avg_hr: activities.avg_hr,
  }).from(activities).where(eq(activities.user_id, userId)).orderBy(desc(activities.start_time)).limit(100);

  const actDates = actRows.map(r => r.date);
  const consecutiveDays = consecutiveTrainingDays(actDates);
  const daysSinceLast = daysSinceLastTraining(actDates);
  const load3d = trainingLoad(actRows as any, 3);
  const load7d = trainingLoad(actRows as any, 7);

  const todayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
  const [planRow] = await db.select({ sport: weekly_plan.sport, detail: weekly_plan.detail })
    .from(weekly_plan)
    .where(sql`${weekly_plan.user_id} = ${userId} AND ${weekly_plan.day} = ${todayName} AND ${weekly_plan.completed} = FALSE`)
    .limit(1);
  const todayPlan = planRow ?? null;

  const stats: InsightStats = {
    sleep: {
      current: sleepToday,
      avg7d: sleep7d,
      baseline: sleepBaseline,
      stddev: sleepStddev,
      zScore: sleepZScore,
      trend: sleepTrend.direction,
      values: sleepValues,
    },
    hrv: {
      current: hrvToday,
      avg7d: hrv7d,
      baseline: hrvBaseline,
      stddev: hrvStddev,
      zScore: hrvZScore,
      trend: hrvTrend.direction,
      status: hrvStatus,
      values: hrvValues,
    },
    stress: {
      current: stressToday,
      avg7d: stress7d,
      baseline: stressBaseline,
      trend: stressTrendDir,
      values: stressValues,
    },
    restingHR: {
      current: hrToday,
      avg7d: hr7d,
      trend: hrTrendRaw.direction,
      values: hrValues,
    },
    training: {
      consecutiveDays,
      daysSinceLast,
      load3d,
      load7d,
    },
    todayPlan,
  };

  const recommendations = evaluateRules(stats);

  return {
    recommendations,
    stats: {
      sleep: { current: sleepToday, baseline: sleepBaseline, trend: sleepTrend.direction },
      hrv: { current: hrvToday, baseline: hrvBaseline, trend: hrvTrend.direction, status: hrvStatus },
      stress: { current: stressToday, baseline: stressBaseline, trend: stressTrendDir },
      restingHR: { current: hrToday, avg7d: hr7d, trend: hrTrendRaw.direction },
      trainingLoad: { last3d: load3d.totalMinutes, last7d: load7d.totalMinutes },
    },
  };
}
